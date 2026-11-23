import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import type { Question } from "../../supabase/types";
import { bindTurn, interpretTurn, type RideDraft } from "./draftClient";
import { scoreReadback, type TurnBinding, type VoiceScore } from "./voiceCommand";
import "./rideAlong.css";

const LIMIT_MS = 8000;
const MAX_AUDIO_BYTES = 512 * 1024;
const MAX_ANSWER = 200;
const SCORE_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];
const CLARIFY = "I need one signed score. Try “plus two,” “minus one,” or “zero.”";
const RETRY = "I couldn't check that answer. Try again or pick a score.";
const formatScore = (score: number) => score > 0 ? `+${score}` : String(score).replace("-", "−");
const stopTracks = (stream: MediaStream | null) => stream?.getTracks().forEach(track => track.stop());

interface Props {
  draft: RideDraft;
  horseName: string;
  questions: Question[];
  open: boolean;
  disabled: boolean;
  returnFocus: RefObject<HTMLElement>;
  onReview: () => void;
  onBusy: (busy: boolean) => void;
  onConfirm: (proposal: VoiceScore, requestId: string) => Promise<void>;
}

type Stage = "idle" | "opening" | "listening" | "thinking" | "confirming";
type Message = { author: "scorer" | "you"; text: string };

export default function RideAlongPanel({ draft, horseName, questions, open, disabled, returnFocus, onReview, onBusy, onConfirm }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [proposal, setProposal] = useState<VoiceScore>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [confirmedMessages, setConfirmedMessages] = useState<Record<string, Message[]>>({});
  const [answer, setAnswer] = useState("");
  const [pickScore, setPickScore] = useState(false);
  const [retryOnly, setRetryOnly] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const answerId = useId();
  const resources = useRef<{
    generation: number; stage: Stage; timer?: number; recorder?: MediaRecorder;
    stream: MediaStream | null; abort?: AbortController; speech?: SpeechSynthesisUtterance;
  }>({ generation: 0, stage: "idle", stream: null });
  const busyCallback = useRef(onBusy);
  busyCallback.current = onBusy;
  const sequence = draft.guided_question_ids ?? questions.filter(q => q.axis === "foundation")
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).map(q => q.id);
  const question = questions.find(q => q.id === sequence[draft.guided_cursor]);
  const context = `${draft.id}:${draft.version}:${question?.id ?? "done"}`;
  const contextRef = useRef(context);
  contextRef.current = context;

  function say(text: string) {
    if (typeof SpeechSynthesisUtterance === "undefined" || !window.speechSynthesis) return;
    try {
      const voice = window.speechSynthesis.getVoices().find(v => v.localService && v.lang.startsWith("en"));
      if (!voice) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = "en-US";
      resources.current.speech = utterance;
      window.speechSynthesis.speak(utterance);
    } catch { /* The conversation is also visible. */ }
  }

  function stopSpeaking() {
    if (resources.current.speech) window.speechSynthesis?.cancel();
    resources.current.speech = undefined;
  }

  function append(author: Message["author"], text: string) {
    setMessages(previous => [...previous, { author, text }]);
  }

  function reply(text: string, speak = false) {
    append("scorer", text);
    if (speak) say(text);
  }

  function changeStage(next: Stage) {
    resources.current.stage = next;
    setStage(next);
    busyCallback.current(next !== "idle");
  }

  function release() {
    const r = resources.current;
    ++r.generation;
    window.clearTimeout(r.timer);
    r.abort?.abort();
    if (r.recorder?.state === "recording") r.recorder.stop();
    stopTracks(r.stream);
    stopSpeaking();
    r.recorder = undefined;
    r.stream = null;
    r.abort = undefined;
  }

  function isCurrent(generation: number) {
    return resources.current.generation === generation && contextRef.current === context && !document.hidden;
  }

  const questionPrompt = question && `${question.text}. What score would you give, from minus three to plus three?`;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      headingRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus();
    }
  }, [open, returnFocus]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    if (!open || !dialog || !viewport) return;
    const fit = () => {
      dialog.style.setProperty("--ride-chat-height", `${viewport.height}px`);
      dialog.style.setProperty("--ride-chat-top", `${viewport.offsetTop}px`);
    };
    fit();
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
    };
  }, [open]);

  useEffect(() => {
    const background = () => {
      if (!document.hidden) return;
      stopSpeaking();
      if (resources.current.stage === "idle" || resources.current.stage === "confirming") return;
      release();
      changeStage("idle");
      reply("I'm here when you're ready to answer again.");
    };
    document.addEventListener("visibilitychange", background);
    return () => {
      document.removeEventListener("visibilitychange", background);
      release();
      busyCallback.current(false);
    };
  }, [draft.id]);

  useEffect(() => {
    release();
    changeStage("idle");
    setProposal(undefined);
    setMessages([]);
    setAnswer("");
    setPickScore(false);
    setRetryOnly(false);
  }, [context]);

  useEffect(() => {
    if (open && questionPrompt) say(questionPrompt);
    if (open && draft.guided_cursor >= sequence.length) say("That's the last question. Your ride is ready to review.");
    if (!open) stopSpeaking();
  }, [open, context, questionPrompt, draft.guided_cursor, sequence.length]);

  useEffect(() => {
    const log = logRef.current;
    if (open && log) log.scrollTop = log.scrollHeight;
  }, [open, context, messages, stage]);

  useLayoutEffect(() => {
    if (open && proposal) confirmRef.current?.focus();
  }, [open, proposal]);

  function propose(score: number, binding: TurnBinding, readAloud: boolean) {
    if (!question) return;
    const next = { questionId: question.id, label: question.text, score, binding };
    setProposal(next);
    reply(`I have ${formatScore(score)} for this question. Is that right?`);
    if (readAloud) say(scoreReadback(next));
  }

  async function checkAnswer(binding: TurnBinding, value: string | Blob, generation: number) {
    const r = resources.current;
    changeStage("thinking");
    const abort = new AbortController();
    r.abort = abort;
    const timeout = window.setTimeout(() => abort.abort(), 20_000);
    const fromVoice = typeof value !== "string";
    try {
      const result = await interpretTurn(binding, value, abort.signal);
      if (!isCurrent(generation)) return;
      if (fromVoice && result.transcript.trim()) append("you", result.transcript);
      if (result.score === null) reply(CLARIFY, fromVoice);
      else propose(result.score, binding, fromVoice);
    } catch {
      if (isCurrent(generation)) reply(RETRY, fromVoice);
    } finally {
      window.clearTimeout(timeout);
      if (isCurrent(generation)) {
        r.abort = undefined;
        changeStage("idle");
      }
    }
  }

  async function startListening() {
    if (!canAnswer || !question || document.hidden || resources.current.stage !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      reply("I can't hear you on this device. You can type or pick a score.");
      return;
    }
    release();
    setPickScore(false);
    if (navigator.onLine === false) {
      reply("You're offline. Try again when you're connected.");
      return;
    }
    const r = resources.current;
    const generation = r.generation;
    changeStage("opening");
    let microphoneRequested = false;
    try {
      const binding = await bindTurn(draft, question.id, crypto.randomUUID());
      if (!isCurrent(generation)) return;
      microphoneRequested = true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!isCurrent(generation)) {
        stopTracks(stream);
        return;
      }
      r.stream = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Unsupported browser");
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      const chunks: Blob[] = [];
      r.recorder = recorder;
      recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => {
        if (!isCurrent(generation)) return;
        release();
        changeStage("idle");
        reply("I couldn't hear that. Try again, type, or pick a score.");
      };
      recorder.onstop = () => {
        stopTracks(stream);
        if (!isCurrent(generation)) return;
        r.stream = null;
        window.clearTimeout(r.timer);
        const recording = new Blob(chunks, { type: mimeType });
        chunks.length = 0;
        if (!recording.size || recording.size > MAX_AUDIO_BYTES) {
          changeStage("idle");
          reply("I couldn't hear a score. Try again, type, or pick one.");
          return;
        }
        void checkAnswer(binding, recording, generation);
      };
      recorder.start();
      changeStage("listening");
      r.timer = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, LIMIT_MS);
    } catch {
      if (!isCurrent(generation)) return;
      release();
      changeStage("idle");
      reply(microphoneRequested ? "I couldn't listen. Check microphone access, type, or pick a score." : RETRY);
    }
  }

  async function send(text: string, selected?: number) {
    if (!text || !canAnswer || !question || document.hidden || resources.current.stage !== "idle") return;
    release();
    setAnswer("");
    setPickScore(false);
    append("you", text);
    const generation = resources.current.generation;
    changeStage("opening");
    try {
      const binding = await bindTurn(draft, question.id, crypto.randomUUID());
      if (!isCurrent(generation)) return;
      if (selected === undefined) await checkAnswer(binding, text, generation);
      else propose(selected, binding, false);
    } catch {
      if (isCurrent(generation)) reply("I couldn't prepare that score. Try again or return to the ride.");
    } finally {
      if (isCurrent(generation)) changeStage("idle");
    }
  }

  async function confirm() {
    if (disabled || !proposal || resources.current.stage !== "idle") return;
    const generation = resources.current.generation;
    stopSpeaking();
    changeStage("confirming");
    try {
      await onConfirm(proposal, proposal.binding.turn_id);
      setConfirmedMessages(previous => ({ ...previous, [proposal.questionId]: messages }));
      if (contextRef.current !== context || resources.current.generation !== generation) return;
      setProposal(undefined);
      setRetryOnly(false);
      reply("Score saved.");
    } catch {
      if (contextRef.current !== context || resources.current.generation !== generation) return;
      setRetryOnly(true);
      reply("I couldn't confirm the score. Try confirming it again.");
    } finally {
      if (contextRef.current === context && resources.current.generation === generation) changeStage("idle");
    }
  }

  function cancelAnswer() {
    release();
    changeStage("idle");
    reply("Go ahead when you're ready.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(answer.trim());
  }

  const canAnswer = open && !disabled && !!question && !proposal && stage === "idle";
  const complete = draft.guided_cursor >= sequence.length;
  const busy = stage !== "idle";
  const stageMessage = stage === "listening" ? "Listening…" : stage === "confirming" ? "Saving score…" : "One moment…";

  return (
    <dialog className="ride-chat" ref={dialogRef} aria-labelledby={titleId} onCancel={event => {
      event.preventDefault();
      if (!busy) onReview();
    }}>
      <header className="ride-chat-header">
        <div className="ride-chat-width ride-chat-toprow">
          <div>
            <h2 ref={headingRef} id={titleId} tabIndex={-1}>Ride-along scorer</h2>
            <p>{horseName} · Foundation Phase 1</p>
          </div>
          <button type="button" className="btn ride-chat-control" disabled={busy} onClick={onReview}>Review ride</button>
        </div>
      </header>

      <div className="ride-chat-feed" ref={logRef} role="log" aria-label="Scoring conversation" aria-live="polite">
        <div className="ride-chat-width ride-chat-messages">
          {sequence.slice(0, draft.guided_cursor).map((id, index) => {
            const previous = questions.find(item => item.id === id);
            const rating = draft.ratings.find(item => item.question_id === id);
            if (!previous || !rating) return null;
            const exchange = confirmedMessages[id];
            return <div key={id} className="ride-chat-history">
              <p className="ride-chat-completed">Question {index + 1} · {previous.text}</p>
              {exchange ? exchange.map((message, i) => <ChatBubble key={i} {...message} />) :
                <ChatBubble author="you" text={formatScore(rating.score)} />}
              <ChatBubble author="scorer" text={`Saved ${formatScore(rating.score)}.`} />
            </div>;
          })}
          {question && <div className="ride-chat-turn">
            <div className="ride-chat-bubble ride-chat-question">
              <p className="ride-chat-author">Question {draft.guided_cursor + 1} of {sequence.length}</p>
              <h3>{question.text}</h3>
              <p>What score would you give, from −3 to +3?</p>
              <button type="button" className="ride-chat-replay" disabled={busy} onClick={() => questionPrompt && say(questionPrompt)}>
                <ChatIcon name="speaker" /> Read aloud
              </button>
            </div>
          </div>}
          {messages.map(({ author, text }, index) => <ChatBubble key={index} author={author} text={text} />)}
          {busy && <ChatBubble author="scorer" text={stageMessage} />}
          {complete && <ChatBubble author="scorer" text="That's the last question. Your ride is ready to review." />}
          {!complete && !question && <ChatBubble author="scorer" text="This question is unavailable. You can still review the ride." />}
        </div>
      </div>

      <footer className="ride-chat-footer">
        <div className="ride-chat-width">
          {complete ? <button type="button" className="btn btn-leather ride-chat-control" onClick={onReview}>Review scores and save</button> :
            proposal ? <div className="ride-chat-confirm">
              <button ref={confirmRef} type="button" className="btn btn-leather ride-chat-control" disabled={disabled || busy} onClick={() => void confirm()}>
                {stage === "confirming" ? "Confirming…" : retryOnly ? "Retry confirmation" : "Confirm score"}
              </button>
              <button type="button" className="btn ride-chat-control" disabled={disabled || busy || retryOnly} onClick={() => {
                release();
                setProposal(undefined);
                reply("Let's try that question again.");
              }}>Try again</button>
            </div> :
            <form onSubmit={submit} className="ride-chat-composer">
              <div className="ride-chat-input-row">
                <label className="sr-only" htmlFor={answerId}>Your answer</label>
                <input id={answerId} className="input ride-chat-input" placeholder="Type a score, e.g. +2" value={answer}
                  maxLength={MAX_ANSWER} readOnly={!canAnswer} onChange={event => setAnswer(event.target.value)} />
                <button type="submit" className="btn ride-chat-control" disabled={!canAnswer || !answer.trim()}>Send</button>
                {stage === "listening" ?
                  <button type="button" className="btn btn-leather ride-chat-control" onClick={() => {
                    const recorder = resources.current.recorder;
                    if (recorder?.state === "recording") recorder.stop();
                  }}>Done</button> :
                  <button type="button" className="btn btn-leather ride-chat-control" disabled={!canAnswer} onClick={() => void startListening()}>
                    <ChatIcon name="mic" /> Speak
                  </button>}
              </div>
              <div className="ride-chat-options">
                {busy ? <button type="button" className="ride-chat-replay" onClick={cancelAnswer}>Cancel answer</button> :
                  <button type="button" className="ride-chat-replay" disabled={!canAnswer} aria-expanded={pickScore}
                    onClick={() => setPickScore(selected => !selected)}>Pick a score</button>}
              </div>
              {pickScore && <div className="ride-chat-score-options" role="group" aria-label="Choose a score">
                {SCORE_OPTIONS.map(score => <button key={score} type="button" className="btn ride-chat-control" disabled={!canAnswer}
                  onClick={() => void send(formatScore(score), score)}>{formatScore(score)}</button>)}
              </div>}
            </form>}
        </div>
      </footer>
    </dialog>
  );
}

function ChatBubble({ author, text }: Message) {
  return <div className={`ride-chat-turn${author === "you" ? " ride-chat-turn-you" : ""}`}>
    <div className="ride-chat-bubble"><p className="ride-chat-author">{author === "you" ? "You" : "Scorer"}</p><p>{text}</p></div>
  </div>;
}

function ChatIcon({ name }: { name: "speaker" | "mic" }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {name === "speaker" ? <path d="M3 9v6h4l5 4V5L7 9H3Zm13 0a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12" /> :
      <path d="M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V6Zm-3 5v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6" />}
  </svg>;
}

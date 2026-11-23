import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import type { Question } from "../../supabase/types";
import { bindTurn, interpretTurn, type RideDraft } from "./draftClient";
import { scoreReadback, type TurnBinding, type VoiceScore } from "./voiceCommand";
import { openVoiceCapture, type VoiceCapture } from "./voiceCapture";
import "./rideAlong.css";

const MAX_ANSWER = 200;
const SCORE_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];
const CLARIFY = "I need one signed score. Try “plus two,” “minus one,” or “zero.”";
const RETRY = "I couldn't check that answer. Try again or pick a score.";
const formatScore = (score: number) => score > 0 ? `+${score}` : String(score).replace("-", "−");

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

type Stage = "idle" | "opening" | "thinking" | "confirming";
type Mic = "off" | "starting" | "on";
type Message = { author: "scorer" | "you"; text: string };

export default function RideAlongPanel({ draft, horseName, questions, open, disabled, returnFocus, onReview, onBusy, onConfirm }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [mic, setMic] = useState<Mic>("off");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
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
    generation: number; stage: Stage; audioTurn?: boolean; armed?: boolean;
    capture?: VoiceCapture; micRequest?: AbortController; abort?: AbortController;
    speech?: SpeechSynthesisUtterance; speechTimer?: number;
  }>({ generation: 0, stage: "idle" });
  const busyCallback = useRef(onBusy);
  busyCallback.current = onBusy;
  const sequence = draft.guided_question_ids ?? questions.filter(q => q.axis === "foundation")
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).map(q => q.id);
  const question = questions.find(q => q.id === sequence[draft.guided_cursor]);
  const context = `${draft.id}:${draft.version}:${question?.id ?? "done"}`;
  const contextRef = useRef(context);
  contextRef.current = context;

  function pauseCapture() {
    const r = resources.current;
    if (r.armed) r.capture?.pause();
    r.armed = false;
    setListening(false);
  }

  function say(text: string) {
    if (typeof SpeechSynthesisUtterance === "undefined" || !window.speechSynthesis || document.hidden) return;
    try {
      const voice = window.speechSynthesis.getVoices().find(v => v.localService && v.lang.startsWith("en"));
      if (!voice) return;
      stopSpeaking();
      pauseCapture();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = "en-US";
      const r = resources.current;
      r.speech = utterance;
      setSpeaking(true);
      const finish = () => {
        if (r.speech !== utterance) return;
        window.clearTimeout(r.speechTimer);
        // Allow audio from the speaker to decay before opening the next turn.
        r.speechTimer = window.setTimeout(() => {
          if (r.speech === utterance) {
            r.speech = undefined;
            setSpeaking(false);
          }
        }, 250);
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      r.speechTimer = window.setTimeout(() => {
        if (r.speech === utterance) stopSpeaking();
      }, 25_000);
      window.speechSynthesis.speak(utterance);
    } catch {
      stopSpeaking();
    }
  }

  function stopSpeaking() {
    const r = resources.current;
    const wasSpeaking = Boolean(r.speech);
    r.speech = undefined;
    window.clearTimeout(r.speechTimer);
    if (wasSpeaking) window.speechSynthesis?.cancel();
    setSpeaking(false);
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
    pauseCapture();
    r.abort?.abort();
    r.abort = undefined;
    r.audioTurn = false;
  }

  function closeMic() {
    const r = resources.current;
    r.capture?.close();
    r.capture = undefined;
    r.micRequest?.abort();
    r.micRequest = undefined;
  }

  function pauseMic() {
    const wasAudioTurn = resources.current.audioTurn;
    closeMic();
    if (wasAudioTurn && resources.current.stage !== "confirming") {
      release();
      changeStage("idle");
    }
    setMic("off");
  }

  async function enableMic() {
    const r = resources.current;
    if (!canAnswer || r.capture || r.micRequest || document.hidden) return;
    const request = new AbortController();
    r.micRequest = request;
    setMic("starting");
    const unavailable = () => {
      if (r.micRequest !== request) return;
      pauseMic();
      reply("I couldn't listen. Check microphone access, type, or pick a score.");
    };
    try {
      const capture = await openVoiceCapture(request.signal, unavailable);
      if (request.signal.aborted || document.hidden || !dialogRef.current?.open) {
        capture.close();
        if (r.micRequest === request) pauseMic();
        return;
      }
      r.capture = capture;
      setMic("on");
    } catch {
      unavailable();
    }
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
      leaveChat();
    };
    const leaveChat = () => {
      pauseMic();
      stopSpeaking();
      if (resources.current.stage !== "idle" && resources.current.stage !== "confirming") {
        release();
        changeStage("idle");
      }
    };
    document.addEventListener("visibilitychange", background);
    window.addEventListener("pagehide", leaveChat);
    return () => {
      document.removeEventListener("visibilitychange", background);
      window.removeEventListener("pagehide", leaveChat);
      closeMic();
      release();
      stopSpeaking();
      busyCallback.current(false);
    };
  }, [draft.id]);

  useEffect(() => {
    if (!open || draft.guided_cursor >= sequence.length) pauseMic();
  }, [open, draft.guided_cursor, sequence.length]);

  useEffect(() => {
    release();
    stopSpeaking();
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

  async function armMic() {
    const r = resources.current;
    const capture = r.capture;
    if (!question || !capture || r.armed || r.speech || r.stage !== "idle" || document.hidden) return;
    if (navigator.onLine === false) {
      pauseMic();
      reply("You're offline. Turn the mic on again when you're connected.");
      return;
    }
    const generation = ++r.generation;
    r.audioTurn = true;
    changeStage("opening");
    try {
      const binding = await bindTurn(draft, question.id, crypto.randomUUID());
      if (!isCurrent(generation)) return;
      if (!dialogRef.current?.open || r.speech) {
        r.audioTurn = false;
        changeStage("idle");
        return;
      }
      capture.listen(recording => {
        if (!isCurrent(generation) || !dialogRef.current?.open || !r.armed) return;
        pauseCapture();
        void checkAnswer(binding, recording, generation);
      });
      r.armed = true;
      setListening(true);
      changeStage("idle");
    } catch {
      if (!isCurrent(generation)) return;
      pauseMic();
      reply(RETRY);
    }
  }

  async function send(text: string, selected?: number) {
    if (!text || !canAnswer || !question || document.hidden || resources.current.stage !== "idle") return;
    release();
    stopSpeaking();
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
      // The updated draft resets this stage and opens the next question.
    } catch {
      if (contextRef.current !== context || resources.current.generation !== generation) return;
      setRetryOnly(true);
      reply("I couldn't confirm the score. Try confirming it again.");
      changeStage("idle");
    }
  }

  function cancelAnswer() {
    release();
    stopSpeaking();
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
  const stageMessage = stage === "confirming" ? "Saving score…" : "One moment…";
  const readyToListen = canAnswer && mic === "on" && !speaking && !answer && !pickScore;
  useEffect(() => {
    if (readyToListen) void armMic();
    else if (resources.current.armed) pauseCapture();
  }, [readyToListen, context, stage, listening]);

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
              <button type="button" className="ride-chat-replay" disabled={busy || !!proposal} onClick={() => questionPrompt && say(questionPrompt)}>
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
          {question && <div className="ride-chat-mic">
            <span className="ride-chat-mic-status" role="status" data-listening={listening}>
              {listening ? "Listening" : mic === "starting" ? "Connecting mic…" : mic === "on" ? "Mic paused" : "Mic off"}
            </span>
            <button type="button" className="btn ride-chat-control" disabled={mic === "off" && !canAnswer}
              onClick={() => mic === "off" ? void enableMic() : pauseMic()}>
              <ChatIcon name="mic" /> {mic === "off" ? "Turn on mic" : "Turn off mic"}
            </button>
          </div>}
          {complete ? <button type="button" className="btn btn-leather ride-chat-control" onClick={onReview}>Review scores and save</button> :
            proposal ? <div className="ride-chat-confirm">
              <button ref={confirmRef} type="button" className="btn btn-leather ride-chat-control" disabled={disabled || busy} onClick={() => void confirm()}>
                {stage === "confirming" ? "Confirming…" : retryOnly ? "Retry confirmation" : "Confirm score"}
              </button>
              <button type="button" className="btn ride-chat-control" disabled={disabled || busy || retryOnly} onClick={() => {
                release();
                stopSpeaking();
                setProposal(undefined);
                reply("Let's try that question again.");
              }}>Try again</button>
            </div> :
            <form onSubmit={submit} className="ride-chat-composer">
              <div className="ride-chat-input-row">
                <label className="sr-only" htmlFor={answerId}>Your answer</label>
                <input id={answerId} className="input ride-chat-input" placeholder="Type a score, e.g. +2" value={answer}
                  maxLength={MAX_ANSWER} readOnly={!canAnswer} onChange={event => {
                    if (event.target.value) pauseCapture();
                    setAnswer(event.target.value);
                  }} />
                <button type="submit" className="btn ride-chat-control" disabled={!canAnswer || !answer.trim()}>Send</button>
              </div>
              <div className="ride-chat-options">
                {busy ? <button type="button" className="ride-chat-replay" onClick={cancelAnswer}>Cancel answer</button> :
                  <button type="button" className="ride-chat-replay" disabled={!canAnswer} aria-expanded={pickScore}
                    onClick={() => {
                      if (!pickScore) pauseCapture();
                      setPickScore(selected => !selected);
                    }}>Pick a score</button>}
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

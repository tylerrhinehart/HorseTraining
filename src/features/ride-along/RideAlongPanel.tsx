import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import type { Question } from "../../supabase/types";
import { bindTurn, interpretConfirmation, interpretTurn, type RideDraft } from "./draftClient";
import { scoreReadback, type TurnBinding, type VoiceScore } from "./voiceCommand";
import type { VoiceCapture } from "./voiceCapture";
import type { VoiceCall } from "./useVoiceCall";
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
  microphone: VoiceCall;
  onBusy: (busy: boolean) => void;
  onConfirm: (proposal: VoiceScore, requestId: string) => Promise<void>;
}

type Stage = "idle" | "opening" | "thinking" | "confirming";
type Message = { author: "scorer" | "you"; text: string };

export default function RideAlongPanel({ draft, horseName, questions, open, disabled, returnFocus, onReview, onBusy, onConfirm, microphone }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [showControls, setShowControls] = useState(false);
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
  const logRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const answerId = useId();
  const resources = useRef<{
    generation: number; stage: Stage; audioTurn?: boolean; armed?: boolean;
    capture?: VoiceCapture; abort?: AbortController;
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

  function stopListening() {
    if (resources.current.audioTurn && resources.current.stage !== "confirming") {
      release();
      changeStage("idle");
    }
  }

  function muteMic() {
    stopListening();
    microphone.stop();
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
      stopListening();
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
      release();
      stopSpeaking();
      busyCallback.current(false);
    };
  }, [draft.id]);

  useEffect(() => {
    if (!open || draft.guided_cursor >= sequence.length) muteMic();
  }, [open, draft.guided_cursor, sequence.length]);

  useEffect(() => {
    if (microphone.state === "off" || microphone.state === "unavailable") stopListening();
    if (microphone.state === "unavailable") setShowControls(true);
  }, [microphone.state]);

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

  function propose(score: number, binding: TurnBinding, readAloud: boolean) {
    if (!question) return;
    const next = { questionId: question.id, label: question.text, score, binding };
    setProposal(next);
    reply(`I have ${formatScore(score)}. Say “yes” to confirm, or “try again.”`);
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

  const confirmationPrompt = "Say yes to confirm, or try again.";

  function retryScore() {
    if (retryOnly) {
      reply("The save is pending. Say yes to retry saving this score.", true);
      return;
    }
    release();
    stopSpeaking();
    setProposal(undefined);
    reply("Let's try that question again.", true);
  }

  async function checkConfirmation(proposed: VoiceScore, recording: Blob, generation: number) {
    const r = resources.current;
    changeStage("thinking");
    const abort = new AbortController();
    r.abort = abort;
    const timeout = window.setTimeout(() => abort.abort(), 20_000);
    try {
      const result = await interpretConfirmation(proposed.binding, recording, abort.signal);
      if (!isCurrent(generation)) return;
      if (result.transcript.trim()) append("you", result.transcript);
      changeStage("idle");
      if (result.command === "confirm") void confirm(result.transcript);
      else if (result.command === "retry") retryScore();
      else reply(`I didn't catch your confirmation. ${confirmationPrompt}`, true);
    } catch {
      if (isCurrent(generation)) {
        reply(`I couldn't check that confirmation. ${confirmationPrompt}`, true);
        changeStage("idle");
      }
    } finally {
      window.clearTimeout(timeout);
      if (isCurrent(generation)) r.abort = undefined;
    }
  }

  async function armMic() {
    const r = resources.current;
    const capture = microphone.capture;
    if (!question || !capture || r.armed || r.speech || r.stage !== "idle" || document.hidden) return;
    if (navigator.onLine === false) {
      muteMic();
      reply("You're offline. Unmute when you're connected.");
      return;
    }
    const generation = ++r.generation;
    r.capture = capture;
    r.audioTurn = true;
    changeStage("opening");
    try {
      // Confirmation belongs to the same proposal turn, so don't replace its binding.
      const binding = proposal?.binding ?? await bindTurn(draft, question.id, crypto.randomUUID());
      if (!isCurrent(generation)) return;
      if (!dialogRef.current?.open || r.speech) {
        r.audioTurn = false;
        changeStage("idle");
        return;
      }
      capture.listen(recording => {
        if (!isCurrent(generation) || !dialogRef.current?.open || !r.armed) return;
        pauseCapture();
        if (proposal) void checkConfirmation(proposal, recording, generation);
        else void checkAnswer(binding, recording, generation);
      });
      r.armed = true;
      setListening(true);
      changeStage("idle");
    } catch {
      if (!isCurrent(generation)) return;
      muteMic();
      setShowControls(true);
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

  async function confirm(spoken?: string) {
    if (disabled || !proposal || resources.current.stage !== "idle") return;
    // Cancel any queued microphone response before the durable write.
    release();
    const generation = resources.current.generation;
    stopSpeaking();
    changeStage("confirming");
    try {
      await onConfirm(proposal, proposal.binding.turn_id);
      const exchange: Message[] = spoken?.trim() ? [...messages, { author: "you", text: spoken }] : messages;
      setConfirmedMessages(previous => ({ ...previous, [proposal.questionId]: exchange }));
      // The updated draft resets this stage and opens the next question.
    } catch {
      if (contextRef.current !== context || resources.current.generation !== generation) return;
      setRetryOnly(true);
      setShowControls(true);
      reply("I couldn't confirm the score. Say yes again, or choose Retry confirmation.");
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

  const canConverse = open && !disabled && !!question && stage === "idle";
  const canAnswer = canConverse && !proposal;
  const complete = draft.guided_cursor >= sequence.length;
  const busy = stage !== "idle";
  const stageMessage = stage === "confirming" ? "Saving score…" : "One moment…";
  const readyToListen = canConverse && microphone.state === "on" && !speaking && (!showControls || (!answer && !pickScore));
  const micStatus = listening ? (proposal ? "Listening for confirmation" : "Listening for your score")
    : microphone.state === "starting" ? "Connecting…"
    : microphone.state === "unavailable" ? "Microphone unavailable"
    : microphone.state === "off" ? "Microphone muted"
    : speaking ? "Scorer speaking"
    : stage === "confirming" ? "Saving score…"
    : stage === "thinking" ? "Checking your reply…" : "Mic connected";
  useEffect(() => {
    if (readyToListen) void armMic();
    else if (resources.current.armed) pauseCapture();
  }, [readyToListen, context, stage, listening, proposal]);

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
              <button type="button" className="ride-chat-replay" disabled={busy} onClick={() => {
                const prompt = proposal ? scoreReadback(proposal) : questionPrompt;
                if (prompt) say(prompt);
              }}>
                <ChatIcon name="speaker" /> Repeat
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
          {complete ? (
            <button type="button" className="btn btn-leather ride-chat-control" onClick={onReview}>Review scores and save</button>
          ) : question && <>
            <div className="ride-chat-call">
              <button type="button" className="btn ride-chat-control ride-chat-mute"
                data-muted={microphone.state === "off" || microphone.state === "unavailable"}
                disabled={!canConverse && microphone.state !== "on" && microphone.state !== "starting"}
                onClick={() => microphone.state === "on" || microphone.state === "starting" ? muteMic() : microphone.start()}>
                <ChatIcon name="mic" /> {microphone.state === "on" || microphone.state === "starting" ? "Mute" : "Unmute"}
              </button>
              <div className="ride-chat-call-text">
                <span className="ride-chat-mic-status" role="status" data-listening={listening}>{micStatus}</span>
                {proposal && <span className="ride-chat-command">Say “yes” or “try again.”</span>}
              </div>
              <button type="button" className="ride-chat-replay ride-chat-manual" aria-expanded={showControls}
                onClick={() => setShowControls(current => !current)}>{showControls ? "Hide controls" : "Manual controls"}</button>
            </div>
            {showControls && (proposal ? <div className="ride-chat-confirm">
              <button type="button" className="btn btn-leather ride-chat-control" disabled={!canConverse} onClick={() => void confirm()}>
                {stage === "confirming" ? "Confirming…" : retryOnly ? "Retry confirmation" : "Confirm score"}
              </button>
              <button type="button" className="btn ride-chat-control" disabled={!canConverse || retryOnly}
                onClick={retryScore}>Try again</button>
            </div> : <form onSubmit={submit} className="ride-chat-composer">
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
            </form>)}
          </>}
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

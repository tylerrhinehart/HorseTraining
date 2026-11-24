import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { RIDE_READBACK_TEXT, rideQuestionPrompt } from "../../../supabase/functions/_shared/ridePrompts";
import type { Question } from "../../supabase/types";
import { bindTurn, interpretTurn, type RideDraft } from "./draftClient";
import { useRideReadback, type RideReadbackRequest } from "./rideReadback";
import type { TurnBinding, VoiceScore } from "./voiceCommand";
import type { VoiceCapture } from "./voiceCapture";
import type { VoiceCall } from "./useVoiceCall";
import { parseWrittenRideScore } from "./writtenScore";
import "./rideAlong.css";

const MAX_ANSWER = 200;
const SCORE_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];
const SCORE_NAMES = ["minus three", "minus two", "minus one", "zero", "plus one", "plus two", "plus three"];
const INVALID_SCORE = "Give me one score, like 3, −1, or 0.";
const SAVE_RETRY = "I couldn't verify that save. Retry the save or review and reload the draft.";
const BIND_RETRY = "I couldn't prepare this question. Try again or reload the saved draft.";
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
  onRecord: (score: VoiceScore, requestId: string) => Promise<void>;
}

type Stage = "idle" | "thinking" | "saving" | "retry";
type Feedback = { answer?: string; text: string };
interface TurnResources {
  generation: number;
  stage: Stage;
  armed: boolean;
  arming: boolean;
  capture?: VoiceCapture;
  abort?: AbortController;
  binding?: { context: string; result: Promise<TurnBinding> };
}

export default function RideAlongPanel({ draft, horseName, questions, open, disabled, returnFocus, onReview, onBusy, onRecord, microphone }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [listening, setListening] = useState(false);
  const [pendingScore, setPendingScore] = useState<VoiceScore>();
  const [feedback, setFeedback] = useState<Feedback>();
  const [answer, setAnswer] = useState("");
  const [completedReadbacks, setCompletedReadbacks] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const answerId = useId();
  const resources = useRef<TurnResources>({ generation: 0, stage: "idle", arming: false, armed: false });
  const busyCallback = useRef(onBusy);
  busyCallback.current = onBusy;

  const sequence = draft.guided_question_ids ?? questions.filter(q => q.axis === "foundation")
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)).map(q => q.id);
  const question = questions.find(q => q.id === sequence[draft.guided_cursor]);
  const complete = draft.guided_cursor >= sequence.length;
  const authoredPrompt = question && rideQuestionPrompt(question.text);
  const prompt = authoredPrompt ?? question?.text;
  const context = `${draft.id}:${draft.version}:${question?.id ?? "done"}`;
  const contextRef = useRef(context);
  contextRef.current = context;
  const mounted = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const wasOpen = useRef(false);

  const voiceOn = microphone.state === "on" || microphone.state === "starting";
  const { state: readbackState, isActive: isReadbackActive, speak, stop: stopReadback } =
    useRideReadback(open && microphone.state === "on", microphone.capture?.playReadback);

  function changeStage(next: Stage) {
    resources.current.stage = next;
    setStage(next);
    busyCallback.current(next === "saving");
  }

  function pauseCapture() {
    const turn = resources.current;
    if (turn.armed) turn.capture?.pause();
    turn.armed = false;
    setListening(false);
  }

  function cancelVoiceTurn() {
    const turn = resources.current;
    ++turn.generation;
    turn.arming = false;
    pauseCapture();
    turn.abort?.abort();
    turn.abort = undefined;
    if (turn.stage === "thinking") changeStage("idle");
  }

  function stopVoice() {
    cancelVoiceTurn();
    stopReadback();
  }

  function mute() {
    stopVoice();
    microphone.stop();
  }

  function isCurrent(generation: number) {
    return mounted.current && resources.current.generation === generation && contextRef.current === context && openRef.current && !document.hidden;
  }

  function read(kind: RideReadbackRequest["kind"], text: string, useProvider = true) {
    if (microphone.state !== "on" || !open || document.hidden) return Promise.resolve();
    pauseCapture();
    const reference = { draftId: draft.id, version: draft.version };
    const request: RideReadbackRequest | null = !useProvider ? null : kind === "complete" ?
      { ...reference, kind, questionId: null } : question ? { ...reference, kind, questionId: question.id } : null;
    return speak(request, text).finally(() => {
      // An immediate failure may batch the requesting and idle states into one render.
      if (mounted.current && contextRef.current === context) setCompletedReadbacks(count => count + 1);
    });
  }

  function getBinding(questionId: string) {
    const turn = resources.current;
    if (turn.binding?.context === context) return turn.binding.result;
    // A click or submit can reuse the reservation while the mic is arming.
    // Two concurrent bind RPCs for the same question could invalidate each other.
    const result = bindTurn(draft, questionId, crypto.randomUUID());
    turn.binding = { context, result };
    const clearReservation = () => {
      if (turn.binding?.result === result) turn.binding = undefined;
    };
    void result.then(clearReservation, clearReservation);
    return result;
  }

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

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
    const background = () => { if (document.hidden) stopVoice(); };
    document.addEventListener("visibilitychange", background);
    window.addEventListener("pagehide", stopVoice);
    return () => {
      document.removeEventListener("visibilitychange", background);
      window.removeEventListener("pagehide", stopVoice);
      stopVoice();
      busyCallback.current(false);
    };
  }, [draft.id, stopReadback]);

  useLayoutEffect(() => {
    stopVoice();
    resources.current.binding = undefined;
    changeStage("idle");
    setPendingScore(undefined);
    setFeedback(undefined);
    setAnswer("");
  }, [context]);

  useLayoutEffect(() => {
    if (!open && wasOpen.current) mute();
    else if (!open || !voiceOn) stopVoice();
    wasOpen.current = open;
  }, [open, voiceOn]);

  useEffect(() => {
    if (!open || microphone.state !== "on") return;
    if (resources.current.stage === "saving" || resources.current.stage === "retry") return;
    if (prompt) void read("question", prompt, Boolean(authoredPrompt));
    else if (complete) {
      const generation = resources.current.generation;
      void read("complete", RIDE_READBACK_TEXT.complete).finally(() => {
        if (isCurrent(generation)) mute();
      });
    }
  }, [open, context, prompt, authoredPrompt, complete, microphone.state, speak]);

  useEffect(() => {
    const log = logRef.current;
    if (open && log) log.scrollTop = log.scrollHeight;
  }, [open, context, feedback, stage, pendingScore]);

  async function writeScore(score: VoiceScore) {
    changeStage("saving");
    setPendingScore(score);
    try {
      // The draft RPC stores the rating and advances its cursor in one transaction.
      // The new draft is the only signal to advance the chat.
      await onRecord(score, score.binding.turn_id);
    } catch {
      if (!mounted.current || contextRef.current !== context) return;
      changeStage("retry");
      setFeedback({ text: SAVE_RETRY });
    }
  }

  async function checkRecording(binding: TurnBinding, recording: Blob, generation: number) {
    const turn = resources.current;
    const abort = new AbortController();
    turn.abort = abort;
    changeStage("thinking");
    setFeedback(undefined);
    const timeout = window.setTimeout(() => abort.abort(), 20_000);
    try {
      const result = await interpretTurn(binding, recording, abort.signal);
      if (!isCurrent(generation) || abort.signal.aborted) return;
      if (result.score === null) {
        setFeedback({ answer: result.transcript.trim(), text: RIDE_READBACK_TEXT.clarification });
        void read("clarification", RIDE_READBACK_TEXT.clarification);
      } else if (question) {
        stopVoice();
        void writeScore({ questionId: question.id, score: result.score, binding });
      }
    } catch {
      if (!isCurrent(generation)) return;
      setFeedback({ text: RIDE_READBACK_TEXT.retry });
      void read("retry", RIDE_READBACK_TEXT.retry);
    } finally {
      window.clearTimeout(timeout);
      if (isCurrent(generation)) {
        turn.abort = undefined;
        changeStage("idle");
      }
    }
  }

  async function armMic() {
    const turn = resources.current;
    const capture = microphone.capture;
    if (!question || !capture || turn.armed || turn.arming || isReadbackActive() ||
        turn.stage !== "idle" || document.hidden) return;
    if (navigator.onLine === false) {
      mute();
      setFeedback({ text: "You're offline. Turn voice back on when you're connected." });
      return;
    }
    const generation = ++turn.generation;
    turn.arming = true;
    turn.capture = capture;
    try {
      const binding = await getBinding(question.id);
      if (!isCurrent(generation)) return;
      turn.arming = false;
      if (!dialogRef.current?.open || isReadbackActive() || turn.stage !== "idle") return;
      turn.armed = true;
      capture.listen(recording => {
        if (!isCurrent(generation) || !turn.armed || isReadbackActive()) return;
        pauseCapture();
        void checkRecording(binding, recording, generation);
      });
      setListening(turn.armed);
    } catch {
      if (!isCurrent(generation)) return;
      mute();
      setFeedback({ text: BIND_RETRY });
    }
  }

  async function enterScore(score: number) {
    const turn = resources.current;
    if (!open || disabled || !question || document.hidden || turn.stage === "saving" || turn.stage === "retry") return;
    stopVoice();
    changeStage("saving");
    setFeedback(undefined);
    let binding: TurnBinding;
    try {
      binding = await getBinding(question.id);
    } catch {
      if (!mounted.current || contextRef.current !== context) return;
      setFeedback({ text: BIND_RETRY });
      changeStage("idle");
      return;
    }
    if (!mounted.current || contextRef.current !== context) return;
    if (!openRef.current) {
      changeStage("idle");
      return;
    }
    setAnswer(current => current === answer ? "" : current);
    await writeScore({ questionId: question.id, score, binding });
  }

  function retrySave() {
    if (disabled || !pendingScore || resources.current.stage !== "retry") return;
    setFeedback(undefined);
    void writeScore(pendingScore);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = answer.trim();
    if (!text || !open || disabled || !question || document.hidden ||
        resources.current.stage === "saving" || resources.current.stage === "retry") return;
    const score = answer.length <= MAX_ANSWER ? parseWrittenRideScore(text) : null;
    if (score !== null) void enterScore(score);
    else {
      stopVoice();
      setAnswer("");
      setFeedback({ answer: text.slice(0, MAX_ANSWER), text: INVALID_SCORE });
    }
  }

  const saving = stage === "saving";
  const canScore = open && !disabled && Boolean(question) && !saving && stage !== "retry";
  const readyToListen = canScore && !answer.trim() && stage === "idle" &&
    microphone.state === "on" && readbackState === "idle";
  useEffect(() => {
    if (readyToListen) void armMic();
    else if (resources.current.armed) pauseCapture();
  }, [readyToListen, context, listening, completedReadbacks]);

  const micStatus = microphone.state === "starting" ? "Connecting…" :
    microphone.state === "unavailable" ? "Microphone unavailable" :
    !voiceOn ? "Voice off" :
    readbackState === "playing" ? "Scorer speaking…" :
    readbackState === "requesting" ? "Loading readback…" :
    listening ? "Listening for a score" :
    stage === "thinking" ? "Checking your reply…" : "Voice on";
  const reviewRide = () => {
    mute();
    onReview();
  };

  return (
    <dialog className="ride-chat" ref={dialogRef} aria-labelledby={titleId} onCancel={event => {
      event.preventDefault();
      if (!saving) reviewRide();
    }}>
      <div className="ride-chat-layout">
        <aside className="ride-chat-rail" aria-label="Ride progress">
          <p className="ride-chat-eyebrow">Training ride</p>
          <h2>{horseName}</h2>
          <p>Foundation · Phase 1</p>
          <div className="ride-chat-progress">
            <div><span>Foundation questions</span><b>{draft.guided_cursor} of {sequence.length} scored</b></div>
            <div className="ride-chat-progress-track" role="progressbar" aria-label="Foundation questions scored"
              aria-valuemin={0} aria-valuemax={Math.max(1, sequence.length)} aria-valuenow={draft.guided_cursor}>
              <span style={{ width: `${sequence.length ? draft.guided_cursor * 100 / sequence.length : 0}%` }} />
            </div>
          </div>
          <ol className="ride-chat-question-list">
            {sequence.map((id, index) => {
              const item = questions.find(candidate => candidate.id === id);
              const rating = draft.ratings.find(candidate => candidate.question_id === id);
              const current = index === draft.guided_cursor;
              const recorded = index < draft.guided_cursor && rating;
              return <li key={id} data-state={current ? "current" : recorded ? "done" : "upcoming"} aria-current={current ? "step" : undefined}>
                <span className="ride-chat-item-mark" aria-hidden="true">{recorded ? "✓" : current ? "•" : "·"}</span>
                <span className="ride-chat-item-label">{item?.text ?? "Foundation question"}</span>
                {recorded && <span className="ride-chat-item-score">{formatScore(rating.score)}</span>}
              </li>;
            })}
          </ol>
        </aside>

        <section className="ride-chat-main" aria-labelledby={titleId}>
          <header className="ride-chat-header">
            <div className="ride-chat-heading">
              <ChatAvatar large />
              <div>
                <h2 ref={headingRef} id={titleId} tabIndex={-1}>Ride-along scorer</h2>
                <p>{horseName} · Foundation Phase 1</p>
              </div>
            </div>
            <div className="ride-chat-header-actions">
              <span className="ride-chat-counter">{complete ? `${sequence.length} of ${sequence.length} complete` :
                `Question ${draft.guided_cursor + 1} of ${sequence.length}`}</span>
              {question && <button type="button" className="ride-chat-review" disabled={saving} onClick={reviewRide}>Review ride</button>}
            </div>
          </header>

          <div className="ride-chat-feed" ref={logRef} role="log" aria-label="Scoring conversation" aria-live="polite" tabIndex={0}>
            <div className="ride-chat-messages">
              <ScorerBubble>I’ll ask one question at a time. Say, type, or tap a score.</ScorerBubble>
              {sequence.slice(0, draft.guided_cursor).map(id => {
                const previous = questions.find(item => item.id === id);
                const rating = draft.ratings.find(item => item.question_id === id);
                if (!previous || !rating) return null;
                return <div key={id} className="ride-chat-history">
                  <ScorerBubble>{rideQuestionPrompt(previous.text) ?? previous.text}</ScorerBubble>
                  <UserBubble text={formatScore(rating.score)} score receipt="✓ Recorded" />
                </div>;
              })}
              {question && <div className="ride-chat-turn">
                <ChatAvatar />
                <article className="ride-chat-question">
                  <div className="ride-chat-question-body">
                    <p className="ride-chat-eyebrow">Foundation</p>
                    <h3>{prompt}</h3>
                  </div>
                  <div className="ride-chat-score-area">
                    <p>Choose a score</p>
                    <div className="ride-chat-score-options" role="group" aria-label="Choose a score">
                      {SCORE_OPTIONS.map((score, index) => <button key={score} type="button" className="ride-chat-score"
                        data-tone={score < 0 ? "negative" : score > 0 ? "positive" : "neutral"} aria-label={`Record ${SCORE_NAMES[index]}`}
                        disabled={!canScore} onClick={() => {
                          logRef.current?.focus({ preventScroll: true });
                          void enterScore(score);
                        }}>{formatScore(score)}</button>)}
                    </div>
                  </div>
                </article>
              </div>}
              {pendingScore && <UserBubble text={formatScore(pendingScore.score)} score receipt={saving ? "Saving…" : "Save pending"} />}
              {saving && !pendingScore && <ScorerBubble>Saving score…</ScorerBubble>}
              {feedback?.answer && <UserBubble text={feedback.answer} />}
              {feedback && <ScorerBubble>{feedback.text}</ScorerBubble>}
              {stage === "retry" && <div className="ride-chat-retry">
                <button type="button" className="ride-chat-review" disabled={disabled} onClick={retrySave}>Retry save</button>
              </div>}
              {stage === "thinking" && <ScorerBubble>Checking your reply…</ScorerBubble>}
              {complete && <ScorerBubble>{RIDE_READBACK_TEXT.complete}</ScorerBubble>}
              {!complete && !question && <ScorerBubble>This question is unavailable. You can still review the ride.</ScorerBubble>}
            </div>
          </div>

          <footer className="ride-chat-footer">
            {complete || !question ? <button type="button" className="ride-chat-review" onClick={reviewRide}>Review scores and save</button> :
              <form onSubmit={submit} className="ride-chat-composer">
                <button type="button" className="ride-chat-mic" aria-label="Microphone and readback" aria-pressed={voiceOn}
                  title={voiceOn ? "Turn microphone and readback off" : "Turn microphone and readback on"}
                  data-muted={!voiceOn} onClick={() => voiceOn ? mute() : microphone.start()}>
                  <ChatIcon name="mic" muted={!voiceOn} />
                </button>
                <div className="ride-chat-input-row">
                  <label className="sr-only" htmlFor={answerId}>Type a message</label>
                  <input id={answerId} className="ride-chat-input" placeholder="Type a score or reply…" value={answer}
                    maxLength={MAX_ANSWER + 1} autoComplete="off" onChange={event => {
                      if (event.target.value.trim()) cancelVoiceTurn();
                      setAnswer(event.target.value);
                    }} />
                  <button type="submit" className="ride-chat-send" aria-label="Send message" disabled={!canScore || !answer.trim()}>
                    <ChatIcon name="send" />
                  </button>
                </div>
                <span className="ride-chat-mic-status" role="status" data-active={voiceOn}>{micStatus}</span>
              </form>}
          </footer>
        </section>
      </div>
    </dialog>
  );
}

function ChatAvatar({ large = false }: { large?: boolean }) {
  return <span aria-hidden="true" className={large ? "ride-chat-avatar ride-chat-avatar-large" : "ride-chat-avatar"}>
    <span className="ride-chat-wave"><i /><i /><i /><i /><i /></span>
  </span>;
}

function ScorerBubble({ children }: { children: string }) {
  return <div className="ride-chat-turn">
    <ChatAvatar /><p className="ride-chat-bubble">{children}</p>
  </div>;
}

function UserBubble({ text, score, receipt }: { text: string; score?: boolean; receipt?: string }) {
  return <div className="ride-chat-turn ride-chat-turn-you">
    <p className="ride-chat-bubble">{score ? <span className="ride-chat-score-value">{text}</span> : text}</p>
    {receipt && <span className="ride-chat-receipt">{receipt}</span>}
  </div>;
}

function ChatIcon({ name, muted = false }: { name: "mic" | "send"; muted?: boolean }) {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {name === "send" ? <path d="M12 19V5m-6 6 6-6 6 6" /> : <>
      <path d="M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V6Zm-3 5v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6" />
      {muted && <path d="m3 3 18 18" />}
    </>}
  </svg>;
}

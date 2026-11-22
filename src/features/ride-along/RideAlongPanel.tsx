import { useEffect, useRef, useState } from "react";
import type { Question } from "../../supabase/types";
import { bindTurn, transcribeTurn, type RideDraft } from "./draftClient";
import { scoreReadback, type VoiceScore } from "./voiceCommand";

const LIMIT_MS = 8000;
const MAX_CLIP_BYTES = 512 * 1024;
interface Props {
  draft: RideDraft;
  questions: Question[];
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onConfirm: (proposal: VoiceScore, requestId: string) => Promise<void>;
}
type Stage = "idle" | "starting" | "recording" | "transcribing" | "confirming";
const stopTracks = (stream: MediaStream | null) => stream?.getTracks().forEach(track => track.stop());

export default function RideAlongPanel({ draft, questions, disabled, onBusy, onConfirm }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [proposal, setProposal] = useState<{ score: VoiceScore; turn: string }>();
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [manualScore, setManualScore] = useState("");
  const [retryOnly, setRetryOnly] = useState(false);
  const resources = useRef<{
    generation: number; stage: Stage; timer?: number; recorder?: MediaRecorder;
    stream: MediaStream | null; abort?: AbortController; speech?: SpeechSynthesisUtterance;
  }>({ generation: 0, stage: "idle", stream: null });
  const busyCallback = useRef(onBusy);
  busyCallback.current = onBusy;
  const sequence = draft.guided_question_ids ?? questions.filter(q => q.axis === "foundation").sort((a,b) => a.position-b.position || a.id.localeCompare(b.id)).map(q => q.id);
  const question = questions.find(q => q.id === sequence[draft.guided_cursor]);
  const context = `${draft.id}:${draft.version}:${question?.id ?? "done"}`;
  const contextRef = useRef(context);
  contextRef.current = context;

  function speak(text: string) {
    if (typeof SpeechSynthesisUtterance === "undefined" || !window.speechSynthesis) return;
    try {
      const voice = window.speechSynthesis.getVoices().find(v => v.localService && v.lang.startsWith("en"));
      if (!voice) return; // Text is always available; never use a remote voice.
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice; utterance.lang = "en-US";
      resources.current.speech = utterance;
      window.speechSynthesis.speak(utterance);
    } catch { /* Visible question/readback remains. */ }
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
    if (r.speech) window.speechSynthesis?.cancel();
    r.recorder = undefined;
    r.stream = null;
    r.abort = undefined;
    r.speech = undefined;
  }

  useEffect(() => {
    const background = () => {
      if (!document.hidden || resources.current.stage === "confirming") return;
      release();
      changeStage("idle");
      setProposal(undefined);
      setTranscript("");
      setRetryOnly(false);
      setMessage("Voice recording stopped when the app went into the background.");
    };
    document.addEventListener("visibilitychange", background);
    return () => {
      document.removeEventListener("visibilitychange", background);
      release();
      busyCallback.current(false);
    };
  }, [draft.id]);

  useEffect(() => {
    release(); changeStage("idle"); setProposal(undefined); setTranscript(""); setRetryOnly(false); setManualScore("");
    if (question) speak(`${question.text}. What signed score, minus three to plus three, or zero?`);
  }, [context]);

  async function start() {
    if (disabled || !question || resources.current.stage !== "idle" || proposal || document.hidden) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Voice recording is unavailable on this device. Enter scores manually.");
      return;
    }
    release();
    if (navigator.onLine === false) {
      setMessage("Voice needs an internet connection. Enter scores manually.");
      return;
    }
    const r = resources.current;
    const generation = r.generation;
    setMessage("");
    setTranscript("");
    changeStage("starting");
    try {
      const capturedContext = context;
      const turn = crypto.randomUUID();
      const binding = await bindTurn(draft, question.id, turn);
      if (r.generation !== generation || contextRef.current !== capturedContext || document.hidden) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (r.generation !== generation || document.hidden) {
        stopTracks(stream);
        return;
      }
      r.stream = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error();
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      const chunks: Blob[] = [];
      r.recorder = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onerror = () => {
        if (r.generation !== generation) return;
        release(); changeStage("idle"); setMessage("Recording failed. Try again or enter the score manually.");
      };
      recorder.onstop = async () => {
        stopTracks(stream);
        if (r.generation !== generation) return;
        r.stream = null;
        window.clearTimeout(r.timer);
        const clip = new Blob(chunks, { type: mimeType });
        chunks.length = 0;
        if (!clip.size || clip.size > MAX_CLIP_BYTES) {
          changeStage("idle");
          setMessage("Couldn't use this clip. Try a short score or enter it manually.");
          return;
        }
        changeStage("transcribing");
        const abort = new AbortController();
        r.abort = abort;
        const timeout = window.setTimeout(() => abort.abort(), 20000);
        try {
          const result = await transcribeTurn(binding, clip, abort.signal);
          if (r.generation !== generation) return;
          setTranscript(result.transcript);
          if (result.score === null) {
            setMessage("Please answer this same question with one explicit signed score, like “plus two”, or enter it manually.");
            return;
          }
          const score: VoiceScore = { questionId: question.id, label: question.text, score: result.score, binding };
          setProposal({ score, turn });
          speak(scoreReadback(score));
        } catch (err) {
          if (r.generation === generation)
            setMessage(err instanceof Error ? err.message : "Couldn't transcribe this clip.");
        } finally {
          window.clearTimeout(timeout);
          if (r.generation === generation) {
            r.abort = undefined;
            changeStage("idle");
          }
        }
      };
      recorder.start();
      changeStage("recording");
      r.timer = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, LIMIT_MS);
    } catch (err) {
      if (r.generation !== generation) return;
      release(); changeStage("idle");
      setMessage(err instanceof Error ? err.message : "Microphone access isn't available. You can still enter scores manually.");
    }
  }

  async function confirm() {
    if (disabled || !proposal || resources.current.stage !== "idle") return;
    const generation = resources.current.generation;
    if (resources.current.speech) window.speechSynthesis?.cancel();
    changeStage("confirming");
    setMessage("");
    try {
      await onConfirm(proposal.score, proposal.turn);
      if (resources.current.generation !== generation) return;
      setProposal(undefined);
      setTranscript("");
      setRetryOnly(false);
      setMessage("Score confirmed in the ride draft.");
    } catch (err) {
      if (resources.current.generation !== generation) return;
      setRetryOnly(true);
      setMessage(err instanceof Error ? err.message : "Couldn't confirm this score.");
    } finally {
      if (resources.current.generation === generation) changeStage("idle");
    }
  }

  return <section className="card space-y-2" aria-label="Ride-along voice scoring">
    <h2 className="card-title">Voice scoring · Phase 1 pilot</h2>
    <p className="muted">Use only when stopped and safe. The mic is off between clips. Clips last up to eight seconds and are sent to OpenAI for transcription, then the transcript is sent to TypeSafe Jev to interpret your explicit score. Check the readback before confirming. Manual scoring remains available.</p>
    {question ? <p aria-live="polite"><strong>Question {draft.guided_cursor + 1} of {sequence.length}: {question.text}</strong><br />What signed score, minus three to plus three, or zero?</p> : <p role="status">Guided questions complete. Review the sheet and choose Save ride when ready.</p>}
    {question && <button type="button" className="btn btn-ghost" disabled={stage !== "idle" || !!proposal} onClick={() => speak(`${question.text}. What signed score?`)}>Read current question</button>}
    {stage === "recording" ? <>
      <button type="button" className="btn btn-leather" onClick={() => {
        const recorder = resources.current.recorder;
        if (recorder?.state === "recording") recorder.stop();
      }}>Stop and transcribe</button>
      <button type="button" className="btn btn-ghost" onClick={() => {
        release(); changeStage("idle"); setMessage("Recording discarded.");
      }}>Cancel clip</button>
    </> : <button type="button" className="btn btn-leather" disabled={disabled || !question || stage !== "idle" || !!proposal}
      onClick={() => void start()}>{stage === "starting" ? "Opening microphone…" : stage === "transcribing" ? "Transcribing…" : "Record a score"}</button>}
    {stage === "starting" && <button type="button" className="btn btn-ghost" onClick={() => {
      release(); changeStage("idle"); setMessage("Microphone setup canceled.");
    }}>Cancel microphone setup</button>}
    {stage === "transcribing" && <button type="button" className="btn btn-ghost" onClick={() => {
      release(); changeStage("idle"); setMessage("Transcription canceled.");
    }}>Cancel transcription</button>}
    {question && !proposal && <div>
      <label>Manual score for current question <select value={manualScore} disabled={disabled || stage !== "idle"} onChange={e => setManualScore(e.target.value)}>
        <option value="">Choose a score</option>{[-3,-2,-1,0,1,2,3].map(n => <option key={n} value={n}>{n > 0 ? `+${n}` : n}</option>)}
      </select></label>
      <button type="button" className="btn btn-ghost" disabled={disabled || stage !== "idle" || manualScore === ""} onClick={() => {
        const generation = resources.current.generation;
        changeStage("starting");
        const turn = crypto.randomUUID();
        void bindTurn(draft, question.id, turn).then(binding => {
          if (resources.current.generation !== generation) return;
          const score = { questionId: question.id, label: question.text, score: Number(manualScore), binding };
          setProposal({ score, turn }); speak(scoreReadback(score));
        }).catch(() => { if (resources.current.generation === generation) setMessage("Couldn't prepare manual confirmation. Reload the saved draft."); })
          .finally(() => { if (resources.current.generation === generation) changeStage("idle"); });
      }}>Review manual score</button>
    </div>}
    {transcript && <p>Heard: “{transcript}”</p>}
    {proposal && <div>
      <p aria-live="polite">{scoreReadback(proposal.score)}</p>
      <button type="button" className="btn btn-leather" disabled={disabled || stage !== "idle"} onClick={() => void confirm()}>
        {stage === "confirming" ? "Confirming…" : retryOnly ? "Retry confirmation" : "Confirm score"}
      </button>
      <button type="button" className="btn btn-ghost" disabled={disabled || stage !== "idle" || retryOnly} onClick={() => {
        release(); setProposal(undefined); setTranscript(""); setMessage("Proposed score discarded.");
      }}>Discard proposal</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}

import { useEffect, useRef, useState } from "react";
import type { Question } from "../../supabase/types";
import { transcribeTurn } from "./draftClient";
import { parseVoiceScore, scoreReadback, type VoiceScore } from "./voiceCommand";

const LIMIT_MS = 8000;
const MAX_CLIP_BYTES = 512 * 1024;
interface Props {
  draftId: string;
  questions: Question[];
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onConfirm: (proposal: VoiceScore, requestId: string) => Promise<void>;
}
type Stage = "idle" | "starting" | "recording" | "transcribing" | "confirming";
const stopTracks = (stream: MediaStream | null) => stream?.getTracks().forEach(track => track.stop());

export default function RideAlongPanel({ draftId, questions, disabled, onBusy, onConfirm }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [proposal, setProposal] = useState<{ score: VoiceScore; turn: string }>();
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [retryOnly, setRetryOnly] = useState(false);
  const resources = useRef<{
    generation: number; stage: Stage; timer?: number; recorder?: MediaRecorder;
    stream: MediaStream | null; abort?: AbortController; speech?: SpeechSynthesisUtterance;
  }>({ generation: 0, stage: "idle", stream: null });
  const busyCallback = useRef(onBusy);
  busyCallback.current = onBusy;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

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
  }, [draftId]);

  async function start() {
    if (disabled || resources.current.stage !== "idle" || proposal || document.hidden) return;
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
      const turn = crypto.randomUUID();
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
          const heard = await transcribeTurn(draftId, turn, clip, abort.signal);
          if (r.generation !== generation) return;
          setTranscript(heard);
          const score = parseVoiceScore(heard, questionsRef.current);
          if (!score) {
            setMessage("Try one Phase 1 Foundation item and a signed score, like “Doubling, plus two.”");
            return;
          }
          setProposal({ score, turn });
          if (typeof SpeechSynthesisUtterance !== "undefined" && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(scoreReadback(score));
            utterance.lang = "en-US";
            try {
              const localVoice = window.speechSynthesis.getVoices().find(v => v.localService && v.lang.startsWith("en"));
              if (localVoice) {
                utterance.voice = localVoice;
                r.speech = utterance;
                window.speechSynthesis.speak(utterance);
              }
            } catch { /* Visual readback remains. */ }
          }
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
    } catch {
      if (r.generation !== generation) return;
      release(); changeStage("idle");
      setMessage("Microphone access isn't available. You can still enter scores manually.");
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
    <p className="muted">Use only when stopped and safe. The mic is off between clips. Clips last up to eight seconds and are sent to OpenAI for transcription. Check the readback before confirming. Manual scoring remains available.</p>
    {stage === "recording" ? <>
      <button type="button" className="btn btn-leather" onClick={() => {
        const recorder = resources.current.recorder;
        if (recorder?.state === "recording") recorder.stop();
      }}>Stop and transcribe</button>
      <button type="button" className="btn btn-ghost" onClick={() => {
        release(); changeStage("idle"); setMessage("Recording discarded.");
      }}>Cancel clip</button>
    </> : <button type="button" className="btn btn-leather" disabled={disabled || stage !== "idle" || !!proposal}
      onClick={() => void start()}>{stage === "starting" ? "Opening microphone…" : stage === "transcribing" ? "Transcribing…" : "Record a score"}</button>}
    {stage === "starting" && <button type="button" className="btn btn-ghost" onClick={() => {
      release(); changeStage("idle"); setMessage("Microphone setup canceled.");
    }}>Cancel microphone setup</button>}
    {stage === "transcribing" && <button type="button" className="btn btn-ghost" onClick={() => {
      release(); changeStage("idle"); setMessage("Transcription canceled.");
    }}>Cancel transcription</button>}
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

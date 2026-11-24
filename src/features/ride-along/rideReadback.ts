import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { captureFacilityScope } from "../../supabase/facilityScope";
import type { RideSummaryPrompt } from "../../../supabase/functions/_shared/ridePrompts";

export type RideReadbackRequest = {
  draftId: string;
  version: number;
} & (
  | { kind: "question" | "clarification" | "retry"; questionId: string }
  | { kind: RideSummaryPrompt; questionId: null }
);

export type RideAudioPlayer = (audio: ArrayBuffer, signal: AbortSignal, onPlaying: () => void) => Promise<void>;

const REQUEST_TIMEOUT = 12_000;
const PLAYBACK_TIMEOUT = 25_000;
const ECHO_TAIL = 250;
const MAX_AUDIO_BYTES = 512 * 1024;
type ReadbackState = "idle" | "requesting" | "playing";

export async function playInAudioContext(
  context: AudioContext, audio: ArrayBuffer, signal: AbortSignal, onPlaying: () => void,
) {
  signal.throwIfAborted();
  const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
    const decoding = context.decodeAudioData(audio);
    const cancel = () => reject(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
    void decoding.then(resolve, reject).finally(() => signal.removeEventListener("abort", cancel));
  });
  signal.throwIfAborted();
  if (context.state !== "running") throw new Error("Audio output is unavailable.");

  await new Promise<void>((resolve, reject) => {
    const source = context.createBufferSource();
    const cleanup = () => {
      source.onended = null;
      signal.removeEventListener("abort", cancel);
      source.disconnect();
    };
    const cancel = () => {
      // Stop before resolving so the mic cannot reopen while the source is playing.
      try { source.stop(); } catch { /* The AudioContext may have closed. */ }
      cleanup();
      reject(signal.reason);
    };
    source.buffer = buffer;
    source.onended = () => { cleanup(); resolve(); };
    try {
      source.connect(context.destination);
      source.start();
    } catch (error) {
      cleanup();
      reject(error);
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    onPlaying();
  });
}

function playLocally(text: string, signal: AbortSignal, onPlaying: () => void) {
  return new Promise<void>(resolve => {
    const synth = window.speechSynthesis;
    if (signal.aborted || !text || !synth || typeof SpeechSynthesisUtterance === "undefined") {
      resolve();
      return;
    }
    const voice = synth.getVoices().find(item => item.localService && /^en(?:-|$)/i.test(item.lang));
    if (!voice) { resolve(); return; }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    const finish = () => {
      utterance.onstart = utterance.onend = utterance.onerror = null;
      signal.removeEventListener("abort", cancel);
      resolve();
    };
    const cancel = () => { finish(); synth.cancel(); };
    utterance.onstart = onPlaying;
    utterance.onend = utterance.onerror = finish;
    signal.addEventListener("abort", cancel, { once: true });
    try { synth.speak(utterance); }
    catch { finish(); }
  });
}

function letEchoFade(signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const finish = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, ECHO_TAIL);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export function useRideReadback(enabled: boolean, player?: RideAudioPlayer) {
  const [state, setState] = useState<ReadbackState>("idle");
  const allowed = useRef(enabled);
  allowed.current = enabled;
  const active = useRef<AbortController>();

  const cancel = useCallback(() => {
    const request = active.current;
    active.current = undefined;
    request?.abort();
  }, []);

  const isActive = useCallback(() => Boolean(active.current), []);
  const stop = useCallback(() => { cancel(); setState("idle"); }, [cancel]);

  useLayoutEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    const whenHidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", whenHidden);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", whenHidden);
      window.removeEventListener("pagehide", stop);
      cancel();
    };
  }, [cancel, stop]);

  const speak = useCallback(async (request: RideReadbackRequest | null, fallbackText: string) => {
    if (!allowed.current || document.hidden) return;
    cancel();
    const attempt = new AbortController();
    active.current = attempt;
    setState("requesting");

    try {
      const scope = captureFacilityScope();
      const signal = AbortSignal.any([attempt.signal, scope.signal]);
      const canSpeak = () => !signal.aborted && active.current === attempt && allowed.current && !document.hidden;
      let played = false;
      const onPlaying = () => {
        if (!canSpeak()) return;
        played = true;
        setState("playing");
      };

      if (request && player) {
        try {
          // The Edge Function builds the prompt from these authorized references.
          const { data, error, response } = await scope.client().functions.invoke<Blob>("speak-ride-prompt", {
            body: request, signal, timeout: REQUEST_TIMEOUT,
          });
          if (!canSpeak()) return;
          // A prompt denied by the server may belong to a stale or inaccessible draft.
          if (response && [401, 403, 409].includes(response.status)) return;
          if (error || !(data instanceof Blob) || data.type !== "application/octet-stream" ||
              !data.size || data.size > MAX_AUDIO_BYTES)
            throw new Error("Audio output is unavailable.");
          const audio = await data.arrayBuffer();
          if (!canSpeak()) return;
          await player(audio, AbortSignal.any([signal, AbortSignal.timeout(PLAYBACK_TIMEOUT)]), onPlaying);
        } catch {
          // Fall back only when the cloud output did not already speak the line.
        }
      }

      if (!played && canSpeak()) {
        await playLocally(fallbackText, AbortSignal.any([signal, AbortSignal.timeout(PLAYBACK_TIMEOUT)]), onPlaying);
      }
      if (played && canSpeak()) await letEchoFade(signal);
    } catch {
      // The chat remains usable when the facility changes or speech is unavailable.
    } finally {
      if (active.current === attempt) {
        active.current = undefined;
        setState("idle");
      }
    }
  }, [cancel, player]);

  return { state, isActive, stop, speak };
}

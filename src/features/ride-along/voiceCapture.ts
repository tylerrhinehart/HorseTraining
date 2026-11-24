import workletUrl from "./voiceCapture.worklet.js?url&no-inline";
import { playInAudioContext, type RideAudioPlayer } from "./rideReadback";
import { createVoiceActivity, encodeVoiceWav, VOICE_SAMPLE_RATE } from "./voiceActivity";

export interface VoiceCapture {
  listen(onAnswer: (audio: Blob) => void): void;
  playReadback: RideAudioPlayer;
  pause(): void;
  close(): void;
}

export async function openVoiceCapture(signal: AbortSignal, onInterrupted: () => void): Promise<VoiceCapture> {
  if (signal.aborted || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined" ||
      typeof AudioWorkletNode === "undefined") throw new Error("Microphone unavailable");
  const context = new AudioContext();
  let stream: MediaStream | undefined;
  let node: AudioWorkletNode | undefined;
  let closed = false;
  let epoch = 0;
  let acceptFrame: ReturnType<typeof createVoiceActivity> | undefined;
  let acceptAnswer: ((audio: Blob) => void) | undefined;

  function close() {
    if (closed) return;
    closed = true;
    acceptFrame = acceptAnswer = undefined;
    signal.removeEventListener("abort", close);
    node?.port.close();
    stream?.getTracks().forEach(track => track.stop());
    void context.close().catch(() => {});
  }

  signal.addEventListener("abort", close, { once: true });
  try {
    // Resume within the user's gesture, before waiting for browser permission.
    const resumed = context.resume().catch(() => {});
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
      video: false,
    });
    const track = stream.getAudioTracks()[0];
    if (closed || signal.aborted) {
      stream.getTracks().forEach(item => item.stop());
      throw new Error("Microphone canceled");
    }
    if (!track) throw new Error("Microphone unavailable");
    track.enabled = false;
    track.addEventListener("ended", onInterrupted, { once: true });
    await context.audioWorklet.addModule(workletUrl);
    await resumed;
    if (closed || context.state !== "running" || context.sampleRate < VOICE_SAMPLE_RATE || track.readyState === "ended")
      throw new Error("Microphone unavailable");
    const input = context.createMediaStreamSource(stream);
    const removeRumble = context.createBiquadFilter();
    removeRumble.type = "highpass";
    removeRumble.frequency.value = 120;
    const removeHiss = context.createBiquadFilter();
    removeHiss.type = "lowpass";
    removeHiss.frequency.value = 4500;
    const worklet = new AudioWorkletNode(context, "tqa-ride-voice", {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      channelCount: 1, channelCountMode: "explicit", processorOptions: { rate: VOICE_SAMPLE_RATE },
    });
    node = worklet;
    input.connect(removeRumble).connect(removeHiss).connect(worklet).connect(context.destination);
    worklet.addEventListener("processorerror", onInterrupted, { once: true });
    context.addEventListener("statechange", () => {
      if (!closed && context.state !== "running") onInterrupted();
    });

    function pause() {
      if (closed) return;
      acceptFrame = acceptAnswer = undefined;
      worklet.port.postMessage({ epoch: ++epoch, active: false });
    }

    worklet.port.onmessage = ({ data }: MessageEvent<{ epoch: number; samples: Float32Array }>) => {
      if (closed || document.hidden || data.epoch !== epoch) return;
      const frames = acceptFrame?.(data.samples);
      const deliver = acceptAnswer;
      if (!frames || !deliver) return;
      pause();
      deliver(encodeVoiceWav(frames));
    };

    return {
      listen(onAnswer) {
        if (closed || document.hidden) return;
        acceptFrame = createVoiceActivity();
        acceptAnswer = onAnswer;
        worklet.port.postMessage({ epoch: ++epoch, active: true });
        track.enabled = true;
      },
      playReadback: (audio, playbackSignal, onPlaying) => playInAudioContext(
        context, audio, AbortSignal.any([signal, playbackSignal]), onPlaying,
      ),
      pause,
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}

export const VOICE_SAMPLE_RATE = 16_000;
const FRAME_MS = 20;
const PRE_ROLL = Math.ceil(260 / FRAME_MS);
const END_SILENCE = Math.ceil(600 / FRAME_MS);
const MAX_FRAMES = Math.floor(7500 / FRAME_MS);

function rms(frame: Float32Array) {
  let total = 0;
  for (const sample of frame) total += sample * sample;
  return Math.sqrt(total / frame.length);
}

/** Find a short utterance in already noise-suppressed, speech-band audio. */
export function createVoiceActivity() {
  const leadIn: Float32Array[] = [];
  let recording: Float32Array[] | undefined;
  let floor = 0.003;
  let onset = 0;
  let voiced = 0;
  let silent = 0;
  let waitingForQuiet = false;

  return (frame: Float32Array): Float32Array[] | undefined => {
    const level = rms(frame);
    const startThreshold = Math.max(0.013, floor * 3);
    const holdThreshold = Math.max(0.008, floor * 1.8);

    if (waitingForQuiet) {
      // Sustained noise will not submit or open another turn by itself.
      silent = level < holdThreshold ? silent + 1 : 0;
      if (silent >= END_SILENCE) {
        waitingForQuiet = false;
        silent = 0;
      }
      return;
    }

    if (!recording) {
      leadIn.push(frame);
      if (leadIn.length > PRE_ROLL) leadIn.shift();
      if (level < startThreshold) floor += (level - floor) * 0.035;
      onset = level >= startThreshold ? onset + 1 : 0;
      if (onset >= 3) {
        recording = leadIn.splice(0);
        voiced = onset;
      }
      return;
    }

    recording.push(frame);
    if (level >= holdThreshold) {
      voiced++;
      silent = 0;
    } else {
      silent++;
    }
    if (silent >= END_SILENCE || recording.length >= MAX_FRAMES) {
      // Remove most of the trailing silence but retain soft word endings.
      const speech = silent >= END_SILENCE && voiced >= 6
        ? recording.slice(0, recording.length - silent + 6)
        : undefined;
      waitingForQuiet = recording.length >= MAX_FRAMES && silent < END_SILENCE;
      recording = undefined;
      onset = voiced = silent = 0;
      return speech;
    }
  };
}

export function encodeVoiceWav(frames: Float32Array[]) {
  const byteLength = frames.reduce((size, frame) => size + frame.length * 2, 0);
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true);
  view.setUint32(24, VOICE_SAMPLE_RATE, true);
  view.setUint32(28, VOICE_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, byteLength, true);
  let offset = 44;
  for (const frame of frames) {
    for (const sample of frame) {
      view.setInt16(offset, Math.round(Math.min(1, Math.max(-1, sample)) * 32767), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

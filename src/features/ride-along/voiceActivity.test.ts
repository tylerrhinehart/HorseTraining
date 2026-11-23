// @vitest-environment node
import { expect, it } from "vitest";
import { createVoiceActivity, encodeVoiceWav, VOICE_SAMPLE_RATE } from "./voiceActivity";

const frame = (level = 0) => new Float32Array(VOICE_SAMPLE_RATE / 50).fill(level);

function feed(detect: ReturnType<typeof createVoiceActivity>, level: number, count: number) {
  return Array.from({ length: count }, () => detect(frame(level))).filter(value => value !== undefined);
}

it("does not emit silence, low background noise, or a single spike", () => {
  const detect = createVoiceActivity();
  expect(feed(detect, 0, 60)).toEqual([]);
  expect(feed(detect, .006, 60)).toEqual([]);
  expect(feed(detect, .09, 2)).toEqual([]);
  expect(feed(detect, .005, 60)).toEqual([]);
});

it("keeps the beginning of the answer and completes automatically after a pause", () => {
  const detect = createVoiceActivity();
  const softBeginning = frame(.009);
  feed(detect, 0, 12);
  detect(softBeginning);
  expect(feed(detect, .04, 20)).toEqual([]);
  expect(feed(detect, 0, 29)).toEqual([]);
  const answer = detect(frame());
  expect(answer).toContain(softBeginning);
  expect(answer?.length).toBeLessThan(20 + 13 + 30);
});

it("does not upload continuous loud noise and recovers when the noise stops", () => {
  const detect = createVoiceActivity();
  expect(feed(detect, .09, 1000)).toEqual([]);
  expect(feed(detect, 0, 40)).toEqual([]);
  feed(detect, .08, 16);
  expect(feed(detect, 0, 35)).toHaveLength(1);
});

it("encodes canonical 16 kHz mono PCM with matching lengths and the signed samples", async () => {
  const wav = encodeVoiceWav([new Float32Array([.5, -.5])]);
  const buffer = await new Response(wav).arrayBuffer();
  const view = new DataView(buffer);
  const text = new TextDecoder().decode(buffer);
  expect(wav.type).toBe("audio/wav");
  expect(buffer.byteLength).toBe(48);
  expect(text.startsWith("RIFF")).toBe(true);
  expect(text.slice(8, 16)).toBe("WAVEfmt ");
  expect(view.getUint32(24, true)).toBe(16_000);
  expect(view.getUint32(40, true)).toBe(4);
  expect(view.getInt16(44, true)).toBeGreaterThan(0);
  expect(view.getInt16(46, true)).toBeLessThan(0);
});

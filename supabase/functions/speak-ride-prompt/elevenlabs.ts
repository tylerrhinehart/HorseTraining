import { readBoundedBytes } from "./readBytes.ts";

const MODEL = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_64";
const MAX_AUDIO_BYTES = 256 * 1024;
export const validVoiceId = (id: string) => /^[a-zA-Z0-9_-]{1,80}$/.test(id);

export async function synthesizePrompt(
  text: string, key: string, voiceId: string, signal: AbortSignal, request: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  if (!key || !validVoiceId(voiceId)) throw new Error("Readback is not configured");
  const response = await request(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      redirect: "error",
      signal,
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL, language_code: "en" }),
    },
  );
  const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!response.ok || type !== "audio/mpeg" || !response.body ||
      Number(response.headers.get("content-length")) > MAX_AUDIO_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw new Error("Readback audio unavailable");
  }
  const audio = await readBoundedBytes(response.body, MAX_AUDIO_BYTES, signal);
  if (!audio || audio.byteLength < 4) throw new Error("Invalid readback audio");
  const [first, second, third] = new Uint8Array(audio, 0, 3);
  const id3 = first === 0x49 && second === 0x44 && third === 0x33;
  const frameSync = first === 0xff && (second & 0xe0) === 0xe0;
  if (!id3 && !frameSync) throw new Error("Invalid readback audio");
  return audio;
}

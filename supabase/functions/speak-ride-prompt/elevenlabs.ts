import { readBoundedBytes } from "./readBytes.ts";

const MODEL = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_64";
const MAX_AUDIO_BYTES = 256 * 1024;
const MAX_ERROR_BYTES = 4096;
const SAFE_PROVIDER_CODES = new Set([
  "invalid_api_key", "missing_permissions", "quota_exceeded", "voice_not_found", "paid_plan_required",
  "detected_unusual_activity", "model_not_found", "invalid_output_format", "rate_limit_exceeded",
]);
export const validVoiceId = (id: string) => /^[a-zA-Z0-9_-]{1,80}$/.test(id);

export class ReadbackProviderError extends Error {
  constructor(
    readonly stage: "provider_http" | "provider_network" | "provider_audio",
    readonly status?: number,
    readonly code?: string,
  ) {
    super("Readback audio unavailable");
  }
}

async function readProviderCode(response: Response, signal: AbortSignal) {
  if (!response.body) return undefined;
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    void response.body.cancel().catch(() => {});
    return undefined;
  }
  try {
    const bytes = await readBoundedBytes(response.body, MAX_ERROR_BYTES, signal);
    if (!bytes) return undefined;
    const detail: unknown = JSON.parse(new TextDecoder().decode(bytes))?.detail;
    if (!detail || typeof detail !== "object") return undefined;
    for (const field of ["code", "status"] as const) {
      const value: unknown = (detail as Record<string, unknown>)[field];
      if (typeof value === "string" && SAFE_PROVIDER_CODES.has(value)) return value;
    }
  } catch {
    // The HTTP status remains safe to report when the provider error body is unreadable.
  }
  return undefined;
}

export async function synthesizePrompt(
  text: string, key: string, voiceId: string, signal: AbortSignal, request: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  if (!key || !validVoiceId(voiceId)) throw new Error("Readback is not configured");
  let response: Response;
  try {
    response = await request(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        redirect: "error",
        signal,
        headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: MODEL, language_code: "en" }),
      },
    );
  } catch {
    throw new ReadbackProviderError("provider_network");
  }
  if (!response.ok) {
    throw new ReadbackProviderError("provider_http", response.status, await readProviderCode(response, signal));
  }
  const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "audio/mpeg" || !response.body || Number(response.headers.get("content-length")) > MAX_AUDIO_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw new ReadbackProviderError("provider_audio", response.status);
  }
  const audio = await readBoundedBytes(response.body, MAX_AUDIO_BYTES, signal);
  if (!audio || audio.byteLength < 4) throw new ReadbackProviderError("provider_audio", response.status);
  const [first, second, third] = new Uint8Array(audio, 0, 3);
  const id3 = first === 0x49 && second === 0x44 && third === 0x33;
  const frameSync = first === 0xff && (second & 0xe0) === 0xe0;
  if (!id3 && !frameSync) throw new ReadbackProviderError("provider_audio", response.status);
  return audio;
}

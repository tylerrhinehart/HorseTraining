// OpenRouter's OpenAI-compatible multipart transcription API. No record metadata.
export const TRANSCRIPTION_MODEL = "openai/gpt-transcribe";
export async function transcribeClip(
  audio: Blob, extension: string, key: string, signal: AbortSignal, request: typeof fetch = fetch,
): Promise<string> {
  if (!key) throw new Error("OpenRouter not configured");
  const body = new FormData();
  body.set("file", audio, `clip.${extension}`);
  body.set("model", TRANSCRIPTION_MODEL);
  body.set("response_format", "json");
  const response = await request("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST", body, signal, headers: { authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error("Transcription unavailable");
  const result = await response.json();
  if (typeof result?.text !== "string" || !result.text.trim()) throw new Error("Invalid transcription response");
  return result.text;
}

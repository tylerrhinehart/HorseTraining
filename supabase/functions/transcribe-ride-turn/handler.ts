import type { ScoreChoice } from "./jev.ts";
const MAX_AUDIO = 512 * 1024;
const MAX_BODY = MAX_AUDIO + 4096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORMATS: Record<string, string> = {
  "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg",
};

export interface TurnBinding { draft_id: string; question_id: string; version: number; turn_id: string }

export interface Dependencies {
  origins: readonly string[];
  authenticate: (authorization: string, signal: AbortSignal) => Promise<boolean>;
  authorize: (authorization: string, binding: TurnBinding, consume: boolean, signal: AbortSignal) => Promise<boolean>;
  interpret: (transcript: string, signal: AbortSignal) => Promise<ScoreChoice>;
  transcribe: (clip: Blob, extension: string, signal: AbortSignal) => Promise<string>;
}

async function readLimited(body: ReadableStream<Uint8Array>, signal: AbortSignal) {
  if (signal.aborted) throw new Error("aborted");
  const reader = body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const buffer = new Uint8Array(MAX_BODY);
  let position = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error("aborted");
      if (done) return buffer.slice(0, position);
      if (position + value.length > MAX_BODY) {
        cancel();
        return null;
      }
      buffer.set(value, position);
      position += value.length;
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

async function hasContainerSignature(file: Blob, extension: string) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = new TextDecoder();
  if (extension === "webm") return [0x1a, 0x45, 0xdf, 0xa3].every((v, i) => bytes[i] === v);
  if (extension === "mp4") return ascii.decode(bytes.slice(4, 8)) === "ftyp";
  return ascii.decode(bytes.slice(0, 4)) === "OggS";
}

export function createHandler(deps: Dependencies) {
  return async function handle(req: Request): Promise<Response> {
    const origin = req.headers.get("origin");
    const headers = new Headers({ "cache-control": "no-store", vary: "Origin" });
    if (origin && deps.origins.includes(origin)) {
      headers.set("access-control-allow-origin", origin);
      headers.set("access-control-allow-methods", "POST, OPTIONS");
      headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info");
    }
    const respond = (status: number, body: Record<string, unknown>) =>
      Response.json(body, { status, headers });
    if (origin && !deps.origins.includes(origin)) return respond(403, { error: "Origin not allowed." });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return respond(405, { error: "Method not allowed." });
    const auth = req.headers.get("authorization") ?? "";
    if (!/^Bearer \S+$/.test(auth)) return respond(401, { error: "Sign in first." });
    const type = req.headers.get("content-type") ?? "";
    if (!type.toLowerCase().startsWith("multipart/form-data;") || !req.body)
      return respond(415, { error: "Expected a recorded clip." });
    if (Number(req.headers.get("content-length")) > MAX_BODY)
      return respond(413, { error: "Clip too large." });

    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(18_000)]);
    try {
      if (!await deps.authenticate(auth, signal)) return respond(401, { error: "Sign in first." });
      let form: FormData;
      try {
        const bytes = await readLimited(req.body, signal);
        if (!bytes) return respond(413, { error: "Clip too large." });
        form = await new Response(bytes, { headers: { "content-type": type } }).formData();
      } catch {
        return respond(400, { error: "Invalid clip upload." });
      }
      const draft = form.get("draft_id");
      const turn = form.get("turn_id");
      const question = form.get("question_id");
      const version = Number(form.get("version"));
      const audio = form.get("audio");
      if ([...form.keys()].length !== 5 || typeof draft !== "string" || !UUID.test(draft) ||
          typeof turn !== "string" || !UUID.test(turn) || typeof question !== "string" || !UUID.test(question) || !Number.isSafeInteger(version) || version < 1 || !(audio instanceof Blob) ||
          audio.size < 12 || audio.size > MAX_AUDIO)
        return respond(400, { error: "Invalid clip upload." });
      const mediaType = audio.type.split(";")[0].trim().toLowerCase();
      const extension = Object.hasOwn(FORMATS, mediaType) ? FORMATS[mediaType] : undefined;
      if (!extension || !await hasContainerSignature(audio, extension))
        return respond(415, { error: "Unsupported recording format." });
      const binding = { draft_id: draft, question_id: question, version, turn_id: turn };
      if (!await deps.authorize(auth, binding, true, signal))
        return respond(403, { error: "Voice is unavailable for this draft or its current limits." });
      const transcript = (await deps.transcribe(audio, extension, signal)).trim();
      if (transcript.length > 200) return respond(422, { error: "Use a single short scoring command." });
      const choice = await deps.interpret(transcript, signal);
      if (!await deps.authorize(auth, binding, false, signal)) return respond(409, { error: "The active question changed. Reload the saved draft." });
      return respond(200, { ...binding, transcript, choice });
    } catch {
      // No audio, transcript, credentials, or upstream response in logs or errors.
      return respond(503, { error: "Voice interpretation is unavailable. Try again or enter the score manually." });
    }
  };
}

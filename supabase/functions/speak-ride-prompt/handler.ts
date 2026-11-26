import { isRideSummaryPrompt, rideQuestionPrompt, RIDE_READBACK_TEXT, type RidePromptKind } from "../_shared/ridePrompts.ts";
import { readBoundedBytes } from "./readBytes.ts";

const MAX_REQUEST_BYTES = 512;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PromptBinding {
  draftId: string;
  questionId: string | null;
  version: number;
  kind: RidePromptKind;
}

export interface Dependencies {
  origins: readonly string[];
  configured: boolean;
  authenticate: (authorization: string, signal: AbortSignal) => Promise<boolean>;
  authorize: (
    authorization: string, binding: PromptBinding, consume: boolean, signal: AbortSignal,
  ) => Promise<{ questionText: string | null; offerTemperament?: boolean } | null>;
  synthesize: (text: string, signal: AbortSignal) => Promise<ArrayBuffer>;
}

function readBinding(value: unknown): PromptBinding | null {
  if (!value || typeof value !== "object" || Object.keys(value).length !== 4) return null;
  const { draftId, questionId, version, kind } = value as Partial<PromptBinding>;
  if (typeof draftId !== "string" || !UUID.test(draftId) ||
    typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 ||
    (kind !== "question" && kind !== "clarification" && kind !== "retry" && !isRideSummaryPrompt(kind))) return null;
  if (isRideSummaryPrompt(kind) ? questionId !== null : typeof questionId !== "string" || !UUID.test(questionId)) return null;
  return { draftId, questionId: questionId ?? null, version, kind };
}

export function createHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers = new Headers({ "cache-control": "no-store", vary: "Origin", "x-content-type-options": "nosniff" });
    if (origin && deps.origins.includes(origin)) {
      headers.set("access-control-allow-origin", origin);
      headers.set("access-control-allow-methods", "POST, OPTIONS");
      headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info");
    }
    const error = (status: number, message: string) => Response.json({ error: message }, { status, headers });
    if (origin && !deps.origins.includes(origin)) return error(403, "Origin not allowed.");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return error(405, "Method not allowed.");
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer \S+$/.test(authorization)) return error(401, "Sign in first.");
    const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (type !== "application/json" || !request.body) return error(415, "Expected a readback request.");
    if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return error(413, "Readback request too large.");
    if (!deps.configured) return error(503, "Readback is unavailable.");

    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
    try {
      if (!await deps.authenticate(authorization, signal)) return error(401, "Sign in first.");
      const bytes = await readBoundedBytes(request.body, MAX_REQUEST_BYTES, signal);
      if (!bytes) return error(413, "Readback request too large.");
      let binding: PromptBinding | null;
      try {
        binding = readBinding(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
      } catch {
        return error(400, "Invalid readback request.");
      }
      if (!binding) return error(400, "Invalid readback request.");
      const allowed = await deps.authorize(authorization, binding, true, signal);
      const needsOffer = binding.kind === "temperament_offer" || binding.kind === "temperament_clarification";
      if (!allowed || (needsOffer && !allowed.offerTemperament)) return error(403, "Readback is unavailable for this draft or its current limits.");
      const prompt = binding.kind === "question"
        ? rideQuestionPrompt(allowed.questionText ?? "")
        : RIDE_READBACK_TEXT[binding.kind];
      if (!prompt) return error(422, "Readback is unavailable for this question.");

      const audio = await deps.synthesize(prompt, signal);
      signal.throwIfAborted();
      const latest = await deps.authorize(authorization, binding, false, signal);
      if (!latest || latest.questionText !== allowed.questionText || (needsOffer && !latest.offerTemperament))
        return error(409, "The active question changed.");
      // functions-js classifies octet-stream as a Blob. The provider MP3 MIME
      // and byte signature have already been checked before reaching here.
      headers.set("content-type", "application/octet-stream");
      return new Response(audio, { headers });
    } catch {
      return error(503, "Readback is unavailable.");
    }
  };
}

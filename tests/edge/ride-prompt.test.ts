// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { RIDE_READBACK_TEXT, rideQuestionPrompt } from "../../supabase/functions/_shared/ridePrompts";
import { synthesizePrompt } from "../../supabase/functions/speak-ride-prompt/elevenlabs";
import { createHandler, type Dependencies, type PromptBinding } from "../../supabase/functions/speak-ride-prompt/handler";
import { QUESTIONS } from "../../src/content/tqa-template";

const origin = "https://tqa.test";
const rubricLabel = "Stand to Saddle and Accept Bridle";
const bytes = Uint8Array.of(0xff, 0xfb, 0x90, 0x64);
const binding: PromptBinding = {
  draftId: "00000000-0000-4000-8000-000000000001",
  questionId: "00000000-0000-4000-8000-000000000002",
  version: 2, kind: "question",
};

function request(body: unknown = binding, headers: Record<string, string> = {}) {
  return new Request("https://function.test", {
    method: "POST", body: JSON.stringify(body),
    headers: { authorization: "Bearer synthetic", "content-type": "application/json", origin, ...headers },
  });
}
function dependencies(overrides?: Partial<Dependencies>) {
  return {
    origins: [origin], configured: true,
    authenticate: vi.fn<Dependencies["authenticate"]>().mockResolvedValue(true),
    authorize: vi.fn<Dependencies["authorize"]>().mockResolvedValue({ questionText: rubricLabel }),
    synthesize: vi.fn<Dependencies["synthesize"]>().mockResolvedValue(bytes.buffer),
    ...overrides,
  };
}

describe("speak-ride-prompt", () => {
  it("maps all canonical Phase 1 questions to speech, without repeating the score range", () => {
    const labels = QUESTIONS.filter(question => question.phase_code === "phase_1");
    expect(labels).toHaveLength(14);
    for (const label of labels) {
      const prompt = rideQuestionPrompt(label.text);
      expect(prompt).toMatch(/\?$/);
      expect(prompt).not.toContain("minus three");
    }
  });

  it("sends only the allowlisted prompt, then rechecks the draft before returning uncached MP3 bytes", async () => {
    const deps = dependencies();
    const response = await createHandler(deps)(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(deps.authenticate).toHaveBeenCalledWith("Bearer synthetic", expect.any(AbortSignal));
    expect(deps.authorize).toHaveBeenNthCalledWith(1, "Bearer synthetic", binding, true, expect.any(AbortSignal));
    expect(deps.synthesize).toHaveBeenCalledWith(
      "How did your horse stand for saddling and accept the bridle?", expect.any(AbortSignal),
    );
    expect(deps.authorize).toHaveBeenNthCalledWith(2, "Bearer synthetic", binding, false, expect.any(AbortSignal));
  });

  it.each(["clarification", "complete", "retry"] as const)("allows a fixed %s prompt", async (kind) => {
    const deps = dependencies({ authorize: vi.fn().mockResolvedValue({ questionText: kind === "complete" ? null : rubricLabel }) });
    const response = await createHandler(deps)(request({ ...binding, kind, questionId: kind === "complete" ? null : binding.questionId }));
    expect(response.status).toBe(200);
    expect(deps.synthesize).toHaveBeenCalledWith(RIDE_READBACK_TEXT[kind], expect.any(AbortSignal));
  });

  it.each(["temperament_offer", "temperament_clarification"] as const)("guards the %s readback before and after speech generation", async kind => {
    const authorize = vi.fn<Dependencies["authorize"]>();
    const deps = dependencies({ authorize });
    const handle = createHandler(deps);
    const prompt = { ...binding, kind, questionId: null };
    authorize.mockResolvedValueOnce({ questionText: null });
    expect((await handle(request(prompt))).status).toBe(403);
    expect(deps.synthesize).not.toHaveBeenCalled();
    authorize.mockResolvedValueOnce({ questionText: null, offerTemperament: true }).mockResolvedValueOnce({ questionText: null });
    expect((await handle(request(prompt))).status).toBe(409);
    authorize.mockResolvedValue({ questionText: null, offerTemperament: true });
    expect((await handle(request(prompt))).status).toBe(200);
    expect(deps.synthesize).toHaveBeenLastCalledWith(RIDE_READBACK_TEXT[kind], expect.any(AbortSignal));
  });

  it("keeps custom rubric, spoofed and oversized input away from ElevenLabs", async () => {
    const deps = dependencies({ authorize: vi.fn().mockResolvedValue({ questionText: "Historical fixture name" }) });
    const handle = createHandler(deps);
    expect((await handle(request())).status).toBe(422);
    expect((await handle(request({ ...binding, text: "arbitrary prompt" }))).status).toBe(400);
    expect((await handle(request({ ...binding, version: "2" }))).status).toBe(400);
    expect((await handle(request({ ...binding, questionId: null }))).status).toBe(400);
    expect((await handle(request({ ...binding, kind: "complete" }))).status).toBe(400);
    expect((await handle(request({ ...binding, kind: "custom" }))).status).toBe(400);
    expect((await handle(request({ ...binding, text: "x".repeat(1000) }))).status).toBe(413);
    expect(deps.synthesize).not.toHaveBeenCalled();
  });

  it("rejects foreign origins, invalid sessions, missing config and unauthorized draft bindings", async () => {
    const unauthorized = dependencies({ authorize: vi.fn().mockResolvedValue(null) });
    const handle = createHandler(unauthorized);
    expect((await handle(request(binding, { origin: "https://foreign.test" }))).status).toBe(403);
    expect((await handle(request(binding, { authorization: "invalid" }))).status).toBe(401);
    expect((await handle(request())).status).toBe(403);
    expect(unauthorized.synthesize).not.toHaveBeenCalled();

    const invalidSession = dependencies({ authenticate: vi.fn().mockResolvedValue(false) });
    expect((await createHandler(invalidSession)(request())).status).toBe(401);
    expect(invalidSession.authorize).not.toHaveBeenCalled();
    const unconfigured = dependencies({ configured: false });
    const disabled = createHandler(unconfigured);
    expect((await disabled(request())).status).toBe(503);
    const preflight = await disabled(new Request("https://function.test", { method: "OPTIONS", headers: { origin } }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(unconfigured.authenticate).not.toHaveBeenCalled();
  });

  it("discards stale prompt audio and sanitizes provider outages", async () => {
    const stale = dependencies({
      authorize: vi.fn().mockResolvedValueOnce({ questionText: rubricLabel }).mockResolvedValueOnce(null),
    });
    expect((await createHandler(stale)(request())).status).toBe(409);
    const unavailable = dependencies({ synthesize: vi.fn().mockRejectedValue(new Error("provider details")) });
    const response = await createHandler(unavailable)(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Readback is unavailable." });
  });
});

describe("ElevenLabs adapter", () => {
  it("uses the pinned Flash model, MP3 output and the provider's private key header", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(bytes, { headers: { "content-type": "audio/mpeg" } }));
    const signal = new AbortController().signal;
    const audio = await synthesizePrompt("Question?", "synthetic-key", "testVoice01", signal, request);
    expect(new Uint8Array(audio)).toEqual(bytes);
    expect(request).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/text-to-speech/testVoice01?output_format=mp3_44100_64",
      {
        method: "POST", redirect: "error", signal,
        headers: { "xi-api-key": "synthetic-key", "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text: "Question?", model_id: "eleven_flash_v2_5", language_code: "en" }),
      },
    );
  });

  it("rejects malformed configuration, wrong MIME, oversized audio and invalid bytes", async () => {
    const signal = new AbortController().signal;
    const request = vi.fn<typeof fetch>();
    await expect(synthesizePrompt("Question?", "synthetic-key", "../bad-voice", signal, request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    for (const response of [
      new Response(bytes, { headers: { "content-type": "text/html" } }),
      new Response(new Uint8Array(256 * 1024 + 1), { headers: { "content-type": "audio/mpeg" } }),
      new Response("not mp3", { headers: { "content-type": "audio/mpeg" } }),
      new Response("provider failed", { status: 503 }),
    ]) {
      request.mockResolvedValueOnce(response);
      await expect(synthesizePrompt("Question?", "synthetic-key", "testVoice01", signal, request)).rejects.toThrow();
    }
  });

  it.each(["code", "status"])("retains an approved provider error %s and drops the message", async field => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      detail: { [field]: "voice_not_found", message: "provider data that must not be logged" },
    }, { status: 404 }));
    await expect(synthesizePrompt("Question?", "synthetic-key", "testVoice01", new AbortController().signal, request))
      .rejects.toMatchObject({ stage: "provider_http", status: 404, code: "voice_not_found", message: "Readback audio unavailable" });
  });

  it("omits unknown provider codes and reports the HTTP status", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      detail: { status: "private upstream detail" },
    }, { status: 401 }));
    await expect(synthesizePrompt("Question?", "synthetic-key", "testVoice01", new AbortController().signal, request))
      .rejects.toMatchObject({ stage: "provider_http", status: 401, code: undefined });
  });
});

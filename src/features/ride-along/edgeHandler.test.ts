// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHandler, type Dependencies } from "../../../supabase/functions/transcribe-ride-turn/handler";
import { CHOICES, interpretScore, JEV_MODEL } from "../../../supabase/functions/transcribe-ride-turn/jev";
import { encodeVoiceWav } from "./voiceActivity";

const id = "00000000-0000-4000-8000-000000000001";
const origin = "https://sample.test";
function post({
  bearer = "Bearer sample", format = "audio/webm", bytes = [0x1a, 0x45, 0xdf, 0xa3, ...Array(12).fill(0)],
  requestOrigin = origin, answer, both = false, confirmation = false, temperament = false,
}: { bearer?: string; format?: string; bytes?: number[]; requestOrigin?: string; answer?: string; both?: boolean; confirmation?: boolean; temperament?: boolean } = {}) {
  const form = new FormData();
  form.set("draft_id", id);
  form.set("turn_id", id);
  if (!temperament) form.set("question_id", id);
  form.set("version", "1");
  if (answer !== undefined) form.set("answer", answer);
  if (answer === undefined || both) {
    const field = temperament ? "temperament_audio" : confirmation ? "confirmation_audio" : "audio";
    form.set(field, new Blob([Uint8Array.from(bytes)], { type: format }), "test");
  }
  return new Request("https://edge.test", { method: "POST", headers: { authorization: bearer, origin: requestOrigin }, body: form });
}
function deps(overrides?: Partial<Dependencies>) {
  return {
    origins: [origin],
    authenticate: vi.fn(async () => true),
    authorize: vi.fn(async () => true),
    authorizeTemperament: vi.fn(async () => true),
    transcribe: vi.fn(async () => " Doubling minus two. "),
    interpret: vi.fn(async () => "minus_two" as const),
    ...overrides,
  };
}
describe("transcribe-ride-turn", () => {
  it.each([["Now.", "now"], ["No, thanks.", "later"], ["Maybe, yes or no", "needs_clarification"]])(
    "interprets a spoken Temperament choice %s without Jev or a scoring turn", async (transcript, command) => {
      const implementation = deps({ transcribe: vi.fn(async () => transcript) });
      const response = await createHandler(implementation)(post({ temperament: true }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ draft_id: id, version: 1, turn_id: id, transcript, command });
      expect(implementation.authorizeTemperament).toHaveBeenNthCalledWith(1, "Bearer sample", id, 1, true, expect.any(AbortSignal));
      expect(implementation.authorizeTemperament).toHaveBeenNthCalledWith(2, "Bearer sample", id, 1, false, expect.any(AbortSignal));
      expect(implementation.authorize).not.toHaveBeenCalled();
      expect(implementation.interpret).not.toHaveBeenCalled();
    },
  );

  it("rejects a Temperament reply if the draft changed during transcription", async () => {
    const implementation = deps({ authorizeTemperament: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false) });
    const response = await createHandler(implementation)(post({ temperament: true }));
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty("command");
  });
  it.each([["Yes.", "confirm"], ["Yes, that’s right.", "confirm"], ["Try again!", "retry"],
    ["No.", "retry"], ["Yes, but wait.", "needs_clarification"], ["Yes?", "needs_clarification"],
    ["She said yes.", "needs_clarification"]])("checks spoken command %s without sending it to Jev", async (transcript, command) => {
    const implementation = deps({ transcribe: vi.fn(async () => transcript) });
    const res = await createHandler(implementation)(post({ confirmation: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ draft_id: id, question_id: id, turn_id: id, version: 1, transcript, command });
    expect(implementation.authorize).toHaveBeenCalledTimes(2);
    expect(implementation.interpret).not.toHaveBeenCalled();
  });

  it("rejects a spoken yes when the original proposal became stale during transcription", async () => {
    const implementation = deps({
      transcribe: async () => "Yes.",
      authorize: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    });
    const res = await createHandler(implementation)(post({ confirmation: true }));
    expect(res.status).toBe(409);
    expect(await res.json()).not.toHaveProperty("command");
  });
  it("accepts only the expected bounded PCM layout for WAV input", async () => {
    const implementation = deps();
    const handle = createHandler(implementation);
    const wav = new Uint8Array(await encodeVoiceWav([new Float32Array(320)]).arrayBuffer());
    const invalidWav = wav.slice();
    invalidWav[22] = 2;
    expect((await handle(post({ format: "audio/wav", bytes: [...invalidWav] }))).status).toBe(415);
    expect(implementation.authorize).not.toHaveBeenCalled();
    expect((await handle(post({ format: "audio/wav", bytes: [...wav] }))).status).toBe(200);
    expect(implementation.transcribe).toHaveBeenCalledWith(expect.any(Blob), "wav", expect.any(AbortSignal));
  });

  it("checks typed answers against the same bound question without audio transcription", async () => {
    const implementation = deps();
    const res = await createHandler(implementation)(post({ answer: "  minus two  " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ question_id: id, transcript: "minus two", choice: "minus_two" });
    expect(implementation.interpret).toHaveBeenCalledWith("minus two", expect.any(AbortSignal));
    expect(implementation.authorize).toHaveBeenCalledTimes(2);
    expect(implementation.transcribe).not.toHaveBeenCalled();
  });

  it("rejects mixed, empty, and oversized typed answers before authorizing the turn", async () => {
    const implementation = deps();
    const handle = createHandler(implementation);
    for (const request of [post({ answer: "+2", both: true }), post({ answer: "  " }), post({ answer: "x".repeat(201) })]) {
      expect((await handle(request)).status).toBe(400);
    }
    expect(implementation.authorize).not.toHaveBeenCalled();
    expect(implementation.interpret).not.toHaveBeenCalled();
  });

  it("authenticates, authorizes, and correlates an audio-only provider result", async () => {
    const impl = deps();
    const res = await createHandler(impl)(post());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ draft_id:id, question_id:id, version:1, turn_id: id, transcript: "Doubling minus two.", choice:"minus_two" });
    expect(impl.authorize).toHaveBeenCalledWith("Bearer sample", {draft_id:id,question_id:id,version:1,turn_id:id}, true, expect.any(AbortSignal));
    expect(impl.transcribe).toHaveBeenCalledWith(expect.any(Blob), "webm", expect.any(AbortSignal));
  });

  it.each([
    ["2", "+2", "plus_two"], ["Three.", "plus three", "plus_three"],
  ])("returns a positive choice for the unsigned audio transcript %j", async (transcript, normalized, choice) => {
    const request = vi.fn<typeof fetch>(async () => Response.json({
      model: JEV_MODEL,
      answers: { rating: {
        type: "choice", choice, confidence: 0.99,
        probabilities: Object.fromEntries(CHOICES.map(candidate => [candidate, candidate === choice ? 1 : 0])),
      } },
    }));
    const implementation = deps({
      transcribe: async () => transcript,
      interpret: (answer, signal) => interpretScore(answer, "synthetic-key", signal, request),
    });
    const response = await createHandler(implementation)(post());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ question_id: id, turn_id: id, version: 1, transcript, choice });
    expect(JSON.parse(String(request.mock.calls[0][1]?.body)).state).toEqual({ transcript: normalized });
    expect(implementation.authorize).toHaveBeenCalledTimes(2);
  });

  it("never sends a denied, malformed, or oversize upload to the provider", async () => {
    const implementation = deps({ authorize: async () => false });
    const handle = createHandler(implementation);
    expect((await handle(post({ bearer: "not valid" }))).status).toBe(401);
    expect((await handle(post({ requestOrigin: "https://untrusted.test" }))).status).toBe(403);
    expect((await handle(post({ format: "text/plain" }))).status).toBe(415);
    expect((await handle(post({ bytes: Array(512 * 1024 + 4097).fill(0) }))).status).toBe(413);
    expect((await handle(post())).status).toBe(403);
    expect(implementation.transcribe).not.toHaveBeenCalled();
  });
  it("never returns provider secrets or errors verbatim", async () => {
    const impl = deps({ transcribe: async () => { throw new Error("secret"); } });
    const res = await createHandler(impl)(post());
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("secret");
  });
});

it("rejects a late provider result after server binding changes", async () => {
 const impl=deps({authorize:vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)});
 const res=await createHandler(impl)(post()); expect(res.status).toBe(409);
 expect(await res.text()).not.toContain("minus_two");
});
it("returns clarification as a non-writing result for this same binding", async () => {
 const impl=deps({interpret:async()=>"needs_clarification"});
 const res=await createHandler(impl)(post()); expect(await res.json()).toMatchObject({question_id:id,version:1,choice:"needs_clarification"});
});
it("fails closed when Jev is unavailable with no transcript-parser fallback", async () => {
 const res=await createHandler(deps({interpret:async()=>{throw new Error("provider secret");}}))(post());
 expect(res.status).toBe(503); expect(await res.text()).not.toContain("secret");
});

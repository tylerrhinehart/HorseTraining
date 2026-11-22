// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createHandler, type Dependencies } from "../../../supabase/functions/transcribe-ride-turn/handler";

const id = "00000000-0000-4000-8000-000000000001";
const origin = "https://sample.test";
function post({
  bearer = "Bearer sample", format = "audio/webm", bytes = [0x1a, 0x45, 0xdf, 0xa3, ...Array(12).fill(0)],
  requestOrigin = origin,
}: { bearer?: string; format?: string; bytes?: number[]; requestOrigin?: string } = {}) {
  const form = new FormData();
  form.set("draft_id", id);
  form.set("turn_id", id);
  form.set("question_id", id);
  form.set("version", "1");
  form.set("audio", new Blob([Uint8Array.from(bytes)], { type: format }), "test");
  return new Request("https://edge.test", { method: "POST", headers: { authorization: bearer, origin: requestOrigin }, body: form });
}
function deps(overrides?: Partial<Dependencies>) {
  return {
    origins: [origin],
    authenticate: vi.fn(async () => true),
    authorize: vi.fn(async () => true),
    transcribe: vi.fn(async () => " Doubling minus two. "),
    interpret: vi.fn(async () => "minus_two" as const),
    ...overrides,
  };
}
describe("transcribe-ride-turn", () => {
  it("authenticates, authorizes, and correlates an audio-only provider result", async () => {
    const impl = deps();
    const res = await createHandler(impl)(post());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ draft_id:id, question_id:id, version:1, turn_id: id, transcript: "Doubling minus two.", choice:"minus_two" });
    expect(impl.authorize).toHaveBeenCalledWith("Bearer sample", {draft_id:id,question_id:id,version:1,turn_id:id}, true, expect.any(AbortSignal));
    expect(impl.transcribe).toHaveBeenCalledWith(expect.any(Blob), "webm", expect.any(AbortSignal));
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

import { createHandler } from "./handler.ts";

import { interpretScore } from "./jev.ts";

const jevKey = Deno.env.get("TYPESAFE_API_KEY");
const supabaseURL = Deno.env.get("SUPABASE_URL");
const anon = Deno.env.get("SUPABASE_ANON_KEY");
const providerKey = Deno.env.get("OPENAI_API_KEY");
const origins = (Deno.env.get("TQA_VOICE_ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);

Deno.serve(createHandler({
  origins,
  async authenticate(authorization, signal) {
    if (!supabaseURL || !anon || !providerKey || !jevKey || !origins.length) return false;
    const response = await fetch(`${supabaseURL}/auth/v1/user`, {
      headers: { authorization, apikey: anon }, signal,
    });
    if (response.status >= 500) throw new Error("auth unavailable");
    if (!response.ok) return false;
    const data = await response.json();
    return typeof data?.id === "string";
  },
  async authorize(authorization, binding, consume, signal) {
    const response = await fetch(`${supabaseURL}/rest/v1/rpc/authorize_guided_turn`, {
      method: "POST", signal,
      headers: { authorization, apikey: anon!, "content-type": "application/json" },
      body: JSON.stringify({ p_draft_id: binding.draft_id, p_question_id: binding.question_id, p_expected_version: binding.version, p_turn_id: binding.turn_id, p_consume: consume }),
    });
    if (response.status >= 500) throw new Error("authorization unavailable");
    return response.ok && await response.json() === true;
  },
  interpret: (transcript, signal) => interpretScore(transcript, jevKey!, signal),
  async transcribe(audio, extension, signal) {
    const body = new FormData();
    body.set("file", audio, `clip.${extension}`);
    body.set("model", "gpt-transcribe");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", body, signal, headers: { authorization: `Bearer ${providerKey}` },
    });
    if (!response.ok) throw new Error("provider unavailable");
    const result = await response.json();
    if (typeof result?.text !== "string") throw new Error("invalid provider result");
    return result.text;
  },
}));

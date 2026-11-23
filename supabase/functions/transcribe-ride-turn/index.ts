import { createHandler } from "./handler.ts";

import { interpretScore } from "./jev.ts";

import { transcribeClip } from "./transcription.ts";

const providerKey = Deno.env.get("OPENROUTER_API_KEY");
const supabaseURL = Deno.env.get("SUPABASE_URL");
const anon = Deno.env.get("SUPABASE_ANON_KEY");
const origins = (Deno.env.get("TQA_VOICE_ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);

Deno.serve(createHandler({
  origins,
  async authenticate(authorization, signal) {
    if (!supabaseURL || !anon || !providerKey || !origins.length) return false;
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
  interpret: (transcript, signal) => interpretScore(transcript, providerKey!, signal),
  transcribe: (audio, extension, signal) => transcribeClip(audio, extension, providerKey!, signal),
}));

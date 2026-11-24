import { synthesizePrompt, validVoiceId } from "./elevenlabs.ts";
import { createHandler } from "./handler.ts";

const key = Deno.env.get("ELEVENLABS_API_KEY")?.trim() ?? "";
const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID")?.trim() ?? "";
const supabaseURL = Deno.env.get("SUPABASE_URL");
const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const origins = (Deno.env.get("TQA_VOICE_ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);

Deno.serve(createHandler({
  origins,
  configured: Boolean(supabaseURL && anon && key && validVoiceId(voiceId) && origins.length),
  async authenticate(authorization, signal) {
    const response = await fetch(`${supabaseURL}/auth/v1/user`, {
      headers: { authorization, apikey: anon }, signal,
    });
    if (response.status >= 500) throw new Error("Auth unavailable");
    if (!response.ok) return false;
    const data = await response.json();
    return typeof data?.id === "string";
  },
  async authorize(authorization, binding, consume, signal) {
    const response = await fetch(`${supabaseURL}/rest/v1/rpc/authorize_ride_prompt`, {
      method: "POST", signal,
      headers: { authorization, apikey: anon, "content-type": "application/json" },
      body: JSON.stringify({
        p_draft_id: binding.draftId,
        p_expected_version: binding.version,
        p_question_id: binding.questionId,
        p_consume: consume,
      }),
    });
    if (response.status >= 500) throw new Error("Authorization unavailable");
    if (!response.ok) return null;
    const data = await response.json();
    return binding.questionId === null
      ? data?.question_text === null ? { questionText: null } : null
      : typeof data?.question_text === "string" ? { questionText: data.question_text } : null;
  },
  synthesize: (text, signal) => synthesizePrompt(text, key, voiceId, signal),
}));

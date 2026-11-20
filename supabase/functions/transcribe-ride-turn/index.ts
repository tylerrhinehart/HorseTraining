import { createHandler } from "./handler.ts";

const supabaseURL = Deno.env.get("SUPABASE_URL");
const anon = Deno.env.get("SUPABASE_ANON_KEY");
const providerKey = Deno.env.get("OPENAI_API_KEY");
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
  async authorize(authorization, draft, signal) {
    const response = await fetch(`${supabaseURL}/rest/v1/rpc/authorize_ride_transcription`, {
      method: "POST", signal,
      headers: { authorization, apikey: anon!, "content-type": "application/json" },
      body: JSON.stringify({ p_draft_id: draft }),
    });
    if (response.status >= 500) throw new Error("authorization unavailable");
    return response.ok && await response.json() === true;
  },
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

import { createClient } from "@supabase/supabase-js";
export let actor = "00000000-0000-0000-0000-000000000001";
export function setActor(id: string) { actor = id; }
export const supabaseConfigured = true;
export const supabase = createClient("http://127.0.0.1:56434", "local-fixture-only", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), "x-tqa-test-user": actor } }) },
});
supabase.auth.getUser = async () => ({ data: { user: { id: actor, email: "fixture@example.invalid" } as any }, error: null });
export function requireSupabase() { return supabase; }

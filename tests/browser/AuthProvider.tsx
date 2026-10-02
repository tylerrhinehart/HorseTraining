import { createContext, useContext, useState } from "react";
import { actor, setActor } from "../../src/supabase/client";
import { clearCache } from "../../src/supabase/cache";
const Auth = createContext<any>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState(actor);
  const switchActor = (next: string) => { clearCache(); setActor(next); setId(next); };
  return <Auth.Provider value={{ loading: false, configured: true, user: id ? { id, email: "fixture@example.invalid" } : null, session: null,
    signIn: async () => switchActor("00000000-0000-0000-0000-000000000001"), signUp: async () => { throw new Error("Fixture signup disabled"); }, signOut: async () => switchActor("") }}>
    <aside style={{ padding: 10, background: "#fff0c4", borderBottom: "2px solid #bd8500", textAlign: "center" }}>
      <strong>LOCAL TEST FIXTURE — synthetic trainers and horses, isolated database</strong><br />
      <button type="button" onClick={() => switchActor("00000000-0000-0000-0000-000000000001")}>Test trainer A</button>{" "}
      <button type="button" onClick={() => switchActor("00000000-0000-0000-0000-000000000002")}>Test trainer B</button>
    </aside>
    {children}
  </Auth.Provider>;
}
export function useAuth() { return useContext(Auth); }

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
const auth = vi.hoisted(() => ({ callback: undefined as undefined | ((event: string, session: Session | null) => void) }));
vi.mock("../supabase/client", () => ({ supabaseConfigured: true, supabase: { auth: {
  getSession: () => new Promise(() => {}),
  onAuthStateChange: (callback: typeof auth.callback) => { auth.callback = callback; return { data: { subscription: { unsubscribe: () => {} } } }; },
} } }));
import { AuthProvider } from "./AuthProvider";
import { clearCache, getCached, mutateCache } from "../supabase/cache";

afterEach(() => { cleanup(); clearCache(); });
const session = (id: string) => ({ user: { id } } as Session);

describe("authentication cache lifecycle", () => {
  it("clears horse records on external signout and account switch", () => {
    render(<AuthProvider><div /></AuthProvider>);
    act(() => auth.callback!("SIGNED_IN", session("A")));
    mutateCache(["horses"], "A records");
    act(() => auth.callback!("SIGNED_OUT", null));
    expect(getCached(["horses"])).toBeUndefined();
    mutateCache(["horses"], "pending records");
    act(() => auth.callback!("SIGNED_IN", session("B")));
    expect(getCached(["horses"])).toBeUndefined();
  });

  it("preserves same-account cache on token refresh", () => {
    render(<AuthProvider><div /></AuthProvider>);
    act(() => auth.callback!("SIGNED_IN", session("A")));
    mutateCache(["horses"], "A records");
    act(() => auth.callback!("TOKEN_REFRESHED", session("A")));
    expect(getCached(["horses"])).toBe("A records");
  });
});

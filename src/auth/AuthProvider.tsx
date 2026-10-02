import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../supabase/client";
import { clearCache } from "../supabase/cache";

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let disposed = false;
    let authEventSeen = false;
    let accountId: string | null = null;
    const applySession = (next: Session | null) => {
      if (disposed) return;
      const nextId = next?.user.id ?? null;
      if (accountId !== nextId) clearCache();
      accountId = nextId;
      setSession(next);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (!authEventSeen) applySession(data.session);
    }).catch(() => { if (!disposed) setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      authEventSeen = true;
      applySession(s);
    });
    return () => { disposed = true; sub.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      configured: supabaseConfigured,
      async signIn(email, password) {
        if (!supabase) throw new Error("Supabase not configured");
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      },
      async signUp(email, password) {
        if (!supabase) throw new Error("Supabase not configured");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
        clearCache();
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

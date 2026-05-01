import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <div className="card max-w-xl mx-auto mt-12 text-slate-300 space-y-2">
        <h1 className="text-xl font-semibold">Supabase not configured</h1>
        <p className="text-sm text-slate-400">
          Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> in your build environment, then
          redeploy.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center text-slate-400 mt-16">Loading session…</div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

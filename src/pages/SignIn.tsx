import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function SignIn() {
  const { signIn, user, configured } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    const dest = (location.state as { from?: Location } | null)?.from?.pathname ?? "/";
    return <Navigate to={dest} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {!configured && (
        <p className="text-sm text-amber-300">
          Supabase isn't configured yet. Sign-in won't work until env vars are set.
        </p>
      )}
      <form className="card space-y-3" onSubmit={onSubmit}>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-slate-400 text-center">
        No account?{" "}
        <Link to="/sign-up" className="underline text-brand-500">
          Sign up
        </Link>
      </p>
    </div>
  );
}

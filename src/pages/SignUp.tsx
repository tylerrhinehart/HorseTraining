import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function SignUp() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp(email, password);
      if (needsConfirmation) {
        setInfo("Check your email to confirm your account, then sign in.");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 space-y-4">
      <h1 className="text-2xl font-semibold">Create account</h1>
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
            autoComplete="new-password"
            className="input"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            At least 8 characters.
          </p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-emerald-400">{info}</p>}
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-slate-400 text-center">
        Already have an account?{" "}
        <Link to="/sign-in" className="underline text-brand-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}

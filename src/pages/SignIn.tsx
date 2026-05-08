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
    const dest =
      (location.state as { from?: Location } | null)?.from?.pathname ?? "/";
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
    <div className="view" style={{ maxWidth: 420, margin: "60px auto 0" }}>
      <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
        <span className="brand-mark">T</span>
        <div>
          <div className="brand-name">TQA Tracker</div>
          <div className="brand-sub">Industry standard · 5 phases</div>
        </div>
      </div>
      <h1 className="h-display" style={{ textAlign: "center" }}>
        Sign in
      </h1>
      {!configured && (
        <p
          className="card mono"
          style={{
            color: "var(--rust)",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          Supabase isn't configured yet. Sign-in won't work until env vars are
          set.
        </p>
      )}
      <form className="card" onSubmit={onSubmit}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="email" className="label">
            Email
          </label>
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
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="password" className="label">
            Password
          </label>
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
        {error && (
          <p
            style={{
              color: "var(--bad)",
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            {error}
          </p>
        )}
        <button
          className="btn btn-leather"
          type="submit"
          disabled={busy}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p
        className="muted"
        style={{ textAlign: "center", fontSize: 13, marginTop: 14 }}
      >
        No account?{" "}
        <Link to="/sign-up" style={{ color: "var(--leather)" }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}

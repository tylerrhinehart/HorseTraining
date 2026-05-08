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
    <div className="view" style={{ maxWidth: 420, margin: "60px auto 0" }}>
      <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
        <span className="brand-mark">T</span>
        <div>
          <div className="brand-name">TQA Tracker</div>
          <div className="brand-sub">Training quality assurance</div>
        </div>
      </div>
      <h1 className="h-display" style={{ textAlign: "center" }}>
        Create account
      </h1>
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
            autoComplete="new-password"
            className="input"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="muted mono" style={{ fontSize: 10, marginTop: 4 }}>
            At least 8 characters.
          </p>
        </div>
        {error && (
          <p style={{ color: "var(--bad)", fontSize: 13, marginBottom: 8 }}>
            {error}
          </p>
        )}
        {info && (
          <p style={{ color: "var(--ok)", fontSize: 13, marginBottom: 8 }}>
            {info}
          </p>
        )}
        <button
          className="btn btn-leather"
          type="submit"
          disabled={busy}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p
        className="muted"
        style={{ textAlign: "center", fontSize: 13, marginTop: 14 }}
      >
        Already have an account?{" "}
        <Link to="/sign-in" style={{ color: "var(--leather)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

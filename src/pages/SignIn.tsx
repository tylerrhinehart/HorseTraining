import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

interface FormValues {
  email: string;
  password: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const { signIn, user, configured } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  // True while a user-initiated submit is in flight; lets the explicit
  // post-submit navigate own the destination instead of the render-time guard.
  const submittingRef = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: "onSubmit" });

  // Only restore state.from when RequireAuth set it AND the user wasn't sent
  // here by their own sign-out (we can't perfectly detect that, so default to
  // "/" when no protected-route hint exists).
  const fromPathname =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? null;
  const safeFrom =
    fromPathname && fromPathname !== "/sign-in" && fromPathname !== "/sign-up"
      ? fromPathname
      : null;

  if (user && !submittingRef.current) {
    // Already authenticated landing on /sign-in (e.g. back-button) — go home.
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    submittingRef.current = true;
    try {
      await signIn(values.email, values.password);
      navigate(safeFrom ?? "/", { replace: true });
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-hero" aria-hidden="true">
        <div>
          <div className="hero-kicker">Command center · 5 phase TQA</div>
          <h1 className="hero-title">Run every horse like a high-signal training program.</h1>
          <p className="hero-copy">
            A redesigned cockpit for trainers: phase momentum, session quality,
            and finish readiness surfaced with less digging and more confidence.
          </p>
        </div>
        <div className="dashboard-preview">
          <div className="preview-card">
            <div className="eyebrow">Current phase</div>
            <div className="preview-metric">Foundation</div>
            <div className="preview-bars">
              <span style={{ width: "92%" }} />
              <span style={{ width: "74%" }} />
              <span style={{ width: "58%" }} />
            </div>
          </div>
          <div className="preview-card">
            <div className="eyebrow">Signal</div>
            <div className="preview-metric">+18%</div>
            <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              Quality trend over last 7 sessions
            </p>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 22 }}>
          <span className="brand-mark">T</span>
          <div>
            <div className="brand-name">TQA Tracker</div>
            <div className="brand-sub">Training command center</div>
          </div>
        </div>
        <form className="card auth-card" noValidate onSubmit={handleSubmit(onSubmit)}>
          <div className="hero-kicker" style={{ marginBottom: 16 }}>Secure trainer access</div>
          <h1 className="h-display" style={{ fontSize: 42, marginBottom: 10 }}>
            Welcome back
          </h1>
          <p className="muted" style={{ marginBottom: 22, fontSize: 14 }}>
            Sign in to open your training dashboard, active horses, and TQA scoring workspace.
          </p>
          {!configured && (
            <p
              className="alert-error"
              style={{ marginBottom: 14 }}
            >
              Supabase isn't configured yet. Sign-in won't work until env vars are
              set.
            </p>
          )}
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              aria-invalid={errors.email ? true : undefined}
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: EMAIL_RE,
                  message: "Enter a valid email address",
                },
              })}
            />
            {errors.email && (
              <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 4 }}>
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input"
              aria-invalid={errors.password ? true : undefined}
              {...register("password", { required: "Password is required" })}
            />
            {errors.password && (
              <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 4 }}>
                {errors.password.message}
              </p>
            )}
          </div>
          {submitError && (
            <div
              role="alert"
              className="alert-error"
              style={{ marginBottom: 12 }}
            >
              <span aria-hidden="true" className="alert-error-icon">
                ⚠
              </span>
              <div className="alert-error-body">{submitError}</div>
            </div>
          )}
          <button
            className="btn btn-leather"
            type="submit"
            disabled={isSubmitting}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {isSubmitting ? "Signing in…" : "Enter dashboard"}
          </button>
        </form>
        <p
          className="muted"
          style={{ textAlign: "center", fontSize: 13, marginTop: 16 }}
        >
          No account?{" "}
          <Link to="/sign-up" style={{ color: "var(--leather-2)" }}>
            Create one
          </Link>
        </p>
      </section>
    </div>
  );
}

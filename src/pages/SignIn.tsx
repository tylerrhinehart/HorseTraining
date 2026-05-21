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
    <div className="view" style={{ maxWidth: 420, margin: "60px auto 0" }}>
      <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
        <span className="brand-mark">T</span>
        <div>
          <div className="brand-name">TQA Tracker</div>
          <div className="brand-sub">Training quality assurance</div>
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
      <form className="card" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="field" style={{ marginBottom: 12 }}>
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
        <div className="field" style={{ marginBottom: 14 }}>
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
          {isSubmitting ? "Signing in…" : "Sign in"}
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

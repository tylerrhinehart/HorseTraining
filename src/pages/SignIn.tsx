import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useState } from "react";
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: "onSubmit" });

  if (user) {
    const dest =
      (location.state as { from?: Location } | null)?.from?.pathname ?? "/";
    return <Navigate to={dest} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await signIn(values.email, values.password);
      navigate("/");
    } catch (err) {
      setSubmitError((err as Error).message);
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
          <p
            style={{
              color: "var(--bad)",
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            {submitError}
          </p>
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

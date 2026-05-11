import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../auth/AuthProvider";

interface FormValues {
  email: string;
  password: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: "onSubmit" });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    setInfo(null);
    try {
      const { needsConfirmation } = await signUp(values.email, values.password);
      if (needsConfirmation) {
        setInfo("Check your email to confirm your account, then sign in.");
      } else {
        navigate("/");
      }
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
        Create account
      </h1>
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
            autoComplete="new-password"
            className="input"
            aria-invalid={errors.password ? true : undefined}
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 8,
                message: "Password must be at least 8 characters",
              },
            })}
          />
          {errors.password ? (
            <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 4 }}>
              {errors.password.message}
            </p>
          ) : (
            <p className="muted mono" style={{ fontSize: 10, marginTop: 4 }}>
              At least 8 characters.
            </p>
          )}
        </div>
        {submitError && (
          <p style={{ color: "var(--bad)", fontSize: 13, marginBottom: 8 }}>
            {submitError}
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
          disabled={isSubmitting}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
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

import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Field, Input } from "../components/ui";
import logoUrl from "../assets/saequip-logo.svg";

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.4-.6M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.4 13.4 0 0 1-2.6 3.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → send home.
  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — dark, matches the sidebar; the logo is built for dark backgrounds. */}
      <div className="relative hidden overflow-hidden bg-[#0A0A0A] lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:border-r lg:border-white/10">
        <div
          aria-hidden="true"
          className="absolute -top-24 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[#fed217]/20 blur-[110px]"
        />
        <div className="relative flex flex-col items-center gap-5 px-10 text-center">
          <img src={logoUrl} alt="SAEquip" className="h-32 w-auto" />
          <div className="h-px w-10 bg-accent" />
          <div>
            <p className="text-small font-semibold uppercase tracking-widest text-white">
              Product Manager
            </p>
            <p className="mx-auto mt-2 max-w-xs text-small text-white/50">
              Manage products, media, and quote requests in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Compact logo for small screens, where the brand panel is hidden. */}
          <img src={logoUrl} alt="SAEquip" className="mx-auto mb-8 h-28 w-auto lg:hidden" />

          <form
            onSubmit={onSubmit}
            className="rounded-xl border border-border bg-surface p-8 shadow-sm"
          >
            <h1 className="text-h2 font-semibold text-text">Welcome back</h1>
            <p className="mt-1 text-small text-muted">Sign in to continue</p>

            <div className="mt-6 space-y-4">
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label="Password" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle transition-colors hover:text-text"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </Field>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-small text-danger"
              >
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="mt-6 w-full">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>

            <p className="mt-5 text-center text-small text-subtle">
              Accounts are created by invitation only.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

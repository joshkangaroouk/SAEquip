import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useForceLightTheme } from "../lib/theme";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "../components/AuthShell";

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
  useForceLightTheme(); // auth pages are light only (redesign 02a Q15)
  const { user, loading, mfaPending, signIn, verifyMfa, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Second step: the account has a verified authenticator. */
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");

  /*
   * ⚠️ Already signed in → home, EXCEPT while the code is outstanding.
   * The password step creates a real (aal1) session, so `user` is already set
   * and this redirect would fire and skip the challenge — leaving a session
   * the API refuses with `mfa_required`, i.e. a dashboard that looks logged in
   * and loads nothing.
   */
  if (!loading && user && !needsCode && !mfaPending) return <Navigate to="/" replace />;
  // A session that still owes its code (e.g. after a reload) resumes the step.
  const showCode = needsCode || (!loading && !!user && mfaPending);

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
    if (result.mfaRequired) {
      setNeedsCode(true);
      return;
    }
    navigate("/", { replace: true });
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await verifyMfa(code);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      setCode("");
      return;
    }
    setNeedsCode(false);
    navigate("/", { replace: true });
  }

  /** Abandoning the challenge must end the half-finished session. */
  async function cancelCode() {
    setNeedsCode(false);
    setCode("");
    setError(null);
    setPassword("");
    await signOut();
  }

  if (showCode) {
    return (
      <AuthShell
        title="Enter your code"
        description="Open your authenticator app and type the 6-digit code for SAEquip."
      >
        <form onSubmit={onSubmitCode}>
          <div className="mt-6">
            <Field label="Authentication code" htmlFor="code">
              <Input
                id="code"
                // A one-time-code field: numeric keypad on mobile, and it
                // lets password managers and iOS autofill offer the code.
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </Field>
          </div>

          {error && (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          )}

          <Button type="submit" loading={submitting} className="mt-6 w-full" disabled={code.length < 6}>
            {submitting ? "Checking…" : "Verify"}
          </Button>
          <Button type="button" variant="ghost" onClick={cancelCode} className="mt-2 w-full">
            Cancel and sign out
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" description="Sign in to continue.">
      <form onSubmit={onSubmit}>
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
                className="pr-11"
              />
              {/* In the tab order (it was tabIndex -1, out of reach of the keyboard). */}
              <Button
                type="button"
                variant="ghost"
                icon
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-[3px] top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </div>
          </Field>
        </div>

        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-4 text-right">
          <Link to="/forgot-password" className="text-help text-muted underline-offset-2 hover:text-text hover:underline">
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" loading={submitting} className="mt-6 w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="mt-5 text-center text-help text-muted">Accounts are created by invitation only.</p>
      </form>
    </AuthShell>
  );
}

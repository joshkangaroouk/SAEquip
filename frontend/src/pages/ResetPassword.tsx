import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useForceLightTheme } from "../lib/theme";
import { Alert, Button, Field, Input, Loader } from "../components/ui";
import { AuthShell } from "../components/AuthShell";
import { assessPassword } from "../lib/passwordPolicy";
import { needsSecondFactor, verifyTotpCode } from "../lib/mfa";

/**
 * Choose a new password, landed on from the emailed recovery link.
 *
 * The link carries a recovery token in the URL fragment which the Supabase
 * client exchanges for a short-lived session on load (`detectSessionInUrl`),
 * so this page is reachable unauthenticated but only *works* while that
 * session exists — which is why it checks for one before showing the form
 * rather than letting someone bookmark it.
 *
 * ⚠️ Signs out afterwards on purpose. The recovery session is proof of mailbox
 * access, not of knowing the password; ending it forces one clean sign-in with
 * the new credential and, once MFA is enabled, sends the user through the
 * second factor rather than leaving them on a session that skipped it.
 *
 * ⚠️ An account with 2FA needs its code HERE too. The recovery link gives an
 * aal1 session, and Supabase refuses a password change from one once MFA is
 * on ("AAL2 session is required to update email or password when MFA is
 * enabled"). Without this step the page showed that raw error and the only
 * way out was the CLI. The code raises the recovery session to aal2 first.
 */
export default function ResetPassword() {
  useForceLightTheme(); // auth pages are light only (redesign 02a Q15)
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");

  /*
   * ⚠️ Both a listener AND a getSession() call, because the recovery token
   * arrives in the URL FRAGMENT and the Supabase client exchanges it
   * asynchronously on load. A lone getSession() races that exchange and
   * usually loses — reporting "this link has expired" on a link that is
   * perfectly good. onAuthStateChange fires PASSWORD_RECOVERY once the
   * exchange completes; getSession() covers the case where it already had.
   */
  useEffect(() => {
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        settled = true;
        setReady("ok");
        void needsSecondFactor().then(setNeedsCode);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      if (data.session) {
        settled = true;
        setReady("ok");
        void needsSecondFactor().then(setNeedsCode);
        return;
      }
      // Give the fragment exchange a moment before declaring the link dead.
      setTimeout(() => {
        if (!settled) setReady("no-session");
      }, 1500);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const verdict = assessPassword(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!verdict.ok || mismatch) return;
    if (needsCode && code.length < 6) return;
    setSubmitting(true);
    setError(null);

    if (needsCode) {
      const step = await verifyTotpCode(code);
      if (step.error) {
        setSubmitting(false);
        setCode("");
        setError(`That code didn't work: ${step.error}`);
        return;
      }
      setNeedsCode(false);
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitting(false);
      // The check above missed it (a factor confirmed since the page loaded):
      // ask for the code rather than show Supabase's wording.
      if ((error as { code?: string }).code === "insufficient_aal") {
        setNeedsCode(true);
        setError("This account uses two-factor authentication. Enter the code from your authenticator app.");
        return;
      }
      setError(error.message);
      return;
    }
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <AuthShell title="Choose a new password">
      {ready === "checking" && <Loader label="Checking your link…" />}

      {ready === "no-session" && (
        <>
          <Alert tone="danger" className="mt-5">
            This reset link is invalid or has expired. Request a new one.
          </Alert>
          <Button className="mt-6 w-full" onClick={() => navigate("/forgot-password")}>
            Request a new link
          </Button>
        </>
      )}

      {ready === "ok" && (
        <form onSubmit={onSubmit}>
          <div className="mt-6 space-y-4">
            <Field label="New password" htmlFor="password">
              <Input
                id="password"
                type="password"
                required
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {/* A mismatch is this field's own error: marked invalid and described by it. */}
            <Field label="Confirm password" htmlFor="confirm" error={mismatch ? "The two passwords don't match." : undefined}>
              <Input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            {needsCode && (
              <Field
                label="Authentication code"
                htmlFor="code"
                hint="This account uses two-factor authentication, so enter the 6-digit code from your authenticator app as well."
              >
                <Input
                  id="code"
                  // As on the login page: numeric keypad on mobile, and
                  // password managers and iOS autofill can offer the code.
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </Field>
            )}
          </div>

          {password.length > 0 && !verdict.ok && (
            <ul className="t-help mt-3 list-disc space-y-0.5 pl-5">
              {verdict.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {error && (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={submitting || !verdict.ok || mismatch || !confirm || (needsCode && code.length < 6)}
          >
            {submitting ? "Saving…" : "Save new password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

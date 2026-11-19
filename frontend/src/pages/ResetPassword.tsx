import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { landedWith, supabase } from "../lib/supabase";
import { authRedirectMessage } from "../lib/authRedirect";
import { reportActivity } from "../lib/activity";
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
 *
 * ⚠️ The form appears ONLY for the session the recovery link created
 * (USERS-AUDIT M3, 2026-11-19). It used to appear for any session, and
 * supabase-js keeps an existing session when the link in the address fails:
 * on a shared computer, someone opening their own EXPIRED link changed the
 * password of whoever was already signed in. Now the page:
 * - shows the link's own error when Supabase put one in the address;
 * - checks the session belongs to the user the link's token names
 *   (`landedWith`, read before the Supabase client cleared the address);
 * - remembers that for this tab only, so a reload keeps working;
 * - names the account it is about to change.
 */
const RECOVERY_KEY = "hub-recovery-user";

function rememberedRecoveryUser(): string | null {
  try {
    return sessionStorage.getItem(RECOVERY_KEY);
  } catch {
    return null;
  }
}
function rememberRecoveryUser(id: string | null) {
  try {
    if (id) sessionStorage.setItem(RECOVERY_KEY, id);
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* storage blocked: a reload will simply ask for a new link */
  }
}
export default function ResetPassword() {
  useForceLightTheme(); // auth pages are light only (redesign 02a Q15)
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "no-session" | "link-error">(
    landedWith.error ? "link-error" : "checking",
  );
  const [email, setEmail] = useState<string | null>(null);
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
   * usually loses, reporting "this link has expired" on a link that is
   * perfectly good. Whichever sees the session first decides, and only a
   * session for the link's own user (or this tab's remembered one) counts.
   */
  useEffect(() => {
    if (landedWith.error) {
      rememberRecoveryUser(null);
      return;
    }
    let settled = false;
    const expected = landedWith.recovery ? landedWith.recoveryUserId : rememberedRecoveryUser();

    const accept = (session: { user: { id: string; email?: string | null } } | null) => {
      if (settled || !session || !expected || session.user.id !== expected) return false;
      settled = true;
      rememberRecoveryUser(session.user.id);
      setEmail(session.user.email ?? null);
      setReady("ok");
      void needsSecondFactor().then(setNeedsCode);
      return true;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") accept(session);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (accept(data.session)) return;
      // Give the fragment exchange a moment before declaring the link dead.
      setTimeout(() => {
        if (!settled) {
          rememberRecoveryUser(null);
          setReady("no-session");
        }
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
    // Recorded while the recovery session can still say who it was.
    await reportActivity("auth.password_changed");
    rememberRecoveryUser(null);
    // Global on purpose: a new password should end every session, not only this one.
    await supabase.auth.signOut({ scope: "global" });
    navigate("/login", { replace: true });
  }

  return (
    <AuthShell title="Choose a new password">
      {ready === "checking" && <Loader label="Checking your link…" />}

      {(ready === "no-session" || ready === "link-error") && (
        <>
          <Alert tone="danger" className="mt-5">
            {ready === "link-error" && landedWith.error
              ? authRedirectMessage(landedWith.error)
              : "Open the reset link from your email to choose a new password. If it has expired, request a new one."}
          </Alert>
          <Button className="mt-6 w-full" onClick={() => navigate("/forgot-password")}>
            Request a new link
          </Button>
        </>
      )}

      {ready === "ok" && (
        <form onSubmit={onSubmit}>
          {email && (
            <p className="t-help mt-4">
              Choosing a new password for <strong className="font-semibold text-text">{email}</strong>.
            </p>
          )}
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

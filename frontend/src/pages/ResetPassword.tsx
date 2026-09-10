import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button, Field, Input } from "../components/ui";
import { assessPassword } from "../lib/passwordPolicy";
import logoUrl from "../assets/saequip-logo.svg";

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
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setReady(data.session ? "ok" : "no-session");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const verdict = assessPassword(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!verdict.ok || mismatch) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitting(false);
      setError(error.message);
      return;
    }
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm">
        <img src={logoUrl} alt="SAEquip" className="mx-auto mb-8 h-24 w-auto" />
        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-h2 font-semibold text-text">Choose a new password</h1>

          {ready === "checking" && <p className="mt-3 text-small text-muted">Checking your link…</p>}

          {ready === "no-session" && (
            <>
              <p className="mt-3 text-small text-muted">
                This reset link is invalid or has expired. Request a new one.
              </p>
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
                <Field label="Confirm password" htmlFor="confirm">
                  <Input
                    id="confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </Field>
              </div>

              {password.length > 0 && !verdict.ok && (
                <ul className="mt-3 list-disc space-y-0.5 pl-5 text-small text-muted">
                  {verdict.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {mismatch && <p className="mt-3 text-small text-danger">The two passwords don't match.</p>}
              {error && <p className="mt-3 text-small text-danger">{error}</p>}

              <Button
                type="submit"
                className="mt-6 w-full"
                disabled={submitting || !verdict.ok || mismatch || !confirm}
              >
                {submitting ? "Saving…" : "Save new password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

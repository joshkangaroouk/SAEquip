import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useForceLightTheme } from "../lib/theme";
import { Alert, Button, Field, Input } from "../components/ui";
import { AuthShell } from "../components/AuthShell";

/**
 * Request a password-reset email.
 *
 * ⚠️ Always reports success, whether or not the address has an account.
 * Telling the visitor "no such user" would turn this into a free membership
 * oracle for the whole staff directory, which is worth more to an attacker
 * than the reset itself. Supabase behaves the same way for the same reason.
 */
export default function ForgotPassword() {
  useForceLightTheme(); // auth pages are light only (redesign 02a Q15)
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    // A transport failure is worth showing; a "user not found" is not, and
    // Supabase does not distinguish them here.
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  const back = (
    <Link to="/login" className="mt-5 inline-block text-help text-muted underline-offset-2 hover:text-text hover:underline">
      ← Back to sign in
    </Link>
  );

  return (
    <AuthShell
      title="Reset your password"
      description={sent ? undefined : "We'll email you a link to choose a new one."}
    >
      {sent ? (
        <>
          <Alert tone="ok" className="mt-5">
            If <span className="font-medium">{email}</span> has an account, a reset link is on its way. The link
            expires shortly, so use it soon.
          </Alert>
          {back}
        </>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="mt-6">
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
          </div>
          {error && (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          )}
          <Button type="submit" className="mt-6 w-full" disabled={submitting || !email.trim()}>
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
          {back}
        </form>
      )}
    </AuthShell>
  );
}

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button, Field, Input } from "../components/ui";
import logoUrl from "../assets/saequip-logo.svg";

/**
 * Request a password-reset email.
 *
 * ⚠️ Always reports success, whether or not the address has an account.
 * Telling the visitor "no such user" would turn this into a free membership
 * oracle for the whole staff directory, which is worth more to an attacker
 * than the reset itself. Supabase behaves the same way for the same reason.
 */
export default function ForgotPassword() {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm">
        <img src={logoUrl} alt="SAEquip" className="mx-auto mb-8 h-24 w-auto" />
        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
          <h1 className="text-h2 font-semibold text-text">Reset your password</h1>

          {sent ? (
            <>
              <p className="mt-3 text-small text-muted">
                If <span className="font-medium text-text">{email}</span> has an account, a reset link
                is on its way. The link expires shortly, so use it soon.
              </p>
              <Link to="/login" className="mt-6 inline-block text-small font-semibold text-accent-strong">
                ← Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <p className="mt-1 text-small text-muted">
                We'll email you a link to choose a new one.
              </p>
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
              {error && <p className="mt-3 text-small text-danger">{error}</p>}
              <Button type="submit" className="mt-6 w-full" disabled={submitting || !email.trim()}>
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
              <Link to="/login" className="mt-4 inline-block text-small text-muted hover:text-text">
                ← Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

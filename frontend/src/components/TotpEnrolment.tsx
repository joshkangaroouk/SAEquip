import { useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/cn";
import { Alert, Button, Input } from "./ui";

/** One step of turning two-factor on, with its yellow square number (00). */
function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center bg-accent text-label font-semibold text-accent-ink"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text">
          <span className="sr-only">Step {n}: </span>
          {title}
        </p>
        {children}
      </div>
    </li>
  );
}

/**
 * Adding an authenticator: the three steps (an app, the QR code, a code) and
 * the button that starts it. Shared by Security and the /setup-2fa page that
 * an invited user, or the super admin, must finish before the dashboard loads.
 *
 * ⚠️ Enrolment happens in the BROWSER, against this user's own session: there
 * is no admin API to enrol a factor for someone, and there shouldn't be, since
 * the secret must reach their app and nobody else's. Cancelling removes the
 * half-finished factor.
 */
export function TotpEnrolment({
  idleSteps,
  startLabel,
  startVariant = "primary",
  onEnrolled,
  className,
}: {
  /** Show the steps before Start is pressed (while two-factor is off). */
  idleSteps: boolean;
  startLabel: string;
  startVariant?: "primary" | "secondary";
  /** Called once the code is accepted: the session is now aal2. */
  onEnrolled: () => void | Promise<void>;
  className?: string;
}) {
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    // A friendly name keeps several devices distinguishable, and Supabase
    // rejects a duplicate name — hence the timestamp.
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  }

  async function confirm() {
    if (!enrolling || code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    const challenge = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (challenge.error) {
      setBusy(false);
      setError(challenge.error.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrolling.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEnrolling(null);
    setCode("");
    await onEnrolled();
  }

  async function cancel() {
    if (!enrolling) return;
    // Leave no half-finished factor behind: an unverified one is harmless
    // (requireAuth ignores it) but it clutters the list and blocks the name.
    await supabase.auth.mfa.unenroll({ factorId: enrolling.id }).catch(() => {});
    setEnrolling(null);
    setCode("");
  }

  return (
    <div className={className}>
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {(idleSteps || enrolling) && (
        <ol className="space-y-5 text-body">
          <Step n={1} title="Get an authenticator app">
            <p className="t-help mt-1">Google Authenticator, 1Password, Authy, Microsoft Authenticator — any of them.</p>
          </Step>
          <Step n={2} title="Scan the QR code with it">
            {enrolling ? (
              <>
                {/* Supabase returns the QR as an SVG data URI. Always on --paper, or a phone may not read it. */}
                <img src={enrolling.qr} alt="Two-factor QR code" className="mt-3 h-44 w-44 border border-border bg-paper p-2" />
                <details className="mt-2">
                  <summary className="t-label cursor-pointer hover:text-text">Can't scan it?</summary>
                  <p className="t-help mt-1">Type this key in by hand:</p>
                  <code className="t-code mt-1 block break-all border border-border bg-surface-2 px-2 py-1 text-text">
                    {enrolling.secret}
                  </code>
                </details>
              </>
            ) : (
              <p className="t-help mt-1">It appears here when you start.</p>
            )}
          </Step>
          <Step n={3} title="Enter the 6-digit code it shows">
            {enrolling ? (
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void confirm();
                }}
              >
                <div className="w-32">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    aria-label="Authentication code"
                    autoFocus
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => void cancel()} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || code.trim().length < 6}>
                  {busy ? "Checking…" : "Confirm"}
                </Button>
              </form>
            ) : (
              <p className="t-help mt-1">Two-factor is on once the code is accepted.</p>
            )}
          </Step>
        </ol>
      )}
      {!enrolling && (
        <div className={cn((idleSteps || enrolling) && "mt-5")}>
          <Button variant={startVariant} onClick={() => void start()} disabled={busy}>
            {startLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

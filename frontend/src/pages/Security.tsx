import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { useSignOut } from "../hooks/useSignOut";
import { PageHeader, Alert, Badge, Button, ButtonLink, Card, CardHeader, Input, toast, useConfirm } from "../components/ui";

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
 * Two-factor setup for the signed-in user.
 *
 * ⚠️ Enrolment must happen in the BROWSER, against this user's own session —
 * there is no admin API to enrol a factor on someone's behalf, and there
 * shouldn't be: the secret has to reach their authenticator app and nobody
 * else's. The backend's only role is enforcement (`requireAuth` rejects an
 * `aal1` token once a factor is verified) and the lockout escape hatch
 * (`npm run users:mfa -- --reset`).
 */
export default function Security() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const signOut = useSignOut();

  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // In-progress enrolment.
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setFactors(data.all ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verified = (factors ?? []).filter((f) => f.status === "verified");

  async function startEnrol() {
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

  async function confirmEnrol() {
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
    toast.success("Two-factor is on. You'll be asked for a code next time you sign in.");
    await load();
  }

  async function cancelEnrol() {
    if (!enrolling) return;
    // Leave no half-finished factor behind: an unverified one is harmless
    // (requireAuth ignores it) but it clutters the list and blocks the name.
    await supabase.auth.mfa.unenroll({ factorId: enrolling.id }).catch(() => {});
    setEnrolling(null);
    setCode("");
    await load();
  }

  async function remove(factor: Factor) {
    const ok = await confirm({
      title: "Turn off two-factor?",
      description:
        "Your account will be protected by its password alone. Anyone who learns that password gets full access to every product on the live site.",
      confirmLabel: "Turn off",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor turned off.");
    await load();
  }

  const on = verified.length > 0;
  // The steps show while two-factor is off, and while another device is being added.
  const showSteps = !on || !!enrolling;

  return (
    <>
      <PageHeader
        title="Security"
        description={
          <>
            Two-factor authentication for <span className="font-medium text-text">{user?.email}</span>.
          </>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="mt-5 space-y-5">
        <Card>
          <CardHeader
            title="Two-factor authentication"
            description="A 6-digit code from an app on your phone, on top of your password."
            actions={on ? <Badge tone="ok">On</Badge> : <Badge tone="neutral">Off</Badge>}
          />

          {/* Existing factors */}
          {factors && on && (
            <ul className="space-y-2">
              {verified.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface-2 px-3 py-2"
                >
                  <span className="text-body text-text">{f.friendly_name || "Authenticator"}</span>
                  <Button variant="secondary" size="sm" onClick={() => remove(f)}>
                    Turn off
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {showSteps && (
            <ol className={on ? "mt-5 space-y-5 text-body" : "space-y-5 text-body"}>
              <Step n={1} title="Get an authenticator app">
                <p className="t-help mt-1">Google Authenticator, 1Password, Authy, Microsoft Authenticator — any of them.</p>
              </Step>
              <Step n={2} title="Scan the QR code with it">
                {enrolling ? (
                  <>
                    {/* Supabase returns the QR as an SVG data URI. Always on --paper, or a phone may not read it. */}
                    <img
                      src={enrolling.qr}
                      alt="Two-factor QR code"
                      className="mt-3 h-44 w-44 border border-border bg-paper p-2"
                    />
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
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="w-32">
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        aria-label="Authentication code"
                      />
                    </div>
                    <Button variant="secondary" onClick={cancelEnrol} disabled={busy}>
                      Cancel
                    </Button>
                    <Button onClick={confirmEnrol} disabled={busy || code.trim().length < 6}>
                      {busy ? "Checking…" : "Confirm"}
                    </Button>
                  </div>
                ) : (
                  <p className="t-help mt-1">Two-factor is on once the code is accepted.</p>
                )}
              </Step>
            </ol>
          )}

          {/* Start: the primary action while off; adding a second device is secondary. */}
          {!enrolling && (
            <div className="mt-5">
              <Button variant={on ? "secondary" : "primary"} onClick={startEnrol} disabled={busy}>
                {on ? "Add another device" : "Turn on two-factor"}
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Password"
            description="To change your password, we email you a link to set a new one."
          />
          {/* The existing reset flow, unchanged: the same page a signed-out user would use. */}
          <ButtonLink href="/forgot-password" size="sm">
            Reset your password
          </ButtonLink>
        </Card>

        <Card>
          <CardHeader title="Signed in" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-muted">
              Signed in as <span className="font-medium text-text">{user?.email}</span>
            </p>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

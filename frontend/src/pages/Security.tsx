import { useCallback, useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, Card, Input, toast, useConfirm } from "../components/ui";

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

  return (
    <>
      <h1 className="text-xl font-semibold text-text">Security</h1>
      <p className="mt-1 text-sm text-muted">
        Two-factor authentication for <span className="font-medium text-text">{user?.email}</span>.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-body font-semibold text-text">Authenticator app</h2>
            <p className="mt-1 text-sm text-muted">
              A 6-digit code from an app on your phone, on top of your password.
            </p>
          </div>
          {verified.length > 0 ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>}
        </div>

        {/* Existing factors */}
        {factors && verified.length > 0 && (
          <ul className="mt-4 space-y-2">
            {verified.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2"
              >
                <span className="text-sm text-text">{f.friendly_name || "Authenticator"}</span>
                <Button variant="secondary" size="sm" onClick={() => remove(f)}>
                  Turn off
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Enrolment */}
        {!enrolling && (
          <div className="mt-4">
            <Button onClick={startEnrol} disabled={busy}>
              {verified.length > 0 ? "Add another device" : "Turn on two-factor"}
            </Button>
          </div>
        )}

        {enrolling && (
          <div className="mt-5 rounded-lg border border-border bg-surface-2 p-4">
            <ol className="space-y-4 text-sm text-text">
              <li>
                <p className="font-semibold">1. Scan this with your authenticator app</p>
                <p className="mt-1 text-muted">
                  Google Authenticator, 1Password, Authy, Microsoft Authenticator — any of them.
                </p>
                {/* Supabase returns the QR as an SVG data URI. */}
                <img
                  src={enrolling.qr}
                  alt="Two-factor QR code"
                  className="mt-3 h-44 w-44 rounded-md border border-border bg-white p-2"
                />
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted hover:text-text">
                    Can't scan it?
                  </summary>
                  <p className="mt-1 text-xs text-muted">Type this key in by hand:</p>
                  <code className="mt-1 block break-all rounded bg-surface px-2 py-1 text-xs text-text">
                    {enrolling.secret}
                  </code>
                </details>
              </li>
              <li>
                <p className="font-semibold">2. Enter the 6-digit code it shows</p>
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
                  <Button onClick={confirmEnrol} disabled={busy || code.trim().length < 6}>
                    {busy ? "Checking…" : "Confirm"}
                  </Button>
                  <Button variant="secondary" onClick={cancelEnrol} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </li>
            </ol>
          </div>
        )}
      </Card>

    </>
  );
}

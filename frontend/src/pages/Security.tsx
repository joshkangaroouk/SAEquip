import { useCallback, useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { useSignOut } from "../hooks/useSignOut";
import { PageHeader, Alert, Badge, Button, ButtonLink, Card, CardHeader, toast, useConfirm } from "../components/ui";
import { TotpEnrolment } from "../components/TotpEnrolment";

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
  // Invited accounts and the super admin must keep two-factor: their last
  // authenticator cannot be turned off (the API would refuse them anyway).
  const required = (user?.app_metadata as { mfa_required?: unknown } | undefined)?.mfa_required === true;
  const canTurnOff = !required || verified.length > 1;

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
                  {canTurnOff ? (
                    <Button variant="secondary" size="sm" onClick={() => remove(f)}>
                      Turn off
                    </Button>
                  ) : (
                    <span className="t-help text-muted">Required for your account</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* The steps show while two-factor is off, and while another device is being added. */}
          <TotpEnrolment
            className={on ? "mt-5" : undefined}
            idleSteps={!on}
            startLabel={on ? "Add another device" : "Turn on two-factor"}
            startVariant={on ? "secondary" : "primary"}
            onEnrolled={async () => {
              toast.success("Two-factor is on. You'll be asked for a code next time you sign in.");
              await load();
            }}
          />
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

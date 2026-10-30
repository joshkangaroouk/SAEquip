import { useEffect, useState } from "react";
import { Alert, Badge, Card, CardHeader, PageHeader } from "../components/ui";
import { apiFetch } from "../lib/api";

type Health = "loading" | "ok" | "unreachable";
type Me = { status: "loading" } | { status: "ok"; email: string } | { status: "error" };

export default function Status() {
  const [health, setHealth] = useState<Health>("loading");
  const [me, setMe] = useState<Me>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { status?: string }) => {
        if (!cancelled) setHealth(d.status === "ok" ? "ok" : "unreachable");
      })
      .catch(() => {
        if (!cancelled) setHealth("unreachable");
      });

    apiFetch("/api/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { email?: string }) => {
        if (!cancelled) setMe(d.email ? { status: "ok", email: d.email } : { status: "error" });
      })
      .catch(() => {
        if (!cancelled) setMe({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** The chip for a check: neutral while it runs, ok or danger once it answers (02 status tones). */
  const chip = (state: "loading" | "ok" | "failed", ok: string, failed: string) =>
    state === "loading" ? (
      <Badge tone="neutral">Checking…</Badge>
    ) : state === "ok" ? (
      <Badge tone="ok">{ok}</Badge>
    ) : (
      <Badge tone="danger">{failed}</Badge>
    );
  const meState = me.status === "error" ? "failed" : me.status;
  const failed = health === "unreachable" || me.status === "error";

  // Reachable by URL only, like /widgets: not in the nav (02a Q16).
  return (
    <>
      <PageHeader title="System status" description="Whether this dashboard can reach its API, and as whom." />

      {failed && (
        <Alert tone="danger" className="mb-5">
          Something isn't answering. The checks below say which.
        </Alert>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Backend health"
            actions={chip(health === "unreachable" ? "failed" : health, "OK", "Unreachable")}
          />
          <p className="text-body text-muted">
            <span className="t-code-sm">/api/health</span>{" "}
            {health === "loading" ? "is being checked." : health === "ok" ? "answered ok." : "didn't answer ok."}
          </p>
        </Card>

        <Card>
          <CardHeader title="Authenticated API call" actions={chip(meState, "Signed in", "Failed")} />
          <p className="text-body text-muted">
            {me.status === "loading" && (
              <>
                Checking <span className="t-code-sm">/api/me</span>…
              </>
            )}
            {me.status === "ok" && (
              <>
                Authenticated as <span className="font-medium text-text">{me.email}</span>
              </>
            )}
            {me.status === "error" && (
              <>
                <span className="t-code-sm">/api/me</span> failed.
              </>
            )}
          </p>
        </Card>
      </div>
    </>
  );
}

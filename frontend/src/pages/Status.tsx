import { useEffect, useState } from "react";
import { Card } from "../components/ui";
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

  const healthColor =
    health === "loading" ? "text-muted" : health === "ok" ? "text-success" : "text-danger";
  const healthDot =
    health === "loading" ? "bg-subtle" : health === "ok" ? "bg-success" : "bg-danger";
  const healthLabel =
    health === "loading"
      ? "Backend: checking…"
      : health === "ok"
        ? "Backend: ok"
        : "Backend: unreachable";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-lg font-semibold text-text">System status</h1>

        <Card>
          <h2 className="text-sm font-semibold text-muted">Backend health</h2>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-full ${healthDot}`} />
            <span className={`font-semibold ${healthColor}`}>{healthLabel}</span>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-muted">Authenticated API call</h2>
          <div className="mt-2 font-semibold">
            {me.status === "loading" && <span className="text-muted">Checking /api/me…</span>}
            {me.status === "ok" && (
              <span className="text-success">Authenticated as {me.email}</span>
            )}
            {me.status === "error" && <span className="text-danger">/api/me failed</span>}
          </div>
        </Card>
    </div>
  );
}

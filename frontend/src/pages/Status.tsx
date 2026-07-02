import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
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
    health === "loading" ? "text-gray-500" : health === "ok" ? "text-green-600" : "text-red-600";
  const healthDot =
    health === "loading" ? "bg-gray-400" : health === "ok" ? "bg-green-500" : "bg-red-500";
  const healthLabel =
    health === "loading"
      ? "Backend: checking…"
      : health === "ok"
        ? "Backend: ok"
        : "Backend: unreachable";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto mt-8 max-w-md space-y-4 px-4">
        <h1 className="text-lg font-semibold text-gray-900">System status</h1>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-500">Backend health</h2>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-full ${healthDot}`} />
            <span className={`font-medium ${healthColor}`}>{healthLabel}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-500">Authenticated API call</h2>
          <div className="mt-2 font-medium">
            {me.status === "loading" && <span className="text-gray-500">Checking /api/me…</span>}
            {me.status === "ok" && (
              <span className="text-green-600">Authenticated as {me.email}</span>
            )}
            {me.status === "error" && <span className="text-red-600">/api/me failed</span>}
          </div>
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";

const HEALTH_URL = "http://localhost:4000/api/health";

type HealthState = "loading" | "ok" | "unreachable";

export default function App() {
  const [health, setHealth] = useState<HealthState>("loading");

  useEffect(() => {
    let cancelled = false;

    fetch(HEALTH_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { status?: string }) => {
        if (cancelled) return;
        setHealth(data.status === "ok" ? "ok" : "unreachable");
      })
      .catch(() => {
        if (!cancelled) setHealth("unreachable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    health === "loading"
      ? "Backend: checking…"
      : health === "ok"
        ? "Backend: ok"
        : "Backend: unreachable";

  const color =
    health === "loading"
      ? "text-gray-500"
      : health === "ok"
        ? "text-green-600"
        : "text-red-600";

  const dot =
    health === "loading"
      ? "bg-gray-400"
      : health === "ok"
        ? "bg-green-500"
        : "bg-red-500";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          SAEquip Product Hub
        </h1>
        <p className="mt-1 text-sm text-gray-500">Internal dashboard</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full ${dot}`} />
          <span className={`text-lg font-medium ${color}`}>{label}</span>
        </div>
      </div>
    </div>
  );
}

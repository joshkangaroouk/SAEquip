import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import type { ProductLogoEntry } from "../lib/types";

/**
 * Per-product logo activation. Renders the full catalog for a kind as toggle
 * cards; toggling applies immediately (PUT to activate, DELETE to deactivate)
 * with optimistic UI and revert-on-error.
 */
export function LogoActivationPanel({
  productId,
  kind,
  title,
  onToast,
}: {
  productId: string;
  kind: "SA_LOGO" | "CERT_LOGO";
  title: string;
  onToast: (msg: string, error?: boolean) => void;
}) {
  const [entries, setEntries] = useState<ProductLogoEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/products/${productId}/logos?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ProductLogoEntry[]) => {
        if (!cancelled) setEntries(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, kind]);

  async function toggle(entry: ProductLogoEntry) {
    const next = !entry.active;
    // optimistic
    setEntries((es) => es?.map((e) => (e.id === entry.id ? { ...e, active: next } : e)) ?? null);
    try {
      const res = await apiFetch(`/api/products/${productId}/logos/${entry.id}`, {
        method: next ? "PUT" : "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // revert
      setEntries((es) => es?.map((e) => (e.id === entry.id ? { ...e, active: !next } : e)) ?? null);
      onToast(`Couldn't ${next ? "activate" : "deactivate"} logo — reverted`, true);
    }
  }

  const activeCount = entries?.filter((e) => e.active).length ?? 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {entries && entries.length > 0 && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
            {activeCount} active
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-subtle">
        Select which logos display on this product. Manage the catalog in{" "}
        <Link to="/logos" className="text-text underline underline-offset-2 hover:text-muted">
          Logos
        </Link>
        .
      </p>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && entries && entries.length === 0 && (
        <p className="text-sm text-subtle">
          No {kind === "SA_LOGO" ? "SA" : "Cert"} logos in the catalog yet —{" "}
          <Link to="/logos" className="text-text underline underline-offset-2 hover:text-muted">
            add some
          </Link>
          .
        </p>
      )}

      {!loading && !error && entries && entries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => toggle(entry)}
              className={`flex flex-col items-center rounded-lg border-2 p-2 text-left transition ${
                entry.active ? "border-accent bg-accent/10" : "border-border hover:border-subtle"
              }`}
            >
              <div className="flex h-16 w-full items-center justify-center bg-surface-2">
                <img
                  src={entry.url}
                  alt={entry.alt || entry.label || "logo"}
                  className="max-h-16 max-w-full object-contain"
                />
              </div>
              <div className="mt-2 flex w-full items-center justify-between gap-1">
                <span className="truncate text-xs text-muted" title={entry.label ?? ""}>
                  {entry.label || "—"}
                </span>
                <span
                  className={`inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full px-0.5 ${
                    entry.active ? "justify-end bg-success" : "justify-start bg-subtle"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full bg-surface" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import type { HubCustomPayload } from "../lib/types";
import { SpecTableEditor } from "./SpecTableEditor";
import { TextItemListEditor } from "./TextItemListEditor";
import { LogoActivationPanel } from "./LogoActivationPanel";
import { DownloadsEditor } from "./DownloadsEditor";

export function HubContent({ productId }: { productId: string }) {
  const [data, setData] = useState<HubCustomPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  async function fetchCustom(): Promise<HubCustomPayload> {
    const r = await apiFetch(`/api/products/${productId}/custom`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCustom()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load hub content");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function pushToast(msg: string, isError?: boolean) {
    setToast({ msg, error: isError });
  }
  function handleSaved(msg: string) {
    pushToast(msg);
    fetchCustom()
      .then(setData)
      .catch(() => {});
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-text">Hub Content</h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
          Stored in Supabase
        </span>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg ${
            toast.error ? "bg-danger" : "bg-success"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Per-product logo activation — self-loading, independent of /custom */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <LogoActivationPanel productId={productId} kind="SA_LOGO" title="SA Logos" onToast={pushToast} />
        <LogoActivationPanel productId={productId} kind="CERT_LOGO" title="Cert Logos" onToast={pushToast} />
      </div>

      {loading && <p className="text-sm text-muted">Loading hub content…</p>}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          <SpecTableEditor productId={productId} initial={data.specs} onSaved={handleSaved} />
          <TextItemListEditor
            title="Key Benefits"
            productId={productId}
            endpoint="benefits"
            initial={data.benefits}
            onSaved={handleSaved}
          />
          <TextItemListEditor
            title="Applications"
            productId={productId}
            endpoint="applications"
            initial={data.applications}
            onSaved={handleSaved}
          />
        </div>
      )}

      {/* Downloads editor — self-loading, independent of /custom */}
      <DownloadsEditor productId={productId} onToast={pushToast} />
    </div>
  );
}

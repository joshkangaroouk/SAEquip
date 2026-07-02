import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../lib/api";
import type { HubCustomPayload } from "../lib/types";
import { SpecTableEditor } from "./SpecTableEditor";
import { TextItemListEditor } from "./TextItemListEditor";
import { LogoActivationPanel } from "./LogoActivationPanel";

function ReadOnlySection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-gray-400">No items yet</p>
      ) : (
        <div className="space-y-1 text-sm text-gray-700">{children}</div>
      )}
    </section>
  );
}

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
        <h2 className="text-lg font-semibold text-gray-900">Hub Content</h2>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          Stored in Supabase
        </span>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.error ? "bg-red-600" : "bg-green-600"
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

      {loading && <p className="text-sm text-gray-500">Loading hub content…</p>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

          {/* Downloads — read-only for now (Step 10) */}
          <ReadOnlySection title="Downloads" count={data.downloads.length}>
            {data.downloads.map((d) => (
              <div key={d.id}>
                {d.title} {d.gated && <span className="text-xs text-gray-400">(gated)</span>}
              </div>
            ))}
          </ReadOnlySection>
        </div>
      )}
    </div>
  );
}

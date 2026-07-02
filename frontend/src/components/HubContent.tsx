import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "../lib/api";
import type { HubCustomPayload } from "../lib/types";

function ContentSection({
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(`/api/products/${productId}/custom`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: HubCustomPayload) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Hub Content</h2>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          Stored in Supabase
        </span>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading hub content…</p>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ContentSection title="SA Logos" count={data.logos.sa.length}>
            {data.logos.sa.map((l) => (
              <div key={l.id}>{l.alt || l.mediaAsset.filename}</div>
            ))}
          </ContentSection>

          <ContentSection title="Cert Logos" count={data.logos.cert.length}>
            {data.logos.cert.map((l) => (
              <div key={l.id}>{l.alt || l.mediaAsset.filename}</div>
            ))}
          </ContentSection>

          <ContentSection title="Technical Specs" count={data.specs.length}>
            {data.specs.map((s) => (
              <div key={s.id}>
                <span className="font-medium">{s.label}:</span> {s.value}
              </div>
            ))}
          </ContentSection>

          <ContentSection title="Key Benefits" count={data.benefits.length}>
            {data.benefits.map((b) => (
              <div key={b.id}>{b.text}</div>
            ))}
          </ContentSection>

          <ContentSection title="Applications" count={data.applications.length}>
            {data.applications.map((a) => (
              <div key={a.id}>{a.text}</div>
            ))}
          </ContentSection>

          <ContentSection title="Downloads" count={data.downloads.length}>
            {data.downloads.map((d) => (
              <div key={d.id}>
                {d.title} {d.gated && <span className="text-xs text-gray-400">(gated)</span>}
              </div>
            ))}
          </ContentSection>
        </div>
      )}
    </div>
  );
}

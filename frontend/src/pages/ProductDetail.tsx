import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { StatusBadge } from "../components/ui";
import { RichHtml } from "../components/RichHtml";
import { HubContent } from "../components/HubContent";
import type { ProductDetail as Product } from "../lib/types";

function formatPrice(product: Product): string | null {
  const p = product.prices?.[0];
  return p ? `${p.currency} ${p.price}` : null;
}

const managedNote = (
  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
    Read Only
  </span>
);

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/products/${id}`);
        if (!res.ok) throw new Error(`/api/products/${id} returned ${res.status}`);
        const data: Product = await res.json();
        if (!cancelled) setProduct(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load product");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm text-muted hover:text-text">
          ← Back to products
        </Link>

        {loading && <p className="mt-6 text-muted">Loading product…</p>}
        {error && (
          <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {!loading && !error && product && (
          <div className="mt-4 space-y-6">
            {/* Native Duda fields — read only. Only Hub content below (specs,
                benefits, applications, logos, downloads) is editable here. */}
            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-text">{product.name}</h1>
                  <p className="mt-1 text-sm text-muted">SKU: {product.sku || "—"}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-lg font-semibold text-text">
                    {formatPrice(product) ?? "—"}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusBadge status={product.status} />
                    <StatusBadge status={product.stock_status} />
                    <span className="inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text">
                      {product.type}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Images — read-only (no upload in this step) */}
            {product.images.length > 0 && (
              <section className="rounded-xl border border-border bg-surface p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-body font-semibold text-text">Images</h2>
                  {managedNote}
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.images.map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      alt={img.alt || product.name}
                      className="h-28 w-28 rounded-lg border border-border object-cover"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Description — read only */}
            {product.description && (
              <section className="rounded-xl border border-border bg-surface p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-body font-semibold text-text">Description</h2>
                  {managedNote}
                </div>
                <RichHtml html={product.description} />
              </section>
            )}

            {/* Options & Variations — strictly read-only */}
            <section className="rounded-xl border border-border bg-surface p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-body font-semibold text-text">Options &amp; Variations</h2>
                {managedNote}
              </div>

              {product.options.length > 0 && (
                <ul className="mb-4 space-y-1 text-sm text-text">
                  {product.options.map((o) => (
                    <li key={o.id}>
                      <span className="font-semibold">{o.name}:</span>{" "}
                      {o.choices.map((c) => c.value).join(", ")}
                    </li>
                  ))}
                </ul>
              )}

              {product.variations.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">#</th>
                        {product.options.map((o) => (
                          <th key={o.id} className="px-3 py-2 font-semibold">
                            {o.name}
                          </th>
                        ))}
                        <th className="px-3 py-2 font-semibold">Price Δ</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {product.variations.map((v, idx) => (
                        <tr key={v.id}>
                          <td className="px-3 py-2 font-medium text-subtle">{idx + 1}</td>
                          {product.options.map((o) => {
                            const vo = v.options.find((x) => x.option_id === o.id);
                            return (
                              <td key={o.id} className="px-3 py-2 font-medium text-text">
                                {vo?.choice_value ?? "—"}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 font-medium text-muted">{v.price_difference}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={v.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Hub custom content — source of truth is the Supabase DB */}
            <HubContent productId={product.id} />
          </div>
        )}
      </div>
    </>
  );
}

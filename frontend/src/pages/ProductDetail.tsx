import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppHeader, StatusBadge } from "../components/AppHeader";
import { RichHtml } from "../components/RichHtml";
import type { ProductDetail as Product } from "../lib/types";

function formatPrice(product: Product): string | null {
  const p = product.prices?.[0];
  return p ? `${p.currency} ${p.price}` : null;
}

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
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to products
        </Link>

        {loading && <p className="mt-6 text-gray-500">Loading product…</p>}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && product && (
          <div className="mt-4 space-y-6">
            {/* Header */}
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
                  <p className="mt-1 text-sm text-gray-500">SKU: {product.sku || "—"}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatPrice(product) ?? "—"}
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <StatusBadge status={product.status} />
                    <StatusBadge status={product.stock_status} />
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {product.type}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Images */}
            {product.images.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-3 text-sm font-medium text-gray-500">Images</h2>
                <div className="flex flex-wrap gap-3">
                  {product.images.map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      alt={img.alt || product.name}
                      className="h-28 w-28 rounded-lg border border-gray-100 object-cover"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Description */}
            {product.description && (
              <section className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-3 text-sm font-medium text-gray-500">Description</h2>
                <RichHtml html={product.description} />
              </section>
            )}

            {/* Options & Variations */}
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-sm font-medium text-gray-500">
                Options &amp; Variations
              </h2>

              {product.options.length > 0 && (
                <ul className="mb-4 space-y-1 text-sm text-gray-700">
                  {product.options.map((o) => (
                    <li key={o.id}>
                      <span className="font-medium">{o.name}:</span>{" "}
                      {o.choices.map((c) => c.value).join(", ")}
                    </li>
                  ))}
                </ul>
              )}

              {product.variations.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">#</th>
                        {product.options.map((o) => (
                          <th key={o.id} className="px-3 py-2 font-medium">
                            {o.name}
                          </th>
                        ))}
                        <th className="px-3 py-2 font-medium">Price Δ</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {product.variations.map((v, idx) => (
                        <tr key={v.id}>
                          <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                          {product.options.map((o) => {
                            const vo = v.options.find((x) => x.option_id === o.id);
                            return (
                              <td key={o.id} className="px-3 py-2 text-gray-700">
                                {vo?.choice_value ?? "—"}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-gray-600">{v.price_difference}</td>
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

            {/* Custom Fields */}
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-sm font-medium text-gray-500">
                Custom Fields ({product.custom_fields.length})
              </h2>
              {product.custom_fields.length === 0 && (
                <p className="text-sm text-gray-400">No custom fields.</p>
              )}
              <div className="space-y-5">
                {product.custom_fields.map((f) => (
                  <div key={f.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {f.label ?? `Unmapped field ${f.id}`}
                      </span>
                      {f.unmapped && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          unmapped
                        </span>
                      )}
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {f.kind}
                      </span>
                    </div>
                    {f.kind === "image" && f.image ? (
                      <img
                        src={f.image.url}
                        alt={f.image.alt || f.label || "custom field image"}
                        className="max-h-40 rounded border border-gray-100 object-contain"
                      />
                    ) : (
                      <RichHtml html={f.value} />
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

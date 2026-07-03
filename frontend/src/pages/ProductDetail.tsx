import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { StatusBadge } from "../components/ui";
import { RichHtml } from "../components/RichHtml";
import { ProductEditForm } from "../components/ProductEditForm";
import { HubContent } from "../components/HubContent";
import type { ProductDetail as Product } from "../lib/types";

function formatPrice(product: Product): string | null {
  const p = product.prices?.[0];
  return p ? `${p.currency} ${p.price}` : null;
}

const managedNote = (
  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
    Read-only · managed separately (coming soon)
  </span>
);

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSaved(updated: Product) {
    setProduct(updated);
    setEditing(false);
    setToast("Saved — product refreshed");
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-4xl">
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
            {/* Editable native fields */}
            {editing ? (
              <ProductEditForm
                product={product}
                onSaved={handleSaved}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <section className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
                    <p className="mt-1 text-sm text-gray-500">SKU: {product.sku || "—"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => setEditing(true)}
                      className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
                    >
                      Edit
                    </button>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatPrice(product) ?? "—"}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <StatusBadge status={product.status} />
                      <StatusBadge status={product.stock_status} />
                      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {product.type}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Images — read-only (no upload in this step) */}
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

            {/* Description — read-only view (editable in the form above) */}
            {!editing && product.description && (
              <section className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-3 text-sm font-medium text-gray-500">Description</h2>
                <RichHtml html={product.description} />
              </section>
            )}

            {/* Options & Variations — strictly read-only */}
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-medium text-gray-500">Options &amp; Variations</h2>
                {managedNote}
              </div>

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

            {/* Hub custom content — source of truth is the Supabase DB */}
            <HubContent productId={product.id} />
          </div>
        )}
      </div>
    </>
  );
}

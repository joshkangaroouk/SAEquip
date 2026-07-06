import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { StatusBadge } from "../components/ui";
import type { ProductSummary, StoreInfo } from "../lib/types";

export default function Products() {
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [storeRes, productsRes] = await Promise.all([
          apiFetch("/api/store"),
          apiFetch("/api/products"),
        ]);
        if (!storeRes.ok) throw new Error(`/api/store returned ${storeRes.status}`);
        if (!productsRes.ok) throw new Error(`/api/products returned ${productsRes.status}`);
        const storeData: StoreInfo = await storeRes.json();
        const productsData: ProductSummary[] = await productsRes.json();
        if (cancelled) return;
        setStore(storeData);
        setProducts(productsData);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load products");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const lowHeadroom = store?.remaining != null && store.remaining <= 10;

  return (
    <>
      <h1 className="text-xl font-semibold text-text">Products</h1>

        {/* Headroom banner */}
        {store && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              lowHeadroom
                ? "border border-accent/50 bg-accent/10 text-text"
                : "border-border bg-surface text-muted"
            }`}
          >
            <span className="font-semibold">
              {store.product_count} / {store.max_products ?? "?"} products used
            </span>
            {store.remaining != null && (
              <span className="ml-1">· {store.remaining} remaining</span>
            )}
            {lowHeadroom && <span className="ml-1 font-semibold">— approaching the limit</span>}
          </div>
        )}

        {/* States */}
        {loading && <p className="mt-8 text-muted">Loading products…</p>}
        {error && (
          <div className="mt-8 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {!loading && !error && products && products.length === 0 && (
          <p className="mt-8 text-muted">No products in this store yet.</p>
        )}

        {/* Table */}
        {!loading && !error && products && products.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Variations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/products/${p.id}`)}
                    className="cursor-pointer hover:bg-surface-2"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.thumbnail ? (
                          <img
                            src={p.thumbnail}
                            alt={p.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-surface-2" />
                        )}
                        <div>
                          <div className="font-semibold text-text">{p.name}</div>
                          <div className="text-xs text-subtle">{p.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.sku || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-text">{p.price ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{p.variation_count} variations</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}

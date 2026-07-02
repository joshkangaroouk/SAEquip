import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { AppHeader, StatusBadge } from "../components/AppHeader";
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
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>

        {/* Headroom banner */}
        {store && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              lowHeadroom
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            <span className="font-medium">
              {store.product_count} / {store.max_products ?? "?"} products used
            </span>
            {store.remaining != null && (
              <span className="ml-1">· {store.remaining} remaining</span>
            )}
            {lowHeadroom && <span className="ml-1 font-medium">— approaching the limit</span>}
          </div>
        )}

        {/* States */}
        {loading && <p className="mt-8 text-gray-500">Loading products…</p>}
        {error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && products && products.length === 0 && (
          <p className="mt-8 text-gray-500">No products in this store yet.</p>
        )}

        {/* Table */}
        {!loading && !error && products && products.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Variations</th>
                  <th className="px-4 py-3 font-medium">Custom fields</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/products/${p.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
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
                          <div className="h-10 w-10 rounded bg-gray-100" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-400">{p.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.sku || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.price ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{p.variation_count} variations</td>
                    <td className="px-4 py-3 text-gray-600">{p.custom_field_count} custom fields</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

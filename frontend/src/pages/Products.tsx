import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { Button, StatusBadge } from "../components/ui";
import type { ProductSummary, StoreInfo } from "../lib/types";

export default function Products() {
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  const q = query.trim().toLowerCase();
  const filtered =
    products && q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      : products;

  const storeFull = store?.remaining != null && store.remaining <= 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">Products</h1>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/products/new")}
            disabled={storeFull}
            title={
              storeFull
                ? `The store is at its limit of ${store?.max_products} products.`
                : "Create a new product"
            }
          >
            + New product
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <div className="relative w-full max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-8 text-sm font-medium text-text placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              title="Clear search"
              className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-subtle transition-colors hover:bg-surface-2 hover:text-text"
            >
              ×
            </button>
          )}
        </div>
      </div>

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
        {!loading && !error && products && products.length > 0 && filtered && filtered.length === 0 && (
          <p className="mt-8 text-muted">
            No products match "{query}".{" "}
            <button type="button" onClick={() => setQuery("")} className="text-text underline underline-offset-2 hover:text-muted">
              Clear search
            </button>
          </p>
        )}

        {/* Table */}
        {!loading && !error && filtered && filtered.length > 0 && (
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
                {filtered.map((p) => (
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
                    <td className="px-4 py-3 font-medium text-muted">{p.sku || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 font-medium text-text">{p.price ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-muted">{p.variation_count} variations</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}

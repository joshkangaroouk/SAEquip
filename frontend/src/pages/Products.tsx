import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  Button,
  Highlight,
  Input,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../components/ui";
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
      ? products.filter(
          // sku is null for products that don't have one, and name is only
          // guaranteed by Duda's create API — neither is safe to call a method
          // on directly.
          (p) =>
            (p.name ?? "").toLowerCase().includes(q) ||
            (p.sku ?? "").toLowerCase().includes(q),
        )
      : products;

  const storeFull = store?.remaining != null && store.remaining <= 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-semibold text-text">Products</h1>

        <div className="flex flex-wrap items-center gap-2">
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
          <Input
            size="sm"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU…"
            className="pl-9 pr-8"
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
            className={`mt-4 rounded-lg border px-3 py-2 text-body ${
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
        {loading && <p className="mt-6 text-muted">Loading products…</p>}
        {error && (
          <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">
            {error}
          </div>
        )}
        {!loading && !error && products && products.length === 0 && (
          <p className="mt-6 text-muted">No products in this store yet.</p>
        )}
        {!loading && !error && products && products.length > 0 && filtered && filtered.length === 0 && (
          <p className="mt-6 text-muted">
            No products match "{query}".{" "}
            <button type="button" onClick={() => setQuery("")} className="text-text underline underline-offset-2 hover:text-muted">
              Clear search
            </button>
          </p>
        )}

        {/* Table */}
        {!loading && !error && filtered && filtered.length > 0 && (
          <div className="mt-4">
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>SKU</TH>
                  <TH>Status</TH>
                  <TH>Price</TH>
                  <TH>Variations</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => (
                  <TR key={p.id} hover onClick={() => navigate(`/products/${p.id}`)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        {p.thumbnail ? (
                          <img
                            src={p.thumbnail}
                            alt={p.name}
                            className="h-[100px] w-[100px] shrink-0 rounded border border-border object-cover"
                          />
                        ) : (
                          <div className="h-[100px] w-[100px] shrink-0 rounded border border-border bg-surface-2" />
                        )}
                        <div>
                          <div className="font-medium text-text">
                            <Highlight text={p.name} query={query} />
                          </div>
                          <div className="text-small text-subtle">{p.type}</div>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-muted">
                      {p.sku ? <Highlight text={p.sku} query={query} /> : "—"}
                    </TD>
                    <TD>
                      <StatusBadge status={p.status} />
                    </TD>
                    <TD className="text-text">{p.price ?? "—"}</TD>
                    <TD className="text-muted">{p.variation_count}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
    </>
  );
}

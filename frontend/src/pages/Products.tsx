import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  Button,
  Highlight,
  Input,
  SelectMenu,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../components/ui";
import type { ProductSummary, StoreInfo } from "../lib/types";

interface CategoryNode {
  id: string;
  title: string;
  depth: number;
  /** Duda's sentinel for a top-level row is the string "ROOT", not null. */
  parent_id: string;
}

type SortKey = "recent" | "oldest" | "name" | "name-desc";

/** One category pill on a row. `stale` marks an id Duda no longer knows. */
interface Chip {
  key: string;
  label: string;
  stale?: boolean;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

export default function Products() {
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [cats, setCats] = useState<CategoryNode[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [storeRes, productsRes, catsRes] = await Promise.all([
          apiFetch("/api/store"),
          apiFetch("/api/products"),
          apiFetch("/api/categories"),
        ]);
        if (!storeRes.ok) throw new Error(`/api/store returned ${storeRes.status}`);
        if (!productsRes.ok) throw new Error(`/api/products returned ${productsRes.status}`);
        const storeData: StoreInfo = await storeRes.json();
        const productsData: ProductSummary[] = await productsRes.json();
        if (cancelled) return;
        setStore(storeData);
        setProducts(productsData);
        // ⚠️ Categories are a SOFT dependency: the products table must still
        // render if this one fails, so it is checked separately rather than
        // thrown with the other two. The Categories column just goes quiet.
        if (catsRes.ok) setCats((await catsRes.json()).categories ?? []);
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

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  /**
   * Which categories to show on a row.
   *
   * ⚠️ A category that is the PARENT of another selected one is dropped —
   * every product carries "Products" as well as its type, and printing both
   * says nothing the child does not. A top-level category selected on its own
   * still shows, so nothing is ever hidden entirely.
   */
  const chipsFor = (p: ProductSummary): Chip[] => {
    // ⚠️ Without the categories list every id looks unknown, which would put a
    // false "no longer in Duda" on every row. The column goes quiet instead.
    if (!cats.length) return [];

    const parents = new Set(
      p.category_ids.map((id) => catById.get(id)?.parent_id).filter((x): x is string => !!x),
    );
    const chips: Chip[] = p.category_ids
      .filter((id) => catById.has(id) && !parents.has(id))
      .map((id) => ({ key: id, label: catById.get(id)!.title }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // `ProductCategory.dudaCategoryId` has no foreign key — categories live in
    // Duda — so a category deleted there leaves rows pointing at nothing. One
    // chip rather than N identical ones.
    const stale = p.category_ids.filter((id) => !catById.has(id)).length;
    if (stale) chips.push({ key: "__stale", label: `${stale} no longer in Duda`, stale: true });
    return chips;
  };

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!products) return products;
    let out = products;
    if (q) {
      // sku is null for products that don't have one, and name is only
      // guaranteed by Duda's create API — neither is safe to call a method
      // on directly.
      out = out.filter(
        (p) => (p.name ?? "").toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q),
      );
    }
    if (categoryId) {
      // A PARENT matches everything beneath it, so picking "Site Challenges"
      // is not an empty result just because products sit on the leaves.
      const wanted = new Set([categoryId, ...cats.filter((c) => c.parent_id === categoryId).map((c) => c.id)]);
      out = out.filter((p) => p.category_ids.some((id) => wanted.has(id)));
    }
    const byName = (a: ProductSummary, b: ProductSummary) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
    // created_at is null for a product with no Hub row; sort those last rather
    // than letting an empty string win the comparison.
    const byDate = (a: ProductSummary, b: ProductSummary) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "");
    const sorted = [...out];
    if (sort === "name") sorted.sort(byName);
    else if (sort === "name-desc") sorted.sort((a, b) => byName(b, a));
    else if (sort === "oldest") sorted.sort((a, b) => byDate(b, a));
    else sorted.sort(byDate);
    return sorted;
  }, [products, q, categoryId, sort, cats]);

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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/*
          * Out of its box deliberately: a count that is fine 99% of the time is
          * context, not an alert, and a bordered panel gives it the weight of
          * one. It only takes emphasis when the headroom is genuinely low.
          */}
        {store ? (
          <p className={`text-body ${lowHeadroom ? "font-semibold text-text" : "text-muted"}`}>
            {store.product_count} / {store.max_products ?? "?"} products used
            {store.remaining != null && <span className="ml-1">· {store.remaining} remaining</span>}
            {lowHeadroom && <span className="ml-1 text-danger">— approaching the limit</span>}
          </p>
        ) : (
          // Same height and roughly the same width as the real line, so the
          // controls beside it do not shift when the store call lands.
          <Skeleton className="h-6 w-56" />
        )}

        {/*
          * ⚠️ Fixed widths only from `sm` up. Below that the three controls
          * total ~530px and simply ran off the side of a phone. Here the
          * search takes the full row and the two menus split the next one, so
          * nothing overflows and nothing is squeezed to unusable.
          */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <div className="relative w-full min-w-0 sm:w-52">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <Input
            size="xs"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or SKU…"
            className="pl-8 pr-7"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              title="Clear search"
              className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-base leading-none text-subtle transition-colors hover:bg-surface-2 hover:text-text"
            >
              ×
            </button>
          )}
        </div>

        {/* ⚠️ A PARENT here matches everything beneath it — see the filter —
            so picking "Site Challenges" is not an empty result just because
            products sit on the leaves. `depth` indents rather than padding the
            label, so the tree survives the text being truncated. */}
        <SelectMenu
          className="min-w-0 flex-1 sm:w-44 sm:flex-none"
          ariaLabel="Filter by category"
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: "", label: "All categories" },
            ...cats.map((c) => ({ value: c.id, label: c.title, depth: c.depth })),
          ]}
        />

        <SelectMenu
          className="min-w-0 flex-1 sm:w-36 sm:flex-none"
          ariaLabel="Sort products"
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={SORTS.map((o) => ({ value: o.value, label: o.label }))}
        />
        </div>
      </div>

        {/* States */}
        {/*
          * ⚠️ The real table, with the real header and real row heights, so
          * the only thing that changes on load is the cell contents. A
          * "Loading…" line reflows the whole page the moment data arrives —
          * which is the jump this exists to remove, not just a nicety.
          */}
        {loading && (
          <div className="mt-4" aria-busy="true" aria-live="polite" aria-label="Loading products">
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>SKU</TH>
                  <TH>Status</TH>
                  <TH>Categories</TH>
                </TR>
              </THead>
              <TBody>
                {Array.from({ length: 8 }, (_, i) => (
                  <TR key={i}>
                    <TD>
                      <div className="flex items-center gap-3">
                        {/* 100px matches the real thumbnail exactly. */}
                        <Skeleton className="h-[100px] w-[100px] shrink-0" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Skeleton className="h-4 w-24" />
                    </TD>
                    <TD>
                      <Skeleton className="h-5 w-16" />
                    </TD>
                    <TD>
                      <Skeleton className="h-5 w-40" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
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
            No products match {query ? `"${query}"` : "that category"}.{" "}
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategoryId("");
              }}
              className="text-text underline underline-offset-2 hover:text-muted"
            >
              Clear filters
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
                  <TH>Categories</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => {
                  const chips = chipsFor(p);
                  return (
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
                    <TD>
                      {chips.length === 0 ? (
                        <span className="text-subtle">—</span>
                      ) : (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {chips.map((c) => (
                            <span
                              key={c.key}
                              className={`rounded-md border px-1.5 py-0.5 text-xs ${
                                c.stale
                                  ? "border-danger/30 bg-danger/10 text-danger"
                                  : "border-border bg-surface-2 text-muted"
                              }`}
                            >
                              {c.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </TD>
                  </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
    </>
  );
}

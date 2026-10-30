import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Pencil, Plus, Search, X } from "lucide-react";
import { apiFetch } from "../lib/api";
import { fetchProductIndex } from "../lib/productIndex";
import { productPageUrl } from "../lib/site";
import {
  PageHeader,
  Thumb,
  Alert,
  Badge,
  Button,
  EmptyState,
  Highlight,
  Input,
  Pagination,
  SegmentedControl,
  SelectMenu,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
  usePagedList,
} from "../components/ui";
import type { ProductSummary, StoreInfo } from "../lib/types";
import { cn } from "../lib/cn";

interface CategoryNode {
  id: string;
  title: string;
  depth: number;
  /** Duda's sentinel for a top-level row is the string "ROOT", not null. */
  parent_id: string;
}

type SortKey = "recent" | "oldest" | "name" | "name-desc";
type StatusTab = "all" | "live" | "hidden";

/** One category on a row. `stale` marks an id Duda no longer knows. */
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

/**
 * Live is exactly ACTIVE, so an unexpected status never counts as live;
 * Hidden is everything else, so Live + Hidden = All.
 */
const isLive = (p: ProductSummary) => p.status === "ACTIVE";

/** The row's icon actions: the ghost icon button (02a Q4), as a link. Display set per use. */
const iconAction =
  "h-8.5 w-8.5 shrink-0 items-center justify-center border border-transparent text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text";

export default function Products() {
  const navigate = useNavigate();
  const searchId = useId();
  const tableTop = useRef<HTMLDivElement>(null);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [cats, setCats] = useState<CategoryNode[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [status, setStatus] = useState<StatusTab>("all");
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // The product list comes through the shell's shared fetch: the same
        // GET /api/products, fresh, but reusing the request the sidebar and
        // search may already have in flight (lib/productIndex.ts).
        const [storeRes, productsData, catsRes] = await Promise.all([
          apiFetch("/api/store"),
          fetchProductIndex(),
          apiFetch("/api/categories"),
        ]);
        if (!storeRes.ok) throw new Error(`/api/store returned ${storeRes.status}`);
        const storeData: StoreInfo = await storeRes.json();
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

  // Near the limit is a warning, not a fault (02 §6, 02a Q25).
  const lowHeadroom = store?.remaining != null && store.remaining <= 10;

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  /**
   * Which categories a row COUNTS. The column shows only "X categories" (Josh,
   * 2026-10-13), with the names on hover and for screen readers.
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

  /** Search and category: what the status tabs count. */
  const matched = useMemo(() => {
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
    return out;
  }, [products, q, categoryId, cats]);

  /** Then the status tab and the sort: every row the table shows, across pages. */
  const filtered = useMemo(() => {
    if (!matched) return matched;
    const out = status === "all" ? matched : matched.filter((p) => isLive(p) === (status === "live"));
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
  }, [matched, status, sort]);

  // Client-side, back to page 1 whenever what is shown or its order changes.
  const paged = usePagedList(filtered ?? [], { resetKeys: [status, q, categoryId, sort] });

  const liveCount = matched?.filter(isLive).length ?? 0;
  const counts = matched ? { all: matched.length, live: liveCount, hidden: matched.length - liveCount } : null;

  const storeFull = store?.remaining != null && store.remaining <= 0;

  /** A new page starts at the table's top, not wherever the pager was. */
  function goToPage(page: number) {
    paged.setPage(page);
    const top = tableTop.current;
    if (top && top.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      top.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  }

  /**
   * Download what the table is showing, as CSV.
   *
   * ⚠️ Sends the ids of the FILTERED, SORTED rows rather than asking the
   * server to filter: search, the category filter (with its parent-matches-
   * its-subtree rule), the status tab and the sort live here, and a second
   * copy of them on the server would be a second set of rules waiting to
   * disagree with this one. The server fills the rows in; this decides which
   * rows and in what order. Every page, never just the one on screen.
   *
   * fetch + blob rather than a link, because the request must carry the
   * bearer token and a plain <a href> cannot.
   */
  async function exportCsv() {
    if (!filtered?.length || exporting) return;
    setExporting(true);
    try {
      const res = await apiFetch("/api/products/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: filtered.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "saequip-products.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on the next tick, not immediately: some browsers start the
      // download asynchronously and an instant revoke cancels it.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      const rows = Number(res.headers.get("X-Export-Rows") ?? filtered.length);
      toast.success(`Exported ${rows} product${rows === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const filteredBy = query.trim() || categoryId || status !== "all";

  function clearFilters() {
    setQuery("");
    setCategoryId("");
    setStatus("all");
  }

  /*
   * Narrow screens fold columns under the product's name rather than scroll
   * the table sideways: the SKU below `xl` (at 1024 the five columns left the
   * name about 60px), and Status and Categories too below `sm`, where there is
   * room for the product and its actions only.
   */
  const wide = "hidden sm:table-cell";
  const head = (
    <THead>
      <TR>
        {/* `w-px`: the other columns shrink to their content and Product takes the rest. */}
        <TH>Product</TH>
        <TH className="hidden w-px xl:table-cell">SKU</TH>
        <TH className={cn("w-px", wide)}>Status</TH>
        <TH className={cn("w-px", wide)}>Categories</TH>
        <TH className="w-px">
          <span className="sr-only">Actions</span>
        </TH>
      </TR>
    </THead>
  );

  return (
    <>
      <PageHeader
        title="Products"
        description={
          store ? (
            // The store headroom (02a "After stage 5"), in the warning tone
            // when 10 or fewer remain.
            <span className={lowHeadroom ? "font-medium text-warning" : undefined}>
              <span className="font-mono">
                {store.product_count} / {store.max_products ?? "?"}
              </span>{" "}
              products used
              {store.remaining != null && <> · {store.remaining} remaining</>}
              {lowHeadroom && <> — approaching the limit</>}
            </span>
          ) : (
            // The same line's height, so the band does not grow when the
            // store call lands. A span: this sits inside the band's <p>.
            <span aria-hidden="true" className="inline-block h-4 w-56 animate-pulse bg-surface-2 align-middle motion-reduce:animate-none" />
          )
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void exportCsv()}
              disabled={!filtered?.length || exporting}
              title={
                filteredBy
                  ? `Exports the ${filtered?.length ?? 0} products matching the current search and filters`
                  : "Exports every product"
              }
            >
              {exporting ? "Exporting…" : filteredBy ? `Export CSV (${filtered?.length ?? 0})` : "Export CSV"}
            </Button>
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
              <Plus size={16} aria-hidden="true" />
              New product
            </Button>
          </>
        }
      />

      {/*
        * The toolbar. ⚠️ Fixed widths only from `sm` up: below that the search
        * takes a full row and the two menus split the next, so nothing runs
        * off a phone and nothing is squeezed to unusable.
        */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<StatusTab>
          ariaLabel="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: counts?.all },
            { value: "live", label: "Live", count: counts?.live },
            { value: "hidden", label: "Hidden", count: counts?.hidden },
          ]}
        />

        <div className="relative w-full min-w-0 sm:w-64">
          <label htmlFor={searchId} className="sr-only">
            Search products by name or SKU
          </label>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            id={searchId}
            size="sm"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or SKU…"
            // Our own clear button below, so not the browser's as well.
            className="pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              title="Clear search"
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text"
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* ⚠️ A PARENT here matches everything beneath it — see the filter —
            so picking "Site Challenges" is not an empty result just because
            products sit on the leaves. `depth` indents rather than padding the
            label, so the tree survives the text being truncated. */}
        <SelectMenu
          className="min-w-0 flex-1 sm:w-48 sm:flex-none"
          ariaLabel="Filter by category"
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: "", label: "All categories" },
            ...cats.map((c) => ({ value: c.id, label: c.title, depth: c.depth })),
          ]}
        />

        <SelectMenu
          className="min-w-0 flex-1 sm:ml-auto sm:w-40 sm:flex-none"
          ariaLabel="Sort products"
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={SORTS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>

      {/*
        * ⚠️ The real table, with the real header and real row heights (a 56px
        * thumbnail), and as many rows as the default page, so the only thing
        * that changes on load is the cell contents.
        */}
      {loading && (
        <div aria-busy="true" aria-live="polite" aria-label="Loading products">
          <Table>
            {head}
            <TBody>
              {Array.from({ length: 20 }, (_, i) => (
                <TR key={i}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-14 w-14 shrink-0" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                  </TD>
                  <TD className="hidden xl:table-cell">
                    <Skeleton className="h-4 w-20" />
                  </TD>
                  <TD className={wide}>
                    <Skeleton className="h-6.5 w-16" />
                  </TD>
                  <TD className={wide}>
                    <Skeleton className="h-4 w-24" />
                  </TD>
                  <TD>
                    <Skeleton className="h-8.5 w-8.5 sm:w-[4.5rem]" />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {!loading && !error && products && products.length === 0 && (
        <EmptyState
          title="No products in this store yet"
          description="Create the first one with New product."
        />
      )}
      {!loading && !error && products && products.length > 0 && filtered && filtered.length === 0 && (
        <EmptyState
          title="No products match"
          description={
            query.trim()
              ? `Nothing matches "${query.trim()}" with these filters.`
              : "Nothing matches this status and category."
          }
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}

      {!loading && !error && filtered && filtered.length > 0 && (
        <>
          <div ref={tableTop} className="scroll-mt-20">
            <Table>
              {head}
              <TBody>
                {paged.pageItems.map((p) => {
                  const chips = chipsFor(p);
                  const named = chips.filter((c) => !c.stale);
                  const stale = chips.find((c) => c.stale);
                  const names = named.map((c) => c.label).join(", ");
                  const liveUrl = productPageUrl(p);
                  return (
                    <TR key={p.id} hover onClick={() => navigate(`/products/${p.id}`)}>
                      <TD>
                        <div className="flex items-center gap-3">
                          {/* Decorative: the name beside it is the link. */}
                          <Thumb src={p.thumbnail} size={56} fallback="box" />
                          <div className="min-w-0">
                            <Link to={`/products/${p.id}`} className="font-medium text-text">
                              <Highlight text={p.name} query={query} />
                            </Link>
                            {/* Wraps at its hyphens, so the column can narrow at 1024. */}
                            {p.slug && <div className="t-code-sm text-muted">{p.slug}</div>}
                            {/* The folded columns (see `wide`). */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 xl:hidden">
                              <span className="mt-1.5 sm:hidden">
                                <StatusBadge status={p.status} />
                              </span>
                              {p.sku && (
                                <span className="mt-1.5 whitespace-nowrap">
                                  <span className="text-label text-muted">SKU </span>
                                  <span className="t-code-sm text-text">
                                    <Highlight text={p.sku} query={query} />
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD className="t-code hidden whitespace-nowrap text-text xl:table-cell">
                        {p.sku ? (
                          <Highlight text={p.sku} query={query} />
                        ) : (
                          <>
                            <span aria-hidden="true" className="text-muted">
                              —
                            </span>
                            <span className="sr-only">No SKU</span>
                          </>
                        )}
                      </TD>
                      <TD className={wide}>
                        <StatusBadge status={p.status} />
                      </TD>
                      <TD className={wide}>
                        {chips.length === 0 ? (
                          <>
                            <span aria-hidden="true" className="text-muted">
                              —
                            </span>
                            <span className="sr-only">None</span>
                          </>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            {named.length > 0 && (
                              // The names on hover (title) and, since a title
                              // is not reliably read out, for screen readers.
                              <span className="whitespace-nowrap text-muted" title={names}>
                                {named.length} {named.length === 1 ? "category" : "categories"}
                                <span className="sr-only">: {names}</span>
                              </span>
                            )}
                            {/* Still shown: it is a fault to fix, not a list (KEEP-F). */}
                            {stale && <Badge tone="danger">{stale.label}</Badge>}
                          </div>
                        )}
                      </TD>
                      <TD className="w-px whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Not below `sm`, where the name beside it is the same link. */}
                          <Link
                            to={`/products/${p.id}`}
                            className={cn(iconAction, "hidden sm:inline-flex")}
                            aria-label={`Edit ${p.name}`}
                            title="Edit"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </Link>
                          {liveUrl ? (
                            <a
                              href={liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(iconAction, "inline-flex")}
                              aria-label={`View ${p.name} on the website (opens in a new tab)`}
                              title="View on website"
                            >
                              <ExternalLink size={16} aria-hidden="true" />
                            </a>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon
                              disabled
                              aria-label={`View ${p.name} on the website: ${
                                isLive(p) ? "it has no page address yet" : "hidden products are not on the website"
                              }`}
                              title={isLive(p) ? "No page address yet" : "Hidden products are not on the website"}
                              // Disabled icon controls use --border-input (02a "After 3b").
                              className="border-transparent bg-transparent disabled:border-transparent disabled:bg-transparent disabled:text-border-input"
                            >
                              <ExternalLink size={16} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <Pagination
            className="mt-4"
            page={paged.page}
            total={paged.total}
            pageSize={paged.pageSize}
            onPageChange={goToPage}
            onPageSizeChange={paged.setPageSize}
            label="products"
          />
        </>
      )}
    </>
  );
}

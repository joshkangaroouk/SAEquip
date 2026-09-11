import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/api";
import { Badge, Button, Card, CardHeader, DragHandle, Input, SortableList } from "../ui";
import type { CompatibleDraft } from "./productEditorTypes";
import type { ProductSummary } from "../../lib/types";

/** Points from the catalogue toward this product's list. */
function ArrowRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * A product's thumbnail, or a neutral placeholder.
 *
 * `ProductSummary.thumbnail` is Duda's `images[0]`, so a product with an empty
 * gallery has none — 5 of the 96 imported that way before the fallback image
 * was applied. A missing photo must not collapse the row height or leave a
 * broken-image glyph, hence the fixed box either way.
 */
function Thumb({ url, name }: { url: string | null; name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-2">
      {url ? (
        <img src={url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-[10px] font-semibold text-subtle" aria-hidden="true">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
    </span>
  );
}

/**
 * "Compatible Products & Accessories" — a two-column transfer list, mirroring
 * the WordPress screen it replaces: the catalogue on the left, this product's
 * chosen list on the right, click to move either way.
 *
 * Controlled: the parent owns the list and the unified save bar commits it.
 *
 * ⚠️ Both columns are driven by ONE fetch of the catalogue, searched in the
 * browser. At 96 products that is a single small request and an instant
 * filter; a server-side search would fire per keystroke for no gain. Revisit
 * past a few hundred products, where this should page like the Media picker.
 *
 * The chosen column's rows come from the draft (which carries name/sku but no
 * image, since the API has no reason to send one) and look their thumbnail up
 * in that same catalogue fetch — so a row still renders before the fetch
 * lands, just without its picture.
 */
export function CompatibleProductsSection({
  productId,
  items,
  onChange,
  dirty,
  error,
}: {
  productId: string;
  items: CompatibleDraft[];
  onChange: (next: CompatibleDraft[]) => void;
  dirty: boolean;
  error?: string;
}) {
  const [all, setAll] = useState<ProductSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiJson<ProductSummary[]>("/api/products")
      .then((d) => !cancelled && setAll(d))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load products"));
    return () => {
      cancelled = true;
    };
  }, []);

  const chosenIds = useMemo(() => new Set(items.map((i) => i.dudaProductId)), [items]);
  const byId = useMemo(() => new Map((all ?? []).map((p) => [p.id, p])), [all]);

  const available = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => p.id !== productId) // a product is never compatible with itself
      .filter((p) => !chosenIds.has(p.id))
      .filter(
        (p) =>
          !q ||
          (p.name ?? "").toLowerCase().includes(q) ||
          // `?? ""`, not p.sku! — 3 products genuinely have no SKU, and this
          // exact expression once crashed the products page.
          (p.sku ?? "").toLowerCase().includes(q),
      );
  }, [all, query, chosenIds, productId]);

  const add = (p: ProductSummary) =>
    onChange([...items, { dudaProductId: p.id, name: p.name ?? "", sku: p.sku ?? null, slug: null }]);
  const remove = (id: string) => onChange(items.filter((i) => i.dudaProductId !== id));

  // Matched heights so moving a product between columns never shifts the page.
  const PANE = "h-[22rem] overflow-y-auto rounded-md border border-border bg-surface";

  return (
    <Card id="section-compatible">
      <CardHeader
        title="Compatible Products"
        description="Shown on the product page as a carousel. Click a product on the left to add it; drag the right-hand list to set the order it appears in."
        actions={dirty ? <Badge tone="accent">Unsaved</Badge> : undefined}
      />

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
          {error}
        </div>
      )}
      {loadError && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
          {loadError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- Left: the catalogue ---- */}
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">All products</h3>
            <span className="text-xs text-subtle">
              {all ? `${available.length} available` : "loading…"}
            </span>
          </div>

          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={all ? "Search by name or SKU…" : "Loading products…"}
            disabled={!all}
            aria-label="Search products"
          />

          <div className={`mt-2 ${PANE}`}>
            {!all && !loadError && <p className="px-3 py-3 text-small text-subtle">Loading products…</p>}
            {all && available.length === 0 && (
              <p className="px-3 py-3 text-small text-subtle">
                {query.trim() ? "No products match that search." : "Every other product has been added."}
              </p>
            )}
            {available.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                title={`Add ${p.name}`}
                className="flex w-full items-center gap-3 border-b border-border px-2.5 py-2 text-left last:border-b-0 hover:bg-surface-2"
              >
                <Thumb url={p.thumbnail} name={p.name ?? ""} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">{p.name}</span>
                <span className="shrink-0 text-xs text-subtle">{p.sku ?? "—"}</span>
                {/* A word plus a direction beats a "+": it says what the
                    click does AND which way the product moves, which is the
                    one thing a two-column transfer list has to make obvious.
                    aria-hidden because the button's own title already reads
                    "Add <product>" — otherwise a screen reader hears "Add"
                    twice. */}
                <span
                  className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-strong"
                  aria-hidden="true"
                >
                  Add
                  <ArrowRight />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Right: this product's list ---- */}
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Added to this product
            </h3>
            <span className="text-xs text-subtle">
              {items.length} selected{items.length >= 40 ? " (max)" : ""}
            </span>
          </div>

          {/* Spacer matching the left column's search input, so the two panes
              line up rather than the right one floating 40px higher. */}
          <div className="h-[38px]" aria-hidden="true" />

          <div className={`mt-2 ${PANE}`}>
            {items.length === 0 ? (
              <p className="px-3 py-3 text-small text-subtle">
                Nothing added yet. Pick the products and accessories that go with this one.
              </p>
            ) : (
              <SortableList
                as="div"
                className="divide-y divide-border"
                items={items}
                getId={(i) => i.dudaProductId}
                onReorder={onChange}
                renderItem={(item, handle, index) => (
                  <div className="flex items-center gap-2 bg-surface px-2.5 py-2">
                    <DragHandle handle={handle} />
                    <span className="w-5 shrink-0 text-right text-xs text-subtle">{index + 1}.</span>
                    <Thumb url={byId.get(item.dudaProductId)?.thumbnail ?? null} name={item.name} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-text" title={item.name}>
                      {item.name}
                    </span>
                    <span className="shrink-0 text-xs text-subtle">{item.sku ?? "—"}</span>
                    <button
                      type="button"
                      onClick={() => remove(item.dudaProductId)}
                      title={`Remove ${item.name}`}
                      className="shrink-0 rounded px-1.5 text-xs font-semibold text-muted hover:text-danger"
                    >
                      Remove
                    </button>
                  </div>
                )}
              />
            )}
          </div>

          {items.length > 0 && (
            <div className="mt-2">
              <Button variant="secondary" size="sm" onClick={() => onChange([])}>
                Remove all
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

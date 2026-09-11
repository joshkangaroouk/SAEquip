import { useEffect, useMemo, useRef, useState } from "react";
import { apiJson } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DragHandle,
  Input,
  RemoveButton,
  SortableList,
} from "../ui";
import type { CompatibleDraft } from "./productEditorTypes";
import type { ProductSummary } from "../../lib/types";

/**
 * "Compatible Products & Accessories" — a curated, ordered list of other
 * products shown on this product's page.
 *
 * Controlled: the parent owns the list and the unified save bar commits it.
 *
 * ⚠️ The whole catalogue is fetched ONCE here and searched in the browser. At
 * 96 products that is a single small request against a per-keystroke endpoint,
 * and it makes the picker instant. Revisit if the catalogue grows past a few
 * hundred — at which point this should page server-side like the Media picker.
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
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<ProductSummary[]>("/api/products")
      .then((d) => !cancelled && setAll(d))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load products"));
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the results on an outside click, so the list doesn't sit over the
  // rest of the form.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const chosen = useMemo(() => new Set(items.map((i) => i.dudaProductId)), [items]);

  const results = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => p.id !== productId) // a product is never compatible with itself
      .filter((p) => !chosen.has(p.id))
      .filter(
        (p) =>
          !q ||
          (p.name ?? "").toLowerCase().includes(q) ||
          // `?? ""` rather than p.sku! — 3 products genuinely have no SKU and
          // this line is exactly where that used to crash the page.
          (p.sku ?? "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [all, query, chosen, productId]);

  const add = (p: ProductSummary) => {
    onChange([
      ...items,
      { dudaProductId: p.id, name: p.name ?? "", sku: p.sku ?? null, slug: null },
    ]);
    setQuery("");
    setOpen(false);
  };
  const remove = (id: string) => onChange(items.filter((i) => i.dudaProductId !== id));

  return (
    <Card id="section-compatible">
      <CardHeader
        title="Compatible Products"
        description="Shown on the product page as a carousel of products and accessories. Drag to reorder — the first one appears first."
        actions={
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <span className="text-xs text-subtle">
                {items.length} product{items.length === 1 ? "" : "s"}
              </span>
            )}
            {dirty ? <Badge tone="accent">Unsaved</Badge> : null}
          </div>
        }
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

      {/* Search + results */}
      <div ref={boxRef} className="relative">
        <Input
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={all ? "Search products by name or SKU…" : "Loading products…"}
          disabled={!all}
          aria-label="Search products to add"
        />

        {open && all && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
            {results.length === 0 ? (
              <p className="px-3 py-2.5 text-small text-subtle">
                {query.trim() ? "No products match." : "Every other product is already added."}
              </p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-2"
                >
                  <span className="truncate text-xs font-medium text-text">{p.name}</span>
                  <span className="shrink-0 text-xs text-subtle">{p.sku ?? "—"}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Chosen list */}
      <div className="mt-4">
        {items.length === 0 ? (
          <p className="text-small text-subtle">
            None yet. Search above to add the products and accessories that go with this one.
          </p>
        ) : (
          <SortableList
            as="div"
            className="space-y-2"
            items={items}
            getId={(i) => i.dudaProductId}
            onReorder={onChange}
            renderItem={(item, handle, index) => (
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-2.5">
                <DragHandle handle={handle} />
                <span className="w-5 text-right text-xs text-subtle">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-text" title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 text-xs text-subtle">{item.sku ?? "—"}</span>
                <RemoveButton onClick={() => remove(item.dudaProductId)} title="Remove" />
              </div>
            )}
          />
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => onChange([])}>
            Remove all
          </Button>
        </div>
      )}
    </Card>
  );
}

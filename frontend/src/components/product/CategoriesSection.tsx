import { useEffect, useState } from "react";
import { apiJson } from "../../lib/api";
import { EditorSection } from "./EditorSection";
import { AssignPickList } from "./AssignPickList";

interface CategoryNode {
  id: string;
  title: string;
  depth: number;
  /** Duda's own key. Top-level rows carry the sentinel "ROOT", not null. */
  parent_id: string;
  products_count?: number;
}

/**
 * Assign the product to Duda categories.
 *
 * ⚠️ Stored HUB-SIDE, not written back to Duda. Duda exposes no working
 * product-side assignment — `PATCH /products/{id}` with `categories` returns
 * 200 and changes nothing — and the one path that does work rewrites a whole
 * category's product list, which two editors can silently clobber. The
 * category LIST still comes from Duda, so the names and nesting are always
 * Duda's; only the assignment is ours.
 */
export function CategoriesSection({
  selected,
  onChange,
  error,
  onStaleCount,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string;
  /**
   * How many selected categories Duda no longer has, once the list has
   * loaded — the editor header's "No longer in Duda" chip. From the list this
   * section already loads, so no second fetch.
   */
  onStaleCount?: (n: number) => void;
}) {
  const [cats, setCats] = useState<CategoryNode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ categories: CategoryNode[] }>("/api/categories")
      .then((d) => !cancelled && setCats(d.categories))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Failed to load categories"));
    return () => {
      cancelled = true;
    };
  }, []);

  const stale = cats ? selected.filter((id) => !cats.some((c) => c.id === id)).length : 0;
  useEffect(() => {
    if (cats) onStaleCount?.(stale);
  }, [cats, stale, onStaleCount]);

  return (
    // Not collapsible any more: it sits in the editor's side panel (02a "Batch 8").
    <EditorSection
      id="section-categories"
      title="Categories"
      description="Which Duda categories this product belongs to."
      error={error ?? loadError}
    >
      {!cats && !loadError ? (
        <p className="text-help text-muted">Loading categories…</p>
      ) : (
        <AssignPickList
          // parentId is what lets the list keep a child from being selected
          // without its parent, in both directions.
          items={(cats ?? []).map((c) => ({
            id: c.id,
            label: c.title,
            depth: c.depth,
            parentId: c.parent_id,
          }))}
          selected={selected}
          onChange={onChange}
          searchPlaceholder="Search categories…"
          emptyText="No categories yet — create them on the Categories page."
        />
      )}
    </EditorSection>
  );
}

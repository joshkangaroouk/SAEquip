import { useEffect, useState } from "react";
import { apiJson } from "../../lib/api";
import { AccordionCard } from "../ui";
import { AssignPickList } from "./AssignPickList";

interface CategoryNode {
  id: string;
  title: string;
  depth: number;
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
  dirty,
  error,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  dirty: boolean;
  error?: string;
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

  return (
    <AccordionCard
      id="section-categories"
      title="Categories"
      description="Which Duda categories this product belongs to."
      summary={selected.length ? `${selected.length} selected` : undefined}
      dirty={dirty}
      error={error ?? loadError ?? undefined}
      defaultOpen
    >
      {!cats && !loadError ? (
        <p className="text-small text-subtle">Loading categories…</p>
      ) : (
        <AssignPickList
          items={(cats ?? []).map((c) => ({ id: c.id, label: c.title, depth: c.depth }))}
          selected={selected}
          onChange={onChange}
          searchPlaceholder="Search categories…"
          emptyText="No categories yet — create them on the Categories page."
        />
      )}
    </AccordionCard>
  );
}

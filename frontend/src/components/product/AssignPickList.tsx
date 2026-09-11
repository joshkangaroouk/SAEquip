import { useMemo, useState } from "react";
import { Checkbox, Input } from "../ui";

export interface PickItem {
  id: string;
  label: string;
  /** Nesting level — categories use it, tags are always 0. */
  depth?: number;
  /** Small right-aligned note, e.g. how many products use a tag. */
  hint?: string;
}

/**
 * A searchable checkbox list, shared by the Categories and Tags panels so the
 * two cannot drift into looking like different controls for the same job.
 *
 * ⚠️ Selected items are pinned to the top ONLY while the list is unfiltered.
 * A product in 8 of 40 categories otherwise has its selections scattered down
 * a long scroll with no way to review them. During a search the list stays in
 * its natural order, because a search is a request to see things where they
 * belong — pinning mid-search makes the hierarchy jump around as you type.
 */
export function AssignPickList({
  items,
  selected,
  onChange,
  searchPlaceholder,
  emptyText,
  searchThreshold = 8,
}: {
  items: PickItem[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder: string;
  emptyText: string;
  searchThreshold?: number;
}) {
  const [query, setQuery] = useState("");
  const chosen = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const hit = items.filter((i) => chosen.has(i.id));
      const rest = items.filter((i) => !chosen.has(i.id));
      return [...hit, ...rest];
    }
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query, chosen]);

  const toggle = (id: string) =>
    onChange(chosen.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div>
      {items.length >= searchThreshold && (
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="mb-2"
        />
      )}

      {items.length === 0 ? (
        <p className="text-small text-subtle">{emptyText}</p>
      ) : filtered.length === 0 ? (
        <p className="text-small text-subtle">Nothing matches that search.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-md border border-border">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 border-b border-border px-2.5 py-2 last:border-b-0 hover:bg-surface-2"
              // Indent only in the natural order; during a search the parent
              // may be filtered out, so an indent would point at nothing.
              style={{ paddingLeft: query.trim() ? undefined : 10 + (item.depth ?? 0) * 16 }}
            >
              <Checkbox
                checked={chosen.has(item.id)}
                onChange={() => toggle(item.id)}
                label={item.label}
                className="min-w-0 flex-1 text-xs"
              />
              {item.hint && <span className="shrink-0 text-xs text-subtle">{item.hint}</span>}
            </div>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-2 text-body font-semibold text-muted hover:text-text"
        >
          Clear all ({selected.length})
        </button>
      )}
    </div>
  );
}

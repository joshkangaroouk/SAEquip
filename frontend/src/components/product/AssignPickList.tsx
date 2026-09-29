import { useMemo, useState } from "react";
import { Checkbox, Input } from "../ui";

export interface PickItem {
  id: string;
  label: string;
  /** Nesting level — categories use it; grouped items get one automatically. */
  depth?: number;
  /** Small right-aligned note, e.g. how many products use a tag. */
  hint?: string;
  /**
   * Heading this item sits under. When ANY item has one the list renders
   * headings; categories pass none and render exactly as before.
   */
  group?: string;
}

/** A heading row, or a selectable item. Headings are never selectable. */
type Row = { kind: "heading"; label: string } | { kind: "item"; item: PickItem };

/**
 * A searchable checkbox list, shared by the Categories and Tags panels so the
 * two cannot drift into looking like different controls for the same job.
 *
 * ⚠️ Selected items are pinned to the top — but WITHIN their group, not to the
 * top of the whole list. Pinning globally is what this did before groups
 * existed, and it directly fights grouping: a ticked Site Problems tag would
 * jump above the Industries heading and sit under the wrong one. Per-group
 * pinning keeps the reason the behaviour exists (a product in 8 of 40
 * categories can review its selections without a long scroll) without letting
 * an item appear somewhere it does not belong.
 *
 * Pinning applies only while unfiltered. During a search the list stays in its
 * natural order, because a search is a request to see things where they
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
  const grouped = useMemo(() => items.some((i) => i.group), [items]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;

    if (!grouped) {
      const ordered = q
        ? matching
        : [...matching.filter((i) => chosen.has(i.id)), ...matching.filter((i) => !chosen.has(i.id))];
      return ordered.map((item) => ({ kind: "item", item }) as Row);
    }

    // Buckets in first-seen order, which is the order the server sent — it
    // already sorts groups then items, so no second ordering rule is needed.
    const buckets = new Map<string, PickItem[]>();
    for (const i of matching) {
      const key = i.group ?? "";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(i);
    }

    const out: Row[] = [];
    for (const [heading, bucket] of buckets) {
      // A heading whose every item was filtered out would point at nothing.
      if (!bucket.length) continue;
      if (heading) out.push({ kind: "heading", label: heading });
      const ordered = q
        ? bucket
        : [...bucket.filter((i) => chosen.has(i.id)), ...bucket.filter((i) => !chosen.has(i.id))];
      for (const item of ordered) out.push({ kind: "item", item });
    }
    return out;
  }, [items, query, chosen, grouped]);

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
      ) : rows.length === 0 ? (
        <p className="text-small text-subtle">Nothing matches that search.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-md border border-border">
          {rows.map((row) =>
            row.kind === "heading" ? (
              // Sticky so you can still see which group you are in after
              // scrolling past its heading — the list is capped at 80 and a
              // long group otherwise loses its label off the top.
              <div
                key={`h:${row.label}`}
                className="sticky top-0 z-10 border-b border-border bg-surface-2 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-subtle"
              >
                {row.label}
              </div>
            ) : (
              <div
                key={row.item.id}
                className="flex items-center gap-2 border-b border-border px-2.5 py-2 last:border-b-0 hover:bg-surface-2"
                // Indent only in the natural order; during a search the parent
                // may be filtered out, so an indent would point at nothing.
                // Grouped items indent one level so they read as belonging to
                // the heading above them.
                style={{
                  paddingLeft: query.trim()
                    ? undefined
                    : 10 + (row.item.depth ?? (row.item.group ? 1 : 0)) * 16,
                }}
              >
                <Checkbox
                  checked={chosen.has(row.item.id)}
                  onChange={() => toggle(row.item.id)}
                  label={row.item.label}
                  className="min-w-0 flex-1 text-xs"
                />
                {row.item.hint && (
                  <span className="shrink-0 text-xs text-subtle">{row.item.hint}</span>
                )}
              </div>
            ),
          )}
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

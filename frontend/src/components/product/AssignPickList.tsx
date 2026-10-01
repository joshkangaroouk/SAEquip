import { useId, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import { Checkbox, Input, Toggle } from "../ui";

export interface PickItem {
  id: string;
  label: string;
  /** Nesting level — categories use it; grouped items get one automatically. */
  depth?: number;
  /**
   * The item this one sits under. When present the list keeps the tree
   * consistent on every toggle — see `toggle` below. Duda's top-level rows
   * carry the sentinel `"ROOT"`, which matches no item and so ends the walk.
   */
  parentId?: string;
  /** Small right-aligned note, e.g. how many products use a tag. */
  hint?: string;
  /**
   * Heading this item sits under. When ANY item has one the list renders
   * headings; categories pass none and render exactly as before.
   */
  group?: string;
  /**
   * Thumbnail. Opt-in per caller: the categories picker has no images, and a
   * column of empty placeholders is worse than no column.
   */
  imageUrl?: string | null;
}

/** A heading row, or a selectable item. Headings are never selectable. */
type Row = { kind: "heading"; label: string } | { kind: "item"; item: PickItem };

/**
 * A searchable checkbox list, shared by the Categories and Tags panels so the
 * two cannot drift into looking like different controls for the same job.
 *
 * ⚠️ The order NEVER changes as you tick things. Selected items used to be
 * pinned to the top, which is fine for a flat list and wrong for a tree: a
 * ticked child jumped above its own parent, so the indentation pointed at
 * nothing and the thing you just clicked moved out from under the cursor.
 * Position is how you find a category again, so it has to be stable.
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
  const onlyId = useId();
  const [query, setQuery] = useState("");
  /**
   * ⚠️ Not persisted and not reset by `selected` changing. Unticking the last
   * item while this is on leaves an empty list and the toggle still on, which
   * is honest — turning it off is one click, whereas flipping it for you would
   * be the control changing itself under the cursor.
   */
  const [onlySelected, setOnlySelected] = useState(false);
  const chosen = useMemo(() => new Set(selected), [selected]);
  const grouped = useMemo(() => items.some((i) => i.group), [items]);
  const withImages = useMemo(() => items.some((i) => i.imageUrl !== undefined), [items]);
  // Same threshold as the search: a list short enough to read whole needs
  // neither control.
  const showTools = items.length >= searchThreshold;

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    let matching = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    if (onlySelected) matching = matching.filter((i) => chosen.has(i.id));

    if (!grouped) return matching.map((item) => ({ kind: "item", item }) as Row);

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
      for (const item of bucket) out.push({ kind: "item", item });
    }
    return out;
  }, [items, query, chosen, grouped, onlySelected]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const i of items) {
      if (!i.parentId) continue;
      const bucket = m.get(i.parentId);
      if (bucket) bucket.push(i.id);
      else m.set(i.parentId, [i.id]);
    }
    return m;
  }, [items]);

  /**
   * ⚠️ A child can never be selected without its parent, in either direction:
   * ticking one ticks its ancestors, and unticking a parent unticks everything
   * beneath it. Half the rule would leave exactly the state it exists to
   * prevent — tick a child, untick its parent, and the child is orphaned.
   *
   * Items with no `parentId` are unaffected, so a flat list behaves as before.
   */
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop()!;
        next.delete(cur);
        for (const child of childrenOf.get(cur) ?? []) stack.push(child);
      }
    } else {
      next.add(id);
      let p = byId.get(id)?.parentId;
      // `byId.has` also terminates on "ROOT" and on a parent deleted upstream.
      while (p && byId.has(p) && !next.has(p)) {
        next.add(p);
        p = byId.get(p)!.parentId;
      }
    }
    // ⚠️ Anything selected that is NOT in `items` is carried through untouched
    // — a category deleted in Duda still has a row here, and silently dropping
    // it would be an edit the user never made.
    const unknown = selected.filter((s) => next.has(s) && !byId.has(s));
    onChange([...items.filter((i) => next.has(i.id)).map((i) => i.id), ...unknown]);
  };

  return (
    <div>
      {showTools && (
        <>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="mb-2"
          />
          <div className="mb-2 flex items-center justify-between gap-3">
            <Toggle
              id={onlyId}
              checked={onlySelected}
              onChange={setOnlySelected}
              label="Only show selected"
            />
            <span className="text-small text-subtle">{selected.length} selected</span>
          </div>
        </>
      )}

      {items.length === 0 ? (
        <p className="text-small text-subtle">{emptyText}</p>
      ) : rows.length === 0 ? (
        <p className="text-small text-subtle">
          {onlySelected && !selected.length
            ? "Nothing is selected yet."
            : onlySelected
              ? "Nothing selected matches that search."
              : "Nothing matches that search."}
        </p>
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
                  /*
                   * The thumbnail goes INSIDE the label, so the whole row stays
                   * one click target rather than the image becoming dead space
                   * beside the checkbox.
                   */
                  label={
                    withImages ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-2 text-subtle">
                          {row.item.imageUrl ? (
                            <img
                              src={row.item.imageUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <ImageOff size={14} />
                          )}
                        </span>
                        <span className="min-w-0">{row.item.label}</span>
                      </span>
                    ) : (
                      row.item.label
                    )
                  }
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

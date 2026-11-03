import { useId, useMemo, useState } from "react";
import { Thumb, Alert, Button, Checkbox, Input, Toggle } from "../ui";

export interface PickItem {
  id: string;
  label: string;
  /** Nesting level, for the category tree's indent. */
  depth?: number;
  /**
   * The item this one sits under. When present the list keeps the tree
   * consistent on every toggle — see `toggle` below. Duda's top-level rows
   * carry the sentinel `"ROOT"`, which matches no item and so ends the walk.
   */
  parentId?: string;
  /**
   * Thumbnail. Opt-in per caller: the categories picker has no images, and a
   * column of empty placeholders is worse than no column.
   */
  imageUrl?: string | null;
}

/**
 * A searchable checkbox list, shared by the product editor's Categories panel
 * and a category's Products list, so the two cannot drift into looking like
 * different controls for the same job.
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
  const withImages = useMemo(() => items.some((i) => i.imageUrl !== undefined), [items]);
  // Same threshold as the search: a list short enough to read whole needs
  // neither control.
  const showTools = items.length >= searchThreshold;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    return onlySelected ? matching.filter((i) => chosen.has(i.id)) : matching;
  }, [items, query, chosen, onlySelected]);

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

  /*
   * Selected ids with no item: a category deleted IN DUDA. They are carried
   * through untouched (see toggle), but the server refuses an unknown id —
   * so they used to make every save of this list fail with "No such category
   * in Duda", with nothing here to show why or how to fix it (fixed
   * 2026-10-12). Only once the list has loaded, or everything would look
   * missing.
   */
  const missing = items.length ? selected.filter((id) => !byId.has(id)) : [];

  return (
    <div>
      {missing.length > 0 && (
        <Alert
          tone="danger"
          className="mb-2"
          action={
            <Button variant="secondary" size="sm" onClick={() => onChange(selected.filter((id) => byId.has(id)))}>
              Remove
            </Button>
          }
        >
          {missing.length === 1 ? "1 selected item no longer exists" : `${missing.length} selected items no longer exist`}{" "}
          (deleted in Duda), so this list cannot be saved until {missing.length === 1 ? "it is" : "they are"} removed.
        </Alert>
      )}
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
            <span className="text-help text-muted">{selected.length} selected</span>
          </div>
        </>
      )}

      {items.length === 0 ? (
        <p className="text-help text-muted">{emptyText}</p>
      ) : rows.length === 0 ? (
        <p className="text-help text-muted">
          {onlySelected && !selected.length
            ? "Nothing is selected yet."
            : onlySelected
              ? "Nothing selected matches that search."
              : "Nothing matches that search."}
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto border border-border">
          {rows.map((item) => (
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
                /*
                 * The thumbnail goes INSIDE the label, so the whole row stays
                 * one click target rather than the image becoming dead space
                 * beside the checkbox.
                 */
                label={
                  withImages ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <Thumb src={item.imageUrl} size={40} />
                      <span className="min-w-0">{item.label}</span>
                    </span>
                  ) : (
                    item.label
                  )
                }
                className="min-w-0 flex-1 text-label"
              />
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

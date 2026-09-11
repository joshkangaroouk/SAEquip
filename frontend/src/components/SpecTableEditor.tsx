import { Badge, Button, Card, CardHeader, DragHandle, RemoveButton, SortableList } from "./ui";
import type { SpecRowDraft } from "./product/productEditorTypes";
import {
  flattenSpecGroups,
  groupSpecRows,
  type SpecGroupDraft,
} from "./product/normalize";

/**
 * Technical specs. Controlled — the parent owns the rows and the unified save
 * bar commits them, so there is no Save/Reset here.
 *
 * ⚠️ The parent's state is the FLAT row list the API stores, but this renders
 * GROUPS: one label with any number of value lines beneath it. Real spec
 * sheets need that — EX Dehumidifier's PROTECTION has six lines and its
 * CERTIFICATION three — and on the wire each extra line is simply a row with a
 * blank label.
 *
 * Grouping is derived on every render rather than held as local state, so
 * there is one source of truth and no way for this component to drift from the
 * baseline after a save. Every edit below rebuilds the flat list through
 * `flattenSpecGroups`, which round-trips exactly.
 *
 * A group with no lines is a sub-heading inside the table ("SYSTEM INCLUDES"),
 * which the source catalogue uses on 4 rows and which is why a blank value is
 * valid. There is deliberately NO button for it — clearing a spec's last value
 * produces one (the line's remove button says so), which is enough for a shape
 * this rare, and a dedicated button read as clutter next to "+ Add Row".
 * Removing the button did not remove the kind: the imported ones still render
 * and still round-trip through this editor.
 */
export function SpecTableEditor({
  rows,
  onChange,
  dirty,
  error,
}: {
  rows: SpecRowDraft[];
  onChange: (next: SpecRowDraft[]) => void;
  dirty: boolean;
  error?: string;
}) {
  const groups = groupSpecRows(rows);
  const commit = (next: SpecGroupDraft[]) => onChange(flattenSpecGroups(next));

  const mapGroup = (id: string, fn: (g: SpecGroupDraft) => SpecGroupDraft) =>
    commit(groups.map((g) => (g.id === id ? fn(g) : g)));

  const setLabel = (id: string, label: string) => mapGroup(id, (g) => ({ ...g, label }));

  const setLine = (id: string, lineId: string, value: string) =>
    mapGroup(id, (g) => ({
      ...g,
      lines: g.lines.map((ln) => (ln.id === lineId ? { ...ln, value } : ln)),
    }));

  const addLine = (id: string) =>
    mapGroup(id, (g) => ({
      ...g,
      lines: [...g.lines, { id: crypto.randomUUID(), value: "" }],
    }));

  const removeLine = (id: string, lineId: string) =>
    mapGroup(id, (g) => ({ ...g, lines: g.lines.filter((ln) => ln.id !== lineId) }));

  const removeGroup = (id: string) => commit(groups.filter((g) => g.id !== id));

  const addGroup = () =>
    commit([
      ...groups,
      { id: crypto.randomUUID(), label: "", lines: [{ id: crypto.randomUUID(), value: "" }] },
    ]);

  const inputCls =
    "w-full rounded-md border bg-surface px-3 py-2 text-xs font-medium text-text placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent";
  const lineCount = rows.length;

  return (
    <Card id="section-specs">
      <CardHeader
        title="Technical Specs"
        description="Rendered as a table on the product page. One label can carry several lines — use “+ Add line” for specs like PROTECTION that list more than one entry. Drag to reorder."
        actions={
          <div className="flex items-center gap-2">
            {lineCount > 0 && (
              <span className="text-xs text-subtle">
                {groups.length} spec{groups.length === 1 ? "" : "s"} · {lineCount} row
                {lineCount === 1 ? "" : "s"}
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

      {groups.length === 0 ? (
        <p className="text-small text-subtle">No specs. Add one below.</p>
      ) : (
        <SortableList
          as="div"
          className="space-y-2"
          items={groups}
          getId={(g) => g.id}
          onReorder={commit}
          renderItem={(g, handle) => (
            <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-2">
              <div className="pt-2">
                <DragHandle handle={handle} />
              </div>

              {/* Label — one per group, however many lines it has. */}
              <div className="w-2/5 shrink-0">
                <input
                  className={`${inputCls} ${g.label.trim() ? "border-border" : "border-danger"}`}
                  value={g.label}
                  onChange={(e) => setLabel(g.id, e.target.value)}
                  placeholder="e.g. PROTECTION"
                />
                {g.lines.length === 0 && (
                  <p className="mt-1 text-xs text-subtle">
                    Sub-heading — no value beside it.
                  </p>
                )}
              </div>

              {/* Value lines — stacked, mirroring how they render on the page. */}
              <div className="min-w-0 flex-1 space-y-1.5">
                {g.lines.map((ln, i) => (
                  <div key={ln.id} className="flex items-center gap-1.5">
                    <input
                      className={`${inputCls} ${ln.value.trim() ? "border-border" : "border-danger"}`}
                      value={ln.value}
                      onChange={(e) => setLine(g.id, ln.id, e.target.value)}
                      placeholder={i === 0 ? "e.g. Tipping protection" : "another line…"}
                    />
                    {/* Removing the only line turns the spec into a
                        sub-heading rather than deleting it — the group's own
                        remove button is how you delete the spec. */}
                    <RemoveButton
                      onClick={() => removeLine(g.id, ln.id)}
                      title={g.lines.length === 1 ? "Remove value (leaves a sub-heading)" : "Remove line"}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addLine(g.id)}
                  className="rounded px-1 text-body font-semibold text-muted hover:text-text"
                >
                  + Add line
                </button>
              </div>

              <div className="pt-2">
                <RemoveButton onClick={() => removeGroup(g.id)} title="Delete spec" />
              </div>
            </div>
          )}
        />
      )}

      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={addGroup}>
          + Add Row
        </Button>
      </div>
    </Card>
  );
}

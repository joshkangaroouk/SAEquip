import {
  Badge,
  Button,
  Card,
  CardHeader,
  DragHandle,
  RemoveButton,
  SortableList,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "./ui";
import type { SpecRowDraft } from "./product/productEditorTypes";

/**
 * Technical specs table. Controlled — the parent owns the rows and the unified
 * save bar commits them, so there is no Save/Reset here.
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
  const update = (id: string, field: "label" | "value", val: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  const del = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const add = () => onChange([...rows, { id: crypto.randomUUID(), label: "", value: "" }]);

  const inputCls =
    "w-full rounded-md border bg-surface px-3 py-2 text-xs font-medium text-text placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <Card id="section-specs">
      <CardHeader
        title="Technical Specs"
        description="Label/value rows rendered as a table on the product page. Drag to reorder."
        actions={dirty ? <Badge tone="accent">Unsaved</Badge> : undefined}
      />

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-small text-subtle">No rows. Add one below.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH className="w-px" />
              <TH>Label</TH>
              <TH>Value</TH>
              <TH className="w-px" />
            </TR>
          </THead>
          <SortableList
            as="tbody"
            className="divide-y divide-border"
            items={rows}
            getId={(r) => r.id}
            onReorder={onChange}
            renderItem={(r, handle) => (
              <>
                <TD className="w-px pr-0">
                  <DragHandle handle={handle} />
                </TD>
                <TD>
                  <input
                    className={`${inputCls} ${r.label.trim() ? "border-border" : "border-danger"}`}
                    value={r.label}
                    onChange={(e) => update(r.id, "label", e.target.value)}
                    placeholder="e.g. Weight"
                  />
                </TD>
                <TD>
                  <input
                    className={`${inputCls} ${r.value.trim() ? "border-border" : "border-danger"}`}
                    value={r.value}
                    onChange={(e) => update(r.id, "value", e.target.value)}
                    placeholder="e.g. 55kg"
                  />
                </TD>
                <TD className="w-px whitespace-nowrap pl-0">
                  <RemoveButton onClick={() => del(r.id)} title="Delete row" />
                </TD>
              </>
            )}
          />
        </Table>
      )}

      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={add}>
          + Add row
        </Button>
      </div>
    </Card>
  );
}

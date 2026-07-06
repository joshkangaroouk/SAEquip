import { useState } from "react";
import { apiFetch } from "../lib/api";
import { DragHandle, RemoveButton, SortableList, Table, TD, TH, THead, TR } from "./ui";
import type { HubSpecRow } from "../lib/types";

type Row = { id: string; label: string; value: string };

const toRows = (initial: HubSpecRow[]): Row[] =>
  initial.map((r) => ({ id: r.id, label: r.label, value: r.value }));

export function SpecTableEditor({
  productId,
  initial,
  onSaved,
}: {
  productId: string;
  initial: HubSpecRow[];
  onSaved: (msg: string) => void;
}) {
  const [baseline, setBaseline] = useState<Row[]>(() => toRows(initial));
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(rows) !== JSON.stringify(baseline);
  const rowValid = (r: Row) =>
    r.label.trim().length > 0 &&
    r.value.trim().length > 0 &&
    r.label.trim().length <= 200 &&
    r.value.trim().length <= 500;
  const valid = rows.length <= 100 && rows.every(rowValid);

  const update = (id: string, field: "label" | "value", val: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  const del = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const add = () => setRows((rs) => [...rs, { id: crypto.randomUUID(), label: "", value: "" }]);

  async function save() {
    if (!dirty || !valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/products/${productId}/specs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rows.map((r) => ({ label: r.label.trim(), value: r.value.trim() })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.details ? "Validation error" : json?.detail || json?.error || `Save failed (${res.status})`);
      }
      const norm = toRows(json as HubSpecRow[]);
      setBaseline(norm);
      setRows(norm);
      onSaved("Technical Specs saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-md border bg-surface px-3 py-2 text-xs font-medium text-text placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-body font-semibold text-text">Technical Specs</h3>
        <span className="text-small text-subtle">{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>

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
            onReorder={setRows}
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

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={add} className="rounded-md border border-border px-3 py-1.5 text-small font-semibold text-text hover:bg-surface-2">
          + Add row
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => { setRows(baseline); setError(null); }} disabled={!dirty || saving} className="rounded-md px-3 py-1.5 text-small font-semibold text-muted hover:text-text disabled:opacity-40">
          Reset
        </button>
        <button type="button" onClick={save} disabled={!dirty || !valid || saving} className="rounded-md bg-accent px-4 py-1.5 text-small font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {!valid && <p className="mt-2 text-small text-danger">Every label and value is required (label ≤200, value ≤500 chars); max 100 rows.</p>}
    </section>
  );
}

import { useState } from "react";
import { apiFetch } from "../lib/api";
import type { HubSpecRow } from "../lib/types";

type Row = { label: string; value: string };

const toRows = (initial: HubSpecRow[]): Row[] => initial.map((r) => ({ label: r.label, value: r.value }));

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

  const update = (i: number, field: keyof Row, val: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  const del = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const add = () => setRows((rs) => [...rs, { label: "", value: "" }]);

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
    "w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:border-gray-900";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Technical Specs</h3>
        <span className="text-xs text-gray-400">{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No rows. Add one below.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="pb-2 font-medium">Label</th>
              <th className="pb-2 font-medium">Value</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 pr-2 align-top">
                  <input
                    className={`${inputCls} ${r.label.trim() ? "border-gray-300" : "border-red-300"}`}
                    value={r.label}
                    onChange={(e) => update(i, "label", e.target.value)}
                    placeholder="e.g. Weight"
                  />
                </td>
                <td className="py-1 pr-2 align-top">
                  <input
                    className={`${inputCls} ${r.value.trim() ? "border-gray-300" : "border-red-300"}`}
                    value={r.value}
                    onChange={(e) => update(i, "value", e.target.value)}
                    placeholder="e.g. 55kg"
                  />
                </td>
                <td className="whitespace-nowrap py-1 text-gray-400">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30" title="Move up">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="px-1 disabled:opacity-30" title="Move down">↓</button>
                  <button type="button" onClick={() => del(i)} className="px-1 text-red-500 hover:text-red-700" title="Delete">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={add} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
          + Add row
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => { setRows(baseline); setError(null); }} disabled={!dirty || saving} className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-40">
          Reset
        </button>
        <button type="button" onClick={save} disabled={!dirty || !valid || saving} className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {!valid && <p className="mt-2 text-xs text-red-600">Every label and value is required (label ≤200, value ≤500 chars); max 100 rows.</p>}
    </section>
  );
}

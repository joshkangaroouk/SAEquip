import { useState } from "react";
import { apiFetch } from "../lib/api";
import { DragHandle, RemoveButton, SortableList } from "./ui";
import type { HubTextItem } from "../lib/types";

type Item = { id: string; text: string };

const toItems = (initial: HubTextItem[]): Item[] => initial.map((i) => ({ id: i.id, text: i.text }));

export function TextItemListEditor({
  title,
  productId,
  endpoint,
  initial,
  onSaved,
}: {
  title: string;
  productId: string;
  endpoint: "benefits" | "applications";
  initial: HubTextItem[];
  onSaved: (msg: string) => void;
}) {
  const [baseline, setBaseline] = useState<Item[]>(() => toItems(initial));
  const [items, setItems] = useState<Item[]>(() => toItems(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(items) !== JSON.stringify(baseline);
  const valid =
    items.length <= 100 && items.every((it) => it.text.trim().length > 0 && it.text.trim().length <= 500);

  const update = (id: string, val: string) =>
    setItems((its) => its.map((it) => (it.id === id ? { ...it, text: val } : it)));
  const del = (id: string) => setItems((its) => its.filter((it) => it.id !== id));
  const add = () => setItems((its) => [...its, { id: crypto.randomUUID(), text: "" }]);

  async function save() {
    if (!dirty || !valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/products/${productId}/${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((it) => ({ text: it.text.trim() })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.details ? "Validation error" : json?.detail || json?.error || `Save failed (${res.status})`);
      }
      const norm = toItems(json as HubTextItem[]);
      setBaseline(norm);
      setItems(norm);
      onSaved(`${title} saved`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-body font-semibold text-text">{title}</h3>
        <span className="text-small text-subtle">{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-small text-subtle">No items. Add one below.</p>
      ) : (
        <SortableList
          items={items}
          getId={(it) => it.id}
          onReorder={setItems}
          renderItem={(it, handle, index) => (
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
              <DragHandle handle={handle} />
              <span className="w-6 text-right text-xs text-subtle">{index + 1}.</span>
              <input
                className={`flex-1 rounded-md border bg-surface px-3 py-2 text-xs font-medium text-text placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${
                  it.text.trim() ? "border-border" : "border-danger"
                }`}
                value={it.text}
                onChange={(e) => update(it.id, e.target.value)}
                placeholder="Enter text…"
              />
              <RemoveButton onClick={() => del(it.id)} title="Delete item" />
            </div>
          )}
        />
      )}

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={add} className="rounded-md border border-border px-3 py-1.5 text-small font-semibold text-text hover:bg-surface-2">
          + Add item
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => { setItems(baseline); setError(null); }} disabled={!dirty || saving} className="rounded-md px-3 py-1.5 text-small font-semibold text-muted hover:text-text disabled:opacity-40">
          Reset
        </button>
        <button type="button" onClick={save} disabled={!dirty || !valid || saving} className="rounded-md bg-accent px-4 py-1.5 text-small font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {!valid && <p className="mt-2 text-small text-danger">Every item is required and must be ≤500 chars; max 100 items.</p>}
    </section>
  );
}

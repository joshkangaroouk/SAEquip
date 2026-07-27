import { useEffect, useState } from "react";
import { rectSortingStrategy } from "@dnd-kit/sortable";
import { MediaPicker } from "../components/MediaPicker";
import {
  DragHandle,
  RemoveButton,
  SortableList,
  toast,
  useConfirm,
  type DragHandleProps,
} from "../components/ui";
import { apiJson } from "../lib/api";
import type { LogoCatalogEntry, MediaAsset } from "../lib/types";

type Kind = "SA_LOGO" | "CERT_LOGO";

function LogoCard({
  entry,
  handle,
  onDelete,
  onSaved,
}: {
  entry: LogoCatalogEntry;
  handle: DragHandleProps;
  onDelete: (entry: LogoCatalogEntry) => void;
  onSaved: (updated: LogoCatalogEntry) => void;
}) {
  const [label, setLabel] = useState(entry.label ?? "");
  const [alt, setAlt] = useState(entry.alt ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = label !== (entry.label ?? "") || alt !== (entry.alt ?? "");

  async function saveMeta() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      onSaved(
        await apiJson<LogoCatalogEntry>(`/api/logos/${entry.id}`, {
          method: "PATCH",
          body: JSON.stringify({ label: label.trim() || null, alt: alt.trim() || null }),
        }),
      );
    } catch (e) {
      // Previously failed silently — a swallowed save looks identical to a
      // successful one, so surface it.
      toast.error(e instanceof Error ? e.message : "Could not save logo details");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-md border border-border px-2 py-1 text-sm font-medium focus:border-text focus:outline-none placeholder:text-subtle";

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-3">
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
        <img src={entry.url} alt={entry.alt || entry.label || "logo"} className="max-h-24 max-w-full object-contain" />
      </div>

      <div className="mt-2 space-y-2">
        <label className="block text-xs font-semibold text-muted">
          Label
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="optional" />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Alt
          <input className={inputCls} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="optional" />
        </label>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <DragHandle handle={handle} />
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">used by {entry.usage}</span>
        </div>
        <RemoveButton onClick={() => onDelete(entry)} title="Delete logo" />
      </div>

      {dirty && (
        <button onClick={saveMeta} disabled={saving} className="mt-2 rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40">
          {saving ? "Saving…" : "Save label/alt"}
        </button>
      )}
    </div>
  );
}

export default function Logos() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Kind>("SA_LOGO");
  const [entries, setEntries] = useState<LogoCatalogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function load(kind: Kind) {
    setLoading(true);
    setError(null);
    try {
      setEntries(await apiJson<LogoCatalogEntry[]>(`/api/logos?kind=${kind}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab]);

  async function onPickMedia(asset: MediaAsset) {
    setPickerOpen(false);
    try {
      const created = await apiJson<LogoCatalogEntry>("/api/logos", {
        method: "POST",
        body: JSON.stringify({ kind: tab, mediaAssetId: asset.id, alt: asset.alt || undefined }),
      });
      setEntries((prev) => [...(prev ?? []), created]);
      toast.success("Logo added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    }
  }

  async function reorder(next: LogoCatalogEntry[]) {
    setEntries(next); // optimistic
    try {
      setEntries(
        await apiJson<LogoCatalogEntry[]>("/api/logos/reorder", {
          method: "PUT",
          body: JSON.stringify({ kind: tab, orderedIds: next.map((e) => e.id) }),
        }),
      );
      toast.success("Order saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save order");
      load(tab); // revert to server state on failure
    }
  }

  function onSavedMeta(updated: LogoCatalogEntry) {
    setEntries((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? null);
    toast.success("Saved");
  }

  async function handleDelete(entry: LogoCatalogEntry) {
    const ok = await confirm({
      title: "Delete logo?",
      description: (
        <>
          This will remove the logo from the catalog and from{" "}
          <span className="font-semibold">{entry.usage} product(s)</span> that currently use it. The image
          stays in the Media Centre.
        </>
      ),
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/api/logos/${entry.id}`, { method: "DELETE" });
      setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? null);
      toast.success("Logo deleted (image kept in Media Centre)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-text">Logos</h1>
          <button onClick={() => setPickerOpen(true)} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
            + Add logo
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">Global catalog shared across all products.</p>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 text-sm">
          {(["SA_LOGO", "CERT_LOGO"] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 font-semibold ${
                tab === k ? "bg-accent text-accent-foreground" : "border border-border text-muted hover:bg-surface-2"
              }`}
            >
              {k === "SA_LOGO" ? "SA Logos" : "Cert Logos"}
            </button>
          ))}
        </div>

        {loading && <p className="mt-8 text-muted">Loading…</p>}
        {error && (
          <div className="mt-8 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}
        {!loading && !error && entries && entries.length === 0 && (
          <p className="mt-8 text-muted">No logos in this catalog yet. Add one to get started.</p>
        )}

        {!loading && !error && entries && entries.length > 0 && (
          <SortableList
            items={entries}
            getId={(entry) => entry.id}
            onReorder={reorder}
            strategy={rectSortingStrategy}
            className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            renderItem={(entry, handle) => (
              <LogoCard entry={entry} handle={handle} onDelete={handleDelete} onSaved={onSavedMeta} />
            )}
          />
        )}
      </div>

      {pickerOpen && <MediaPicker kind="image" onPick={onPickMedia} onClose={() => setPickerOpen(false)} />}
    </>
  );
}

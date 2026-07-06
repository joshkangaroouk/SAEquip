import { useEffect, useState } from "react";
import { MediaPicker } from "../components/MediaPicker";
import { apiFetch } from "../lib/api";
import type { LogoCatalogEntry, MediaAsset } from "../lib/types";

type Kind = "SA_LOGO" | "CERT_LOGO";

function LogoCard({
  entry,
  index,
  total,
  onMove,
  onDelete,
  onSaved,
}: {
  entry: LogoCatalogEntry;
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
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
      const res = await apiFetch(`/api/logos/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || null, alt: alt.trim() || null }),
      });
      if (res.ok) onSaved((await res.json()) as LogoCatalogEntry);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-md border border-border px-2 py-1 text-sm focus:border-text focus:outline-none placeholder:text-subtle";

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
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">used by {entry.usage}</span>
        <div className="text-subtle">
          <button onClick={() => onMove(index, -1)} disabled={index === 0} className="px-1 disabled:opacity-30" title="Move up">↑</button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1} className="px-1 disabled:opacity-30" title="Move down">↓</button>
          <button onClick={() => onDelete(entry)} className="px-1 text-danger hover:opacity-80" title="Delete">×</button>
        </div>
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
  const [tab, setTab] = useState<Kind>("SA_LOGO");
  const [entries, setEntries] = useState<LogoCatalogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LogoCatalogEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load(kind: Kind) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/logos?kind=${kind}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEntries(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function onPickMedia(asset: MediaAsset) {
    setPickerOpen(false);
    try {
      const res = await apiFetch("/api/logos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: tab, mediaAssetId: asset.id, alt: asset.alt || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.error || `Add failed (${res.status})`);
      setEntries((prev) => [...(prev ?? []), json as LogoCatalogEntry]);
      setToast("Logo added");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    }
  }

  async function onMove(index: number, dir: -1 | 1) {
    if (!entries) return;
    const j = index + dir;
    if (j < 0 || j >= entries.length) return;
    const reordered = [...entries];
    [reordered[index], reordered[j]] = [reordered[j], reordered[index]];
    setEntries(reordered); // optimistic
    try {
      const res = await apiFetch("/api/logos/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: tab, orderedIds: reordered.map((e) => e.id) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEntries(await res.json());
      setToast("Order saved");
    } catch {
      load(tab); // revert to server state on failure
    }
  }

  function onSavedMeta(updated: LogoCatalogEntry) {
    setEntries((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? null);
    setToast("Saved");
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/logos/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEntries((prev) => prev?.filter((e) => e.id !== deleteTarget.id) ?? null);
      setToast("Logo deleted (image kept in Media Centre)");
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

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
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {entries.map((entry, i) => (
              <LogoCard
                key={entry.id}
                entry={entry}
                index={i}
                total={entries.length}
                onMove={onMove}
                onDelete={setDeleteTarget}
                onSaved={onSavedMeta}
              />
            ))}
          </div>
        )}
      </div>

      {pickerOpen && <MediaPicker kind="image" onPick={onPickMedia} onClose={() => setPickerOpen(false)} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-text">Delete logo?</h2>
            <p className="mt-2 text-sm text-muted">
              This will remove the logo from the catalog and from{" "}
              <span className="font-semibold">{deleteTarget.usage} product(s)</span> that currently use it. The
              image stays in the Media Centre.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="rounded-md px-4 py-2 text-sm font-semibold text-muted hover:text-text">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
                {deleting ? "Deleting…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

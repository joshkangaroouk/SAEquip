import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { MediaPicker } from "./MediaPicker";
import type { DownloadItem, MediaAsset } from "../lib/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadRow({
  item,
  index,
  total,
  onMove,
  onToggleGated,
  onSaveTitle,
  onDelete,
}: {
  item: DownloadItem;
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onToggleGated: (item: DownloadItem) => void;
  onSaveTitle: (id: string, title: string) => void;
  onDelete: (item: DownloadItem) => void;
}) {
  const [title, setTitle] = useState(item.title);

  function commitTitle() {
    const t = title.trim();
    if (!t) {
      setTitle(item.title);
      return;
    }
    if (t !== item.title) {
      setTitle(t);
      onSaveTitle(item.id, t);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <span className="text-2xl">📄</span>
      <div className="min-w-[8rem] flex-1">
        <input
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text placeholder:text-subtle focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
        />
        <div className="mt-1 truncate text-xs text-subtle" title={item.file.filename}>
          {item.file.filename} · {formatBytes(item.file.sizeBytes)}
        </div>
      </div>

      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <button
          type="button"
          onClick={() => onToggleGated(item)}
          className={`inline-flex h-4 w-7 items-center rounded-full px-0.5 ${
            item.gated ? "justify-end bg-success" : "justify-start bg-subtle"
          }`}
          title="Gated"
        >
          <span className="h-3 w-3 rounded-full bg-surface" />
        </button>
        Gated
      </label>

      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
        {item.leadCount} lead{item.leadCount === 1 ? "" : "s"}
      </span>

      <a href={item.file.url} target="_blank" rel="noreferrer" className="text-xs text-text underline underline-offset-2 hover:text-muted">
        Preview
      </a>

      <span className="whitespace-nowrap text-subtle">
        <button onClick={() => onMove(index, -1)} disabled={index === 0} className="px-1 hover:text-text disabled:opacity-30" title="Move up">↑</button>
        <button onClick={() => onMove(index, 1)} disabled={index === total - 1} className="px-1 hover:text-text disabled:opacity-30" title="Move down">↓</button>
        <button onClick={() => onDelete(item)} className="px-1 text-danger hover:opacity-80" title="Delete">×</button>
      </span>
    </div>
  );
}

export function DownloadsEditor({
  productId,
  onToast,
}: {
  productId: string;
  onToast: (msg: string, error?: boolean) => void;
}) {
  const [items, setItems] = useState<DownloadItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<MediaAsset | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newGated, setNewGated] = useState(true);
  const [adding, setAdding] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DownloadItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/products/${productId}/downloads`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load downloads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  function onPickMedia(asset: MediaAsset) {
    setPickerOpen(false);
    setPendingAsset(asset);
    setNewTitle(asset.filename);
    setNewGated(true);
  }

  async function confirmAdd() {
    if (!pendingAsset || adding || !newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch(`/api/products/${productId}/downloads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaAssetId: pendingAsset.id, title: newTitle.trim(), gated: newGated }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.error || `Add failed (${res.status})`);
      setItems((prev) => [...(prev ?? []), json as DownloadItem]);
      setPendingAsset(null);
      onToast("Download added");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Add failed", true);
    } finally {
      setAdding(false);
    }
  }

  async function saveTitle(id: string, title: string) {
    try {
      const res = await apiFetch(`/api/products/${productId}/downloads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as DownloadItem;
      setItems((prev) => prev?.map((d) => (d.id === id ? updated : d)) ?? null);
      onToast("Title saved");
    } catch {
      onToast("Couldn't save title", true);
      load();
    }
  }

  async function toggleGated(item: DownloadItem) {
    const next = !item.gated;
    setItems((prev) => prev?.map((d) => (d.id === item.id ? { ...d, gated: next } : d)) ?? null);
    try {
      const res = await apiFetch(`/api/products/${productId}/downloads/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gated: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setItems((prev) => prev?.map((d) => (d.id === item.id ? { ...d, gated: !next } : d)) ?? null);
      onToast("Couldn't update gated — reverted", true);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!items) return;
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[j]] = [reordered[j], reordered[index]];
    setItems(reordered);
    try {
      const res = await apiFetch(`/api/products/${productId}/downloads/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((d) => d.id) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(await res.json());
    } catch {
      onToast("Couldn't reorder — reverted", true);
      load();
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const q = deleteTarget.leadCount > 0 ? "?force=true" : "";
      const res = await apiFetch(`/api/products/${productId}/downloads/${deleteTarget.id}${q}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev?.filter((d) => d.id !== deleteTarget.id) ?? null);
      onToast("Download deleted (file kept in Media Centre)");
      setDeleteTarget(null);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Delete failed", true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Downloads</h3>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          + Add download
        </button>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && items && items.length === 0 && (
        <p className="text-sm text-subtle">No downloads yet.</p>
      )}

      {!loading && !error && items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <DownloadRow
              key={item.id}
              item={item}
              index={i}
              total={items.length}
              onMove={move}
              onToggleGated={toggleGated}
              onSaveTitle={saveTitle}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {pickerOpen && <MediaPicker kind="file" onPick={onPickMedia} onClose={() => setPickerOpen(false)} />}

      {/* Title + gated prompt after picking a file */}
      {pendingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingAsset(null)}>
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-text">Add download</h2>
            <p className="mt-1 truncate text-xs text-subtle">{pendingAsset.filename}</p>
            <label className="mt-4 block text-sm font-semibold text-text">
              Title
              <input
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-subtle focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={newGated} onChange={(e) => setNewGated(e.target.checked)} />
              Gated (require lead capture before download)
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setPendingAsset(null)} className="rounded-md px-4 py-2 text-sm font-semibold text-muted hover:text-text">
                Cancel
              </button>
              <button onClick={confirmAdd} disabled={adding || !newTitle.trim()} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40">
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-text">Delete download?</h2>
            <p className="mt-2 text-sm text-muted">
              {deleteTarget.leadCount > 0 ? (
                <>
                  This download has <span className="font-semibold">{deleteTarget.leadCount} captured lead(s)</span>.
                  Deleting it will permanently remove those leads too. The file stays in the Media Centre.
                </>
              ) : (
                <>Delete this download? The file stays in the Media Centre.</>
              )}
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
    </section>
  );
}

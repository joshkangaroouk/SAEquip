import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { MediaPicker } from "./MediaPicker";
import { Badge, Checkbox, DragHandle, FileIcon, RemoveButton, SortableList, Toggle, useConfirm, type DragHandleProps } from "./ui";
import type { DownloadItem, MediaAsset } from "../lib/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadRow({
  item,
  handle,
  onToggleGated,
  onSaveTitle,
  onDelete,
}: {
  item: DownloadItem;
  handle: DragHandleProps;
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
      <DragHandle handle={handle} />
      <FileIcon />
      <div className="min-w-[8rem] flex-1">
        <input
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text placeholder:text-subtle focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
        />
        <div className="mt-1 truncate text-xs text-subtle" title={item.file.filename}>
          {item.file.filename} · {formatBytes(item.file.sizeBytes)}
        </div>
      </div>

      <Toggle checked={item.gated} onChange={() => onToggleGated(item)} label="Gated" />

      <Badge tone="neutral">
        {item.leadCount} lead{item.leadCount === 1 ? "" : "s"}
      </Badge>

      <a href={item.file.url} target="_blank" rel="noreferrer" className="text-small text-text underline underline-offset-2 hover:text-muted">
        Preview
      </a>

      <RemoveButton onClick={() => onDelete(item)} title="Delete download" />
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
  const confirm = useConfirm();
  const [items, setItems] = useState<DownloadItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<MediaAsset | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newGated, setNewGated] = useState(true);
  const [adding, setAdding] = useState(false);

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

  async function reorder(next: DownloadItem[]) {
    setItems(next);
    try {
      const res = await apiFetch(`/api/products/${productId}/downloads/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((d) => d.id) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(await res.json());
    } catch {
      onToast("Couldn't reorder — reverted", true);
      load();
    }
  }

  async function handleDelete(item: DownloadItem) {
    const ok = await confirm({
      title: "Delete download?",
      description:
        item.leadCount > 0 ? (
          <>
            This download has <span className="font-semibold">{item.leadCount} captured lead(s)</span>.
            Deleting it will permanently remove those leads too. The file stays in the Media Centre.
          </>
        ) : (
          <>Delete this download? The file stays in the Media Centre.</>
        ),
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const q = item.leadCount > 0 ? "?force=true" : "";
      const res = await apiFetch(`/api/products/${productId}/downloads/${item.id}${q}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev?.filter((d) => d.id !== item.id) ?? null);
      onToast("Download deleted (file kept in Media Centre)");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Delete failed", true);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-body font-semibold text-text">Downloads</h3>
        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-md bg-accent px-3 py-1.5 text-small font-semibold text-accent-foreground hover:bg-accent-hover"
        >
          + Add download
        </button>
      </div>

      {loading && <p className="text-body text-muted">Loading…</p>}
      {error && <p className="text-body text-danger">{error}</p>}
      {!loading && !error && items && items.length === 0 && (
        <p className="text-body text-subtle">No downloads yet.</p>
      )}

      {!loading && !error && items && items.length > 0 && (
        <SortableList
          items={items}
          getId={(item) => item.id}
          onReorder={reorder}
          renderItem={(item, handle) => (
            <DownloadRow
              item={item}
              handle={handle}
              onToggleGated={toggleGated}
              onSaveTitle={saveTitle}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      {pickerOpen && <MediaPicker kind="file" onPick={onPickMedia} onClose={() => setPickerOpen(false)} />}

      {/* Title + gated prompt after picking a file */}
      {pendingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingAsset(null)}>
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h3 font-semibold text-text">Add download</h2>
            <p className="mt-1 truncate text-small text-subtle">{pendingAsset.filename}</p>
            <label className="mt-4 block text-small font-semibold text-text">
              Title
              <input
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-body font-medium text-text placeholder:text-subtle focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <Checkbox
              checked={newGated}
              onChange={setNewGated}
              label="Gated (require lead capture before download)"
              className="mt-4"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setPendingAsset(null)} className="rounded-md px-4 py-2 text-small font-semibold text-muted hover:text-text">
                Cancel
              </button>
              <button onClick={confirmAdd} disabled={adding || !newTitle.trim()} className="rounded-md bg-accent px-4 py-2 text-small font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40">
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

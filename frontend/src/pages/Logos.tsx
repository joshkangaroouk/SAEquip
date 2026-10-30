import { useEffect, useRef, useState } from "react";
import { rectSortingStrategy } from "@dnd-kit/sortable";
import { MediaPicker } from "../components/MediaPicker";
import { UsagePill } from "../components/UsagePill";
import {
  Button,
  DragHandle,
  Input,
  RemoveButton,
  Skeleton,
  SortableList,
  toast,
  type DragHandleProps,
  useConfirm,
} from "../components/ui";
import { apiJson } from "../lib/api";
import type { AssetUsage, LogoCatalogEntry, MediaAsset } from "../lib/types";

type Kind = "SA_LOGO" | "CERT_LOGO";

function LogoCard({
  entry,
  handle,
  onDelete,
  onReplace,
  onSaved,
}: {
  entry: LogoCatalogEntry;
  handle: DragHandleProps;
  onDelete: (entry: LogoCatalogEntry) => void;
  onReplace: (entry: LogoCatalogEntry) => void;
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


  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-3">
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-paper">
        <img src={entry.url} alt={entry.alt || entry.label || "logo"} className="max-h-24 max-w-full object-contain" />
      </div>
      <Button variant="secondary" size="xs" className="mt-2" onClick={() => onReplace(entry)}>
        Replace image
      </Button>

      <div className="mt-2 space-y-2">
        <label className="block text-label font-semibold text-muted">
          Label
          <Input size="sm" className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="optional" />
        </label>
        <label className="block text-label font-semibold text-muted">
          Alt
          <Input size="sm" className="mt-1" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="optional" />
        </label>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <DragHandle handle={handle} label={`Drag ${entry.label || entry.alt || "logo"} to reorder`} />
          <UsagePill
            count={entry.usage}
            label={`Used by ${entry.usage}`}
            subject={entry.label || entry.alt || "Logo"}
            load={() => apiJson<AssetUsage>(`/api/logos/${entry.id}/products`)}
          />
        </div>
        <RemoveButton onClick={() => onDelete(entry)} title="Delete logo" />
      </div>

      {dirty && (
        <Button size="sm" onClick={saveMeta} disabled={saving} className="mt-2">
          {saving ? "Saving…" : "Save label/alt"}
        </Button>
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
  // The logo whose image is being replaced: the picker is open for it.
  const [replacing, setReplacing] = useState<LogoCatalogEntry | null>(null);

  // Only the latest request may land: a slow reply for the tab just left
  // would otherwise show SA logos under the Certification tab (and vice versa).
  const latest = useRef(0);
  async function load(kind: Kind) {
    const req = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await apiJson<LogoCatalogEntry[]>(`/api/logos?kind=${kind}`);
      if (req === latest.current) setEntries(rows);
    } catch (e) {
      if (req === latest.current) setError(e instanceof Error ? e.message : "Failed to load logos");
    } finally {
      if (req === latest.current) setLoading(false);
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

  /*
   * A new image for an existing logo. The logo keeps its id, so every product
   * that carries it, its label/alt, order and translations are untouched; only
   * the picture changes, everywhere at once. Hence the before/after and the
   * product count before anything is written.
   */
  async function onPickReplacement(asset: MediaAsset) {
    const entry = replacing;
    setReplacing(null);
    if (!entry) return;
    if (asset.id === entry.mediaAssetId) {
      toast.message("That is already this logo's image");
      return;
    }
    const name = entry.label || entry.alt || "this logo";
    const ok = await confirm({
      title: "Replace logo image?",
      description: (
        <>
          {/* Spans, not divs: the dialog renders its description in a <p>. */}
          <span className="mb-3 flex items-center justify-center gap-3">
            <span className="flex h-20 w-28 items-center justify-center rounded-lg bg-paper p-2">
              <img src={entry.url} alt="Current image" className="max-h-full max-w-full object-contain" />
            </span>
            <span aria-hidden="true" className="text-muted">→</span>
            <span className="flex h-20 w-28 items-center justify-center rounded-lg bg-paper p-2">
              <img src={asset.url ?? ""} alt="New image" className="max-h-full max-w-full object-contain" />
            </span>
          </span>
          {entry.usage > 0 ? (
            <>
              The new image replaces <span className="font-semibold">{name}</span> on{" "}
              <span className="font-semibold">{entry.usage} product{entry.usage === 1 ? "" : "s"}</span>, on the
              website within about a minute.
            </>
          ) : (
            <>No product carries {name} yet.</>
          )}{" "}
          The label, alt text and order stay as they are, and the old image stays in the Media Centre.
        </>
      ),
      confirmLabel: "Replace image",
    });
    if (!ok) return;
    try {
      const updated = await apiJson<LogoCatalogEntry>(`/api/logos/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ mediaAssetId: asset.id }),
      });
      setEntries((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? null);
      toast.success("Logo image replaced");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not replace the image");
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
          <h1 className="t-h1 text-text">Logos</h1>
          <Button onClick={() => setPickerOpen(true)}>+ Add logo</Button>
        </div>
        <p className="mt-1 text-body text-muted">Global catalog shared across all products.</p>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 text-body">
          {(["SA_LOGO", "CERT_LOGO"] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 font-semibold ${
                tab === k ? "bg-accent text-accent-ink" : "border border-border text-muted hover:bg-surface-2"
              }`}
            >
              {k === "SA_LOGO" ? "SA Logos" : "Cert Logos"}
            </button>
          ))}
        </div>

        {/* The same 2/3/4-up grid and the same 8rem tile, so the real logos
            drop straight into place. */}
        {loading && (
          <div
            className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            aria-busy="true"
            aria-live="polite"
            aria-label="Loading logos"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex flex-col rounded-xl border border-border bg-surface p-3">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="mt-8 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-body text-danger">{error}</div>
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
              <LogoCard
                entry={entry}
                handle={handle}
                onDelete={handleDelete}
                onReplace={setReplacing}
                onSaved={onSavedMeta}
              />
            )}
          />
        )}
      </div>

      {pickerOpen && <MediaPicker kind="image" onPick={onPickMedia} onClose={() => setPickerOpen(false)} />}
      {replacing && <MediaPicker kind="image" onPick={onPickReplacement} onClose={() => setReplacing(null)} />}
    </>
  );
}

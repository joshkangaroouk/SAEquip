import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { MediaPicker } from "../components/MediaPicker";
import { UsagePill } from "../components/UsagePill";
import {
  PageHeader,
  Alert,
  Button,
  DragHandle,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  Skeleton,
  SortableList,
  toast,
  type DragHandleProps,
  useConfirm,
} from "../components/ui";
import { apiJson } from "../lib/api";
import type { AssetUsage, LogoCatalogEntry, MediaAsset } from "../lib/types";

type Kind = "SA_LOGO" | "CERT_LOGO";

/**
 * One logo as a row (00): the drag handle, the lockup on paper, the label and
 * alt text, "Used by N products", Replace and Delete. "Save" appears while
 * the label or alt text differs from what is saved (KEEP-S).
 */
function LogoRow({
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
  const name = entry.label || entry.alt || "logo";

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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <DragHandle handle={handle} label={`Drag ${name} to reorder`} />
      {/* The lockup on paper. Decorative here: its words are in the fields beside it. */}
      <span className="flex h-16 w-28 shrink-0 items-center justify-center border border-border bg-paper p-2">
        <img src={entry.url} alt="" className="max-h-full max-w-full object-contain" />
      </span>

      <div className="grid min-w-0 flex-1 basis-72 gap-3 sm:grid-cols-2">
        <Field label="Label">
          <Input
            size="sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional"
            aria-label={`Label for ${name}`}
          />
        </Field>
        <Field label="Alt text">
          <Input
            size="sm"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Optional"
            aria-label={`Alt text for ${name}`}
          />
        </Field>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:self-end">
        <UsagePill
          count={entry.usage}
          label={`Used by ${entry.usage} product${entry.usage === 1 ? "" : "s"}`}
          subject={name}
          load={() => apiJson<AssetUsage>(`/api/logos/${entry.id}/products`)}
        />
        <span className="ml-auto flex items-center gap-2">
          {dirty && (
            <Button size="sm" onClick={saveMeta} loading={saving} aria-label={`Save the label and alt text of ${name}`}>
              Save
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => onReplace(entry)} aria-label={`Replace the image of ${name}`}>
            Replace
          </Button>
          <button
            type="button"
            onClick={() => onDelete(entry)}
            aria-label={`Delete ${name}`}
            title="Delete logo"
            className="inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center text-muted transition-colors duration-[120ms] hover:bg-danger-bg hover:text-danger"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </span>
      </div>
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
            <span className="flex h-20 w-28 items-center justify-center border border-border bg-paper p-2">
              <img src={entry.url} alt="Current image" className="max-h-full max-w-full object-contain" />
            </span>
            <span aria-hidden="true" className="text-muted">→</span>
            <span className="flex h-20 w-28 items-center justify-center border border-border bg-paper p-2">
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
      <PageHeader
        title="Logos"
        description="Global catalog shared across all products."
        actions={
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Add logo
          </Button>
        }
      />

      <SegmentedControl<Kind>
        className="mb-4"
        ariaLabel="Logo catalogue"
        value={tab}
        onChange={setTab}
        options={[
          { value: "SA_LOGO", label: "SA range" },
          { value: "CERT_LOGO", label: "Certification" },
        ]}
      />

      {/* The same rows, the same height: a 64px lockup beside a labelled
          34px field. (The old skeleton tile was h-32 against a real h-24, so
          the page jumped on load.) */}
      {loading && (
        <div className="border border-border bg-surface" aria-busy="true" aria-live="polite" aria-label="Loading logos">
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                <Skeleton className="h-8.5 w-8.5" />
                <Skeleton className="h-16 w-28" />
                <div className="grid min-w-0 flex-1 basis-72 gap-3 sm:grid-cols-2">
                  {[0, 1].map((j) => (
                    <div key={j}>
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="mt-1.5 h-8.5 w-full" />
                    </div>
                  ))}
                </div>
                <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto sm:self-end">
                  <Skeleton className="h-6.5 w-36" />
                  <Skeleton className="ml-auto h-8.5 w-20" />
                  <Skeleton className="h-8.5 w-8.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {!loading && !error && entries && entries.length === 0 && (
        <EmptyState
          title="No logos in this catalog yet"
          description="Add one from the Media Centre to get started."
          action={
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              Add logo
            </Button>
          }
        />
      )}

      {!loading && !error && entries && entries.length > 0 && (
        <div className="border border-border bg-surface">
          <SortableList
            items={entries}
            getId={(entry) => entry.id}
            onReorder={reorder}
            className="divide-y divide-border"
            renderItem={(entry, handle) => (
              <LogoRow
                entry={entry}
                handle={handle}
                onDelete={handleDelete}
                onReplace={setReplacing}
                onSaved={onSavedMeta}
              />
            )}
          />
        </div>
      )}

      {pickerOpen && <MediaPicker kind="image" onPick={onPickMedia} onClose={() => setPickerOpen(false)} />}
      {replacing && <MediaPicker kind="image" onPick={onPickReplacement} onClose={() => setReplacing(null)} />}
    </>
  );
}

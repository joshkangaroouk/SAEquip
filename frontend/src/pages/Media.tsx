import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, LayoutGrid, List, Search, Trash2, X } from "lucide-react";
import { apiFetch, apiJson } from "../lib/api";
import { uploadFile } from "../lib/upload";
import {
  PageHeader,
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  FileInput,
  FilePreview,
  ImageWell,
  Input,
  Modal,
  Pagination,
  SegmentedControl,
  SelectMenu,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Thumb,
  TR,
  useConfirm,
} from "../components/ui";
import { UsagePill } from "../components/UsagePill";
import { MEDIA_SORT_OPTIONS, useMediaLibrary, type MediaKind, type MediaSort } from "../lib/useMediaLibrary";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { formatDateTime } from "../lib/format";
import { cn } from "../lib/cn";
import type { AssetUsage, MediaAsset } from "../lib/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Kind tabs.
 *
 * ⚠️ "3D Models" used to be missing: the filter type was `"" | "image" |
 * "file"` and the label fell through to "Files" for anything that wasn't an
 * image, so the three .glb models had no tab of their own and the Files tab —
 * which matches 0 assets, since the library is all images and models —
 * looked like the place everything had landed.
 */
const KIND_TABS: { value: "" | MediaKind; label: string }[] = [
  { value: "", label: "All" },
  { value: "image", label: "Images" },
  { value: "file", label: "Files" },
  { value: "model", label: "3D Models" },
];

const KIND_LABEL: Record<string, string> = { image: "Image", file: "File", model: "3D model" };

/** "Image · WEBP", "File · PDF", "3D model · GLB". */
function typeLabel(a: MediaAsset): string {
  const ext = a.filename.includes(".") ? a.filename.split(".").pop()!.toUpperCase() : "";
  return [KIND_LABEL[a.kind] ?? "File", ext].filter(Boolean).join(" · ");
}

const UNTRACKED_IMAGES =
  "Product gallery images aren't counted: Duda keeps its own copy of each one, so deleting this original cannot break a live gallery.";

/**
 * "Used N×" opens the list of products behind it; anything else reads
 * "Unused" — plain content (02 §6), with the reason in the detail panel.
 *
 * `usage` is distinct PRODUCTS reached through a logo, a download or a 3D
 * model. ⚠️ Product gallery images are NOT counted and cannot be: an image is
 * uploaded only to give Duda a URL to fetch, and once Duda re-hosts it the
 * product points at `irp.cdn-website.com` with nothing linking back. So a
 * product photo on a live page reads "Unused" here — the panel says so, and
 * deleting one cannot break a gallery because Duda holds its own copy.
 */
function UsageNote({ asset }: { asset: MediaAsset }) {
  if (asset.usage > 0) {
    return (
      <UsagePill
        count={asset.usage}
        label={`Used ${asset.usage}×`}
        subject={asset.filename}
        load={() => apiJson<AssetUsage>(`/api/media/${asset.id}/usage`)}
      />
    );
  }
  return <span>Unused</span>;
}

/** Why Delete is off, from what the list knows (products only); null when it is on. */
function listBlock(a: MediaAsset): string | null {
  return a.usage > 0 ? `Used on ${a.usage} product${a.usage === 1 ? "" : "s"}` : null;
}

/** A file's preview: the image itself, or the file's first page / type icon — on paper either way. */
function Preview({ asset, className }: { asset: MediaAsset; className?: string }) {
  return asset.kind === "image" ? (
    <ImageWell src={asset.url} alt="" aspect="square" className={className} />
  ) : (
    <FilePreview
      thumbnailUrl={asset.thumbnailUrl}
      filename={asset.filename}
      mimeType={asset.mimeType}
      className={cn("aspect-square w-full border border-border", className)}
      iconClassName="h-14 w-11"
    />
  );
}

const MEDIA_PAGE_SIZE = 24;
/** From xl the detail panel sits beside the library; below it, it opens as a dialog. */
const XL = "(min-width: 1280px)";

export default function Media() {
  const confirm = useConfirm();
  const searchId = useId();
  const [kind, setKind] = useState<"" | MediaKind>("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const lib = useMediaLibrary({ kind: kind || undefined, pageSize: MEDIA_PAGE_SIZE });
  const wide = useMediaQuery(XL);

  // The selected file. Held as the asset itself, not an index into the page,
  // so the panel keeps showing it while another page loads.
  const [selected, setSelected] = useState<MediaAsset | null>(null);

  /**
   * Change page and bring the list back into view.
   *
   * The pager sits BELOW the grid, so clicking Next left you at the bottom of
   * a page whose new content had started above you. This returns to the top
   * of the list — the toolbar, so the tab and search you are in stay visible.
   *
   * ⚠️ Only when you have scrolled PAST the toolbar. If it is already on
   * screen there is nothing to return to, and forcing the scroll would push
   * the upload card out of view for no reason. The threshold is where the
   * scroll would put it — the page's scroll padding (the sticky top bar) plus
   * the element's own scroll-margin — so a toolbar under the top bar counts
   * as "out of view" too.
   *
   * Scrolls on the click, not when the data lands: the current page stays
   * mounted and dims while the next one loads, so moving now means nothing
   * jumps again when it arrives.
   */
  const listTop = useRef<HTMLDivElement>(null);
  function goToPage(page: number) {
    lib.setPage(page);
    const el = listTop.current;
    if (!el) return;
    const margin =
      (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
      (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
    if (el.getBoundingClientRect().top >= margin) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      // Straight to Supabase via a signed URL, then confirmed with the API —
      // the file never passes through the backend. See lib/upload.ts.
      await uploadFile(file, { alt: alt.trim() || undefined });
      setFile(null);
      setAlt("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Clears any search and jumps to newest-first page 1, so the upload is
      // actually on screen rather than buried by the active filter.
      setKind("");
      lib.showNewest();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(asset: MediaAsset) {
    const ok = await confirm({
      title: `Delete "${asset.filename}"?`,
      description:
        "This file may be used on the live website (a product image, logo, or download). Deleting it cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    const id = asset.id;
    setDeleteErrors((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    const res = await apiFetch(`/api/media/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      if (selected?.id === id) setSelected(null);
      // Re-fetch rather than splicing: the page is a window onto a sorted
      // query, so removing one item should pull the next one up into it.
      lib.reload();
      return;
    }
    if (res.status === 409) {
      const j = await res.json().catch(() => ({}));
      const n = Number(j.count) || 0;
      setDeleteErrors((m) => ({
        ...m,
        [id]:
          n > 0
            ? `Can't delete: used on ${n} product${n === 1 ? "" : "s"}.`
            : "Can't delete: it's in the logo catalogue. Remove it on the Logos page first.",
      }));
      return;
    }
    const j = await res.json().catch(() => ({}));
    setDeleteErrors((m) => ({ ...m, [id]: j.detail || j.error || `Delete failed (${res.status})` }));
  }

  const select = (a: MediaAsset) => setSelected((s) => (s?.id === a.id ? null : a));
  const detail = selected && (
    <MediaDetail
      key={selected.id}
      asset={selected}
      deleteError={deleteErrors[selected.id]}
      onDelete={() => void onDelete(selected)}
    />
  );

  return (
    <>
      <PageHeader title="Media" description="Reusable library of images and files, stored in Supabase." />

      {/* Upload */}
      <Card className="mb-6">
        <form onSubmit={onUpload} className="flex flex-wrap items-end gap-x-5 gap-y-4">
          <div>
            <span className="t-label mb-1.5 block">File</span>
            <FileInput file={file} onChange={setFile} inputRef={fileInputRef} />
          </div>
          <Field label="Alt text (optional)" htmlFor="upload-alt" className="w-full sm:w-72">
            <Input
              id="upload-alt"
              size="sm"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image"
            />
          </Field>
          <Button type="submit" size="sm" disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </form>
        {uploadError && (
          <Alert tone="danger" className="mt-4">
            {uploadError}
          </Alert>
        )}
      </Card>

      {/* Kind tabs, search, sort and view. Also where paging scrolls back to — see goToPage. */}
      <div ref={listTop} className="mb-4 flex scroll-mt-20 flex-wrap items-center gap-3 lg:scroll-mt-4">
        <SegmentedControl ariaLabel="File type" value={kind} onChange={setKind} options={KIND_TABS} />

        <div className="relative w-full min-w-0 sm:w-64">
          <label htmlFor={searchId} className="sr-only">
            Search media by filename or alt text
          </label>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            id={searchId}
            size="sm"
            type="search"
            value={lib.q}
            onChange={(e) => lib.setQ(e.target.value)}
            placeholder="Filename or alt text…"
            className="pl-9"
          />
        </div>

        <div className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
          <SelectMenu
            className="min-w-0 flex-1 sm:w-44 sm:flex-none"
            ariaLabel="Sort media"
            value={lib.sort}
            onChange={(v) => lib.setSort(v as MediaSort)}
            options={MEDIA_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <SegmentedControl<"grid" | "list">
            ariaLabel="View"
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <ViewLabel icon={<LayoutGrid size={16} />} text="Grid" /> },
              { value: "list", label: <ViewLabel icon={<List size={16} />} text="List" /> },
            ]}
          />
        </div>
      </div>

      <div className={cn(wide && "grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-5")}>
        <div className="min-w-0">
          {/* States */}
          {/* The same grid and the same tile as a real asset, so the library
              does not reflow the page as it arrives. First load only — see
              the note on the grid below. */}
          {lib.isInitialLoad && (
            <div aria-busy="true" aria-live="polite" aria-label="Loading media">
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <li key={i} className="border border-border bg-surface p-2">
                    <Skeleton className="aspect-square w-full" />
                    <div className="px-1 pb-1 pt-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                      <Skeleton className="mt-3 h-8.5 w-full" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lib.error && <Alert tone="danger">{lib.error}</Alert>}
          {lib.isEmpty && (
            <EmptyState
              title={lib.isFiltered ? "Nothing matches that search" : "No media yet"}
              description={lib.isFiltered ? "Try another filename or alt text." : "Upload a file to get started."}
            />
          )}

          {/*
            * The library. ⚠️ Rendered while loading too, NOT `!lib.loading &&
            * …`. That condition unmounted the whole grid AND the pager on every
            * page click, so the page collapsed and sprang back and the buttons
            * moved out from under the cursor. The current page stays put and
            * dims until the next one lands.
            */}
          {!lib.error && lib.items.length > 0 && (
            <>
              <div
                className={cn("transition-opacity", lib.loading && "pointer-events-none opacity-50")}
                aria-busy={lib.loading}
              >
                {view === "grid" ? (
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {lib.items.map((a) => (
                      <li key={a.id}>
                        <AssetTile
                          asset={a}
                          selected={selected?.id === a.id}
                          onSelect={() => select(a)}
                          onDelete={() => void onDelete(a)}
                          deleteError={deleteErrors[a.id]}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <AssetTable
                    items={lib.items}
                    selectedId={selected?.id ?? null}
                    onSelect={select}
                    onDelete={(a) => void onDelete(a)}
                    deleteErrors={deleteErrors}
                  />
                )}
              </div>

              <Pagination
                className="mt-5"
                page={lib.page}
                total={lib.total}
                pageSize={MEDIA_PAGE_SIZE}
                onPageChange={goToPage}
                label="files"
              />
            </>
          )}
        </div>

        {/* From xl: the detail panel, kept in view as the library scrolls. */}
        {wide && (
          <aside aria-label="File details" className="sticky top-20 border border-border bg-surface">
            {detail ? (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <h2 className="t-section min-w-0 text-text [overflow-wrap:anywhere]">{selected.filename}</h2>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Close the file details"
                    className="-mr-2 -mt-1 flex h-8.5 w-8.5 shrink-0 items-center justify-center text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="p-5">{detail}</div>
              </>
            ) : (
              <p className="px-5 py-10 text-center text-help text-muted">
                Select a file to see its details, where it is used, and to delete it.
              </p>
            )}
          </aside>
        )}
      </div>

      {/* Below xl: the same details in a dialog. */}
      {!wide && (
        <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.filename ?? "File details"}>
          {detail}
        </Modal>
      )}
    </>
  );
}

function ViewLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only sm:not-sr-only">{text}</span>
    </span>
  );
}

/**
 * A grid tile on paper. The preview and name are one button that selects the
 * file (the selected tile: a 2px --selected-bar outline on --selected-bg, 02a
 * "After 4a"); Preview and Delete sit below, named for their file.
 */
function AssetTile({
  asset: a,
  selected,
  onSelect,
  onDelete,
  deleteError,
}: {
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleteError?: string;
}) {
  const blocked = listBlock(a);
  return (
    <div
      className={cn(
        "flex h-full flex-col border p-2",
        selected ? "border-selected-bar bg-selected outline outline-1 outline-selected-bar" : "border-border bg-surface",
      )}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="block text-left">
        <Preview asset={a} />
        {/* The WHOLE name. Imported filenames carry the product code, range
            and document type, so truncating them hid exactly the part that
            tells two files apart. overflow-wrap:anywhere because they have no
            spaces to break at. */}
        <span className={cn("block px-1 pt-2 text-body text-text [overflow-wrap:anywhere]", selected ? "font-semibold" : "font-medium")}>
          {a.filename}
        </span>
      </button>
      <div className="mt-1 flex flex-1 flex-col px-1 pb-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-label text-muted">
          <span>{formatBytes(a.sizeBytes)}</span>
          <span aria-hidden="true">·</span>
          <UsageNote asset={a} />
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2.5">
          {/* A file that could not be signed comes back url: null — say so
              rather than offering a link that goes nowhere. */}
          {a.url ? (
            <ButtonLink
              href={a.url}
              target="_blank"
              rel="noreferrer"
              size="sm"
              className="px-2"
              aria-label={`Preview ${a.filename} (opens in a new tab)`}
            >
              Preview
            </ButtonLink>
          ) : (
            <span className="flex items-center justify-center">
              <Badge tone="danger">File missing</Badge>
            </span>
          )}
          <Button
            variant="danger"
            size="sm"
            className="px-2"
            onClick={onDelete}
            disabled={!!blocked}
            aria-label={blocked ? `Delete ${a.filename}: not while it is in use. ${blocked}` : `Delete ${a.filename}`}
            title={blocked ? `${blocked}. Remove it there first.` : undefined}
          >
            Delete
          </Button>
        </div>
        {deleteError && (
          <p role="alert" className="mt-1.5 text-label text-danger">
            {deleteError}
          </p>
        )}
      </div>
    </div>
  );
}

/** The list view: one row per file, the name selecting it. */
function AssetTable({
  items,
  selectedId,
  onSelect,
  onDelete,
  deleteErrors,
}: {
  items: MediaAsset[];
  selectedId: string | null;
  onSelect: (a: MediaAsset) => void;
  onDelete: (a: MediaAsset) => void;
  deleteErrors: Record<string, string>;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>File</TH>
          <TH className="hidden w-px sm:table-cell">Type</TH>
          <TH className="hidden w-px md:table-cell">Size</TH>
          <TH className="hidden w-px md:table-cell">Usage</TH>
          <TH className="w-px">
            <span className="sr-only">Actions</span>
          </TH>
        </TR>
      </THead>
      <TBody>
        {items.map((a) => {
          const blocked = listBlock(a);
          const selected = a.id === selectedId;
          return (
            <TR key={a.id} hover selected={selected} onClick={() => onSelect(a)}>
              <TD primary>
                <div className="flex items-center gap-3">
                  {a.kind === "image" ? (
                    <Thumb src={a.url} size={40} />
                  ) : (
                    <FilePreview
                      thumbnailUrl={a.thumbnailUrl}
                      filename={a.filename}
                      mimeType={a.mimeType}
                      className="h-10 w-10 shrink-0 border border-border"
                      iconClassName="h-7 w-6"
                    />
                  )}
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelect(a)}
                      aria-pressed={selected}
                      className="text-left text-text [overflow-wrap:anywhere]"
                    >
                      {a.filename}
                    </button>
                    {deleteErrors[a.id] && (
                      <p role="alert" className="text-label text-danger">
                        {deleteErrors[a.id]}
                      </p>
                    )}
                  </div>
                </div>
              </TD>
              <TD className="hidden whitespace-nowrap text-muted sm:table-cell">{typeLabel(a)}</TD>
              <TD className="t-code hidden whitespace-nowrap text-muted md:table-cell">{formatBytes(a.sizeBytes)}</TD>
              <TD className="hidden whitespace-nowrap text-label text-muted md:table-cell">
                <UsageNote asset={a} />
              </TD>
              <TD className="whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Preview ${a.filename} (opens in a new tab)`}
                      title="Preview"
                      className="inline-flex h-8.5 w-8.5 items-center justify-center text-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-text"
                    >
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  ) : (
                    <Badge tone="danger">File missing</Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(a)}
                    disabled={!!blocked}
                    aria-label={blocked ? `Delete ${a.filename}: not while it is in use. ${blocked}` : `Delete ${a.filename}`}
                    title={blocked ? `${blocked}. Remove it there first.` : "Delete"}
                    className="inline-flex h-8.5 w-8.5 items-center justify-center text-muted transition-colors duration-[120ms] enabled:hover:bg-danger-bg enabled:hover:text-danger disabled:cursor-not-allowed disabled:text-border-input"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

/**
 * The selected file (00 "detail panel"): its preview, type, size and alt text,
 * what uses it, Preview, and Delete — off while anything uses it, with the
 * reason shown rather than a failed delete (02 §6). Alt text is read-only and
 * there is no Replace: the media API has no route for either yet.
 */
function MediaDetail({
  asset: a,
  deleteError,
  onDelete,
}: {
  asset: MediaAsset;
  deleteError?: string;
  onDelete: () => void;
}) {
  const [usage, setUsage] = useState<AssetUsage | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiJson<AssetUsage>(`/api/media/${a.id}/usage`)
      .then((u) => live && setUsage(u))
      .catch((e) => live && setUsageError(e instanceof Error ? e.message : "Could not load where it is used"));
    return () => {
      live = false;
    };
  }, [a.id]);

  const products = usage?.products ?? [];
  const logos = usage?.logos ?? [];
  const reasons = [
    products.length > 0 && `used on ${products.length} product${products.length === 1 ? "" : "s"}`,
    logos.length > 0 && `in the logo catalogue`,
  ].filter(Boolean) as string[];
  // Until the usage arrives, fall back to what the list knew.
  const blocked = usage ? reasons.length > 0 : a.usage > 0;

  return (
    <div className="space-y-5">
      <Preview asset={a} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <dt className="t-label">Type</dt>
          <dd className="mt-0.5 text-body text-text">{typeLabel(a)}</dd>
        </div>
        <div>
          <dt className="t-label">Size</dt>
          <dd className="mt-0.5 font-mono text-help text-text">{formatBytes(a.sizeBytes)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="t-label">Alt text</dt>
          <dd className="mt-0.5 text-body text-text">
            {a.alt || (
              <>
                <span aria-hidden="true" className="text-muted">
                  —
                </span>
                <span className="sr-only">None</span>
              </>
            )}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="t-label">Added</dt>
          <dd className="mt-0.5 text-body text-text">{formatDateTime(a.createdAt)}</dd>
        </div>
      </dl>

      <section aria-labelledby={`used-by-${a.id}`}>
        <h3 id={`used-by-${a.id}`} className="t-overline mb-2">
          Used by
        </h3>
        {usageError && <p className="text-help text-danger">{usageError}</p>}
        {!usage && !usageError && (
          <div aria-busy="true" aria-label="Loading where it is used" className="space-y-2">
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {usage && products.length === 0 && logos.length === 0 && (
          <p className="text-help text-muted">
            Unused.{a.kind === "image" && ` ${UNTRACKED_IMAGES}`}
          </p>
        )}
        {logos.length > 0 && (
          <p className="mb-2 text-help text-text">
            In the logo catalogue as{" "}
            {logos.map((l, i) => (
              <span key={l.id}>
                {i > 0 && ", "}
                <span className="font-semibold">{l.label?.trim() || "an unnamed logo"}</span>
              </span>
            ))}
            .{" "}
            <Link to="/logos" className="font-semibold underline underline-offset-2">
              Manage logos
            </Link>
          </p>
        )}
        {products.length > 0 && (
          <ul className="-mx-2 max-h-72 overflow-y-auto">
            {products.map((p) => (
              <li key={p.dudaProductId}>
                <Link
                  to={`/products/${p.dudaProductId}`}
                  className="flex items-center gap-3 px-2 py-1.5 transition-colors duration-[120ms] hover:bg-surface-2"
                >
                  <Thumb src={p.thumbnailUrl} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium text-text">{p.name || "Untitled product"}</span>
                    <span className="block truncate text-label text-muted">
                      {p.sku || "No SKU"}
                      {p.via.length > 0 && ` · ${p.via.join(" · ")}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          {a.url ? (
            <ButtonLink href={a.url} target="_blank" rel="noreferrer" size="sm">
              <ExternalLink size={16} aria-hidden="true" />
              Preview
              <span className="sr-only">(opens in a new tab)</span>
            </ButtonLink>
          ) : (
            <Badge tone="danger">File missing</Badge>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            disabled={blocked}
            aria-describedby={blocked ? `delete-why-${a.id}` : undefined}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete
          </Button>
        </div>
        {blocked && (
          <p id={`delete-why-${a.id}`} className="t-help">
            Can't delete while it is {usage ? reasons.join(" and ") : "in use"}. Remove it there first.
          </p>
        )}
        {deleteError && (
          <p role="alert" className="text-help text-danger">
            {deleteError}
          </p>
        )}
      </div>
    </div>
  );
}

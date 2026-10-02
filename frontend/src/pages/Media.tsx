import { useRef, useState, type FormEvent } from "react";
import { apiFetch, apiJson } from "../lib/api";
import { uploadFile } from "../lib/upload";
import { FilePreview, Input, Pagination, Select, Skeleton, useConfirm } from "../components/ui";
import { UsagePill } from "../components/UsagePill";
import { MEDIA_SORT_OPTIONS, useMediaLibrary, type MediaKind } from "../lib/useMediaLibrary";
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

/**
 * "Used N×" opens the list of products behind it; anything else reads
 * "Unused".
 *
 * `usage` is distinct PRODUCTS reached through a logo, a download or a 3D
 * model. ⚠️ Product gallery images are NOT counted and cannot be: an image is
 * uploaded only to give Duda a URL to fetch, and once Duda re-hosts it the
 * product points at `irp.cdn-website.com` with nothing linking back. So a
 * product photo on a live page reads "Unused" here — the tooltip says so, and
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
  return (
    <span
      className={asset.kind === "image" ? "cursor-help" : undefined}
      title={
        asset.kind === "image"
          ? "Not used by any logo. Product gallery images aren't tracked: Duda keeps its own copy of each one, so deleting this original cannot break a live gallery."
          : undefined
      }
    >
      · Unused
    </span>
  );
}

export default function Media() {
  const confirm = useConfirm();
  const [kind, setKind] = useState<"" | MediaKind>("");
  const lib = useMediaLibrary({ kind: kind || undefined, pageSize: 24 });

  /**
   * Change page and bring the list back into view.
   *
   * The pager sits BELOW the grid, so clicking Next left you at the bottom of
   * a page whose new content had started above you. This returns to the top
   * of the list — the toolbar, so the tab and search you are in stay visible.
   *
   * ⚠️ Only when you have scrolled PAST the toolbar. If it is already on
   * screen there is nothing to return to, and forcing the scroll would push
   * the upload card out of view for no reason. The threshold is the element's
   * own scroll-margin, so the mobile sticky header (which the margin clears)
   * counts as "out of view" too.
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
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
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

  return (
    <>
      <h1 className="text-xl font-semibold text-text">Media Centre</h1>
      <p className="mt-1 text-sm text-muted">
        Reusable library of images and files, stored in Supabase.
      </p>

      {/* Upload */}
      <form
        onSubmit={onUpload}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <label className="text-sm font-semibold text-text">
          File
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-foreground file:transition-colors hover:file:bg-accent-hover"
          />
        </label>
        <label className="text-sm font-semibold text-text">
          Alt text (optional)
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="describe the image"
            className="mt-1 block rounded-md border border-border px-3 py-2 text-sm focus:border-text focus:outline-none placeholder:text-subtle"
          />
        </label>
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-md bg-accent px-4 py-2 text-body font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {uploadError && <span className="text-sm text-danger">{uploadError}</span>}
      </form>

      {/* Kind tabs + search + sort. Also where paging scrolls back to — see goToPage. */}
      <div ref={listTop} className="mt-6 flex scroll-mt-20 flex-wrap items-center gap-3 lg:scroll-mt-4">
        <div className="flex flex-wrap gap-2 text-sm">
          {KIND_TABS.map((t) => (
            <button
              key={t.value || "all"}
              onClick={() => setKind(t.value)}
              className={`rounded-full px-3 py-1 font-semibold ${
                kind === t.value
                  ? "bg-accent text-accent-foreground"
                  : "border border-border text-muted hover:bg-surface-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/*
          Search and sort stay on ONE row: no `flex-wrap` here, and each
          control is sized by its own wrapper.

          ⚠️ The width goes on the WRAPPERS, not on the controls. `cn()` is a
          plain string join rather than tailwind-merge, so a `w-56` passed to
          <Input> lands alongside the component's own `w-full` and the
          stylesheet's ordering decides which wins — which is how the sort
          dropdown ended up wrapping under the search box. Sizing the flex
          items is deterministic; the controls are `w-full` inside them.
        */}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-40 min-w-0 sm:w-56">
            <Input
              type="search"
              value={lib.q}
              onChange={(e) => lib.setQ(e.target.value)}
              placeholder="Search filename or alt text…"
              aria-label="Search media"
            />
          </div>
          <div className="w-44 shrink-0">
            <Select
              value={lib.sort}
              onChange={(e) => lib.setSort(e.target.value as typeof lib.sort)}
              aria-label="Sort media"
            >
              {MEDIA_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* States */}
      {/* The same 2/3/4-up grid and the same 8rem tile as a real asset card,
          so the library does not reflow the page as it arrives. */}
      {/* ⚠️ First load only — see the note on the grid below. */}
      {lib.isInitialLoad && (
        <div
          className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          aria-busy="true"
          aria-live="polite"
          aria-label="Loading media"
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
      {lib.error && (
        <div className="mt-8 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {lib.error}
        </div>
      )}
      {lib.isEmpty && (
        <p className="mt-8 text-muted">
          {lib.isFiltered
            ? "Nothing matches that search."
            : "No media yet. Upload a file to get started."}
        </p>
      )}

      {/*
        * Grid. ⚠️ Rendered while loading too, NOT `!lib.loading && …`. That
        * condition unmounted the whole grid AND the pager on every page click,
        * so the page collapsed and sprang back and the buttons moved out from
        * under the cursor. The current page stays put and dims until the next
        * one lands.
        */}
      {!lib.error && lib.items.length > 0 && (
        <>
          <div
            className={`mt-6 grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-4 ${
              lib.loading ? "pointer-events-none opacity-50" : ""
            }`}
            aria-busy={lib.loading}
          >
            {lib.items.map((a) => (
              <div key={a.id} className="flex flex-col rounded-xl border border-border bg-surface p-3">
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
                  {a.kind === "image" ? (
                    <img
                      src={a.url ?? undefined}
                      alt={a.alt || a.filename}
                      loading="lazy"
                      className="max-h-32 max-w-full object-contain"
                    />
                  ) : (
                    <a
                      href={a.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      title={a.url ? `Open ${a.filename}` : undefined}
                      className="block h-full w-full"
                    >
                      <FilePreview
                        thumbnailUrl={a.thumbnailUrl}
                        filename={a.filename}
                        mimeType={a.mimeType}
                        className="h-full w-full"
                        iconClassName="h-14 w-11"
                      />
                    </a>
                  )}
                </div>

                <div className="mt-2 flex-1">
                  {/* The WHOLE name. Imported filenames carry the product code,
                      range and document type, so truncating them hid exactly
                      the part that tells two files apart. overflow-wrap:anywhere
                      because they have no spaces to break at. */}
                  <p className="text-sm font-semibold text-text [overflow-wrap:anywhere]">{a.filename}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{formatBytes(a.sizeBytes)}</span>
                    <UsageNote asset={a} />
                  </div>
                  {a.alt && <p className="mt-1 truncate text-xs text-subtle">alt: {a.alt}</p>}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {/* A file that could not be signed comes back url: null —
                      say so rather than offering a link that goes nowhere. */}
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border px-2 py-1 text-center text-body font-semibold text-text hover:bg-surface-2"
                    >
                      Preview
                    </a>
                  ) : (
                    <span
                      className="rounded-md border border-danger/30 px-2 py-1 text-center text-body font-semibold text-danger"
                      title="This file could not be found in storage."
                    >
                      File missing
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(a)}
                    className="rounded-md border border-border px-2 py-1 text-body font-semibold text-danger hover:bg-danger/10"
                  >
                    Delete
                  </button>
                </div>
                {deleteErrors[a.id] && <p className="mt-1 text-xs text-danger">{deleteErrors[a.id]}</p>}
              </div>
            ))}
          </div>

          <Pagination
            page={lib.page}
            pageCount={lib.pageCount}
            total={lib.total}
            onChange={goToPage}
            label="assets"
          />
        </>
      )}
    </>
  );
}

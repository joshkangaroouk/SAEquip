import { useRef, useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api";
import { uploadFile } from "../lib/upload";
import { FileIcon, Input, Pagination, Select, useConfirm } from "../components/ui";
import { MEDIA_SORT_OPTIONS, useMediaLibrary, type MediaKind } from "../lib/useMediaLibrary";
import type { MediaAsset } from "../lib/types";

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
 * What `usage` can and cannot tell us.
 *
 * It counts logos, downloads and 3D-model attachments — the three places a
 * Hub URL IS the live reference. Product gallery images are NOT counted and
 * cannot be: an image is uploaded only to give Duda a URL to fetch, and once
 * Duda re-hosts it the product points at `irp.cdn-website.com` with nothing
 * linking back. So "used 0×" on a product photo was actively misleading —
 * it read as "unused" for images that are on live product pages.
 */
function UsageNote({ asset }: { asset: MediaAsset }) {
  if (asset.usage > 0) {
    return <span>· used {asset.usage}×</span>;
  }
  if (asset.kind === "image") {
    return (
      <span
        className="cursor-help underline decoration-dotted"
        title="Product galleries aren't tracked here: Duda re-hosts each image on its own CDN, so nothing links a product back to this original. Logos, downloads and 3D models ARE tracked. Deleting this cannot break a live gallery — Duda holds its own copy."
      >
        · no Hub links
      </span>
    );
  }
  return <span>· unused</span>;
}

export default function Media() {
  const confirm = useConfirm();
  const [kind, setKind] = useState<"" | MediaKind>("");
  const lib = useMediaLibrary({ kind: kind || undefined, pageSize: 24 });

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
      setDeleteErrors((m) => ({ ...m, [id]: `In use by ${j.count ?? "some"} product(s)` }));
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
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {uploadError && <span className="text-sm text-danger">{uploadError}</span>}
      </form>

      {/* Kind tabs + search + sort */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={lib.q}
            onChange={(e) => lib.setQ(e.target.value)}
            placeholder="Search filename or alt text…"
            className="w-56"
            aria-label="Search media"
          />
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

      {/* States */}
      {lib.loading && <p className="mt-8 text-muted">Loading media…</p>}
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

      {/* Grid */}
      {!lib.loading && !lib.error && lib.items.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {lib.items.map((a) => (
              <div key={a.id} className="flex flex-col rounded-xl border border-border bg-surface p-3">
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
                  {a.kind === "image" ? (
                    <img
                      src={a.url}
                      alt={a.alt || a.filename}
                      loading="lazy"
                      className="max-h-32 max-w-full object-contain"
                    />
                  ) : (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center text-muted hover:text-text"
                    >
                      <FileIcon className="h-10 w-10" />
                      <span className="mt-1 text-xs">
                        {a.kind === "model" ? "Open model" : "Open file"}
                      </span>
                    </a>
                  )}
                </div>

                <div className="mt-2 flex-1">
                  <p className="truncate text-sm font-semibold text-text" title={a.filename}>
                    {a.filename}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                    <span>{formatBytes(a.sizeBytes)}</span>
                    <UsageNote asset={a} />
                  </div>
                  {a.alt && <p className="mt-1 truncate text-xs text-subtle">alt: {a.alt}</p>}
                </div>

                <button
                  onClick={() => onDelete(a)}
                  className="mt-2 rounded-md border border-border px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  Delete
                </button>
                {deleteErrors[a.id] && <p className="mt-1 text-xs text-danger">{deleteErrors[a.id]}</p>}
              </div>
            ))}
          </div>

          <Pagination
            page={lib.page}
            pageCount={lib.pageCount}
            total={lib.total}
            onChange={lib.setPage}
            label="assets"
          />
        </>
      )}
    </>
  );
}

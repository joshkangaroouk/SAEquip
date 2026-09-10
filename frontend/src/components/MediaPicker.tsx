import { useRef, useState } from "react";
import { uploadFile } from "../lib/upload";
import { FileIcon, Input, Pagination, Select } from "./ui";
import { MEDIA_SORT_OPTIONS, useMediaLibrary } from "../lib/useMediaLibrary";
import type { MediaAsset } from "../lib/types";

/**
 * Reusable modal to pick an existing MediaAsset (filtered by kind) or upload a
 * new one. On selection it calls onPick with the asset and the caller closes it.
 *
 * ⚠️ Searched and paginated via the same `useMediaLibrary` hook as the Media
 * Centre page, so the two cannot drift. This dialog previously fetched
 * `/api/media?kind=…` unpaginated and rendered every result — 341 images after
 * the WordPress import, each with a resolved URL and an <img> — which made
 * picking one image cost the whole library. 12 per page here rather than the
 * page's 24, because the grid sits inside a max-h-[85vh] dialog.
 */
const KIND_LABEL: Record<"image" | "file" | "model", string> = {
  image: "an image",
  file: "a file",
  model: "a 3D model",
};

export function MediaPicker({
  kind = "image",
  onPick,
  onClose,
}: {
  kind?: "image" | "file" | "model";
  onPick: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const lib = useMediaLibrary({ kind, pageSize: 12 });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      // Straight to Supabase via a signed URL, then confirmed with the API —
      // the file never passes through the backend. See lib/upload.ts.
      onPick(await uploadFile(file));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-text">Choose {KIND_LABEL[kind]}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept={kind === "model" ? ".glb" : kind === "image" ? "image/*" : undefined}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-accent-foreground file:transition-colors hover:file:bg-accent-hover"
            />
            <button
              onClick={onUpload}
              disabled={!file || uploading}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Upload new"}
            </button>
            {uploadError && <span className="text-sm text-danger">{uploadError}</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Or choose existing
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Input
                type="search"
                value={lib.q}
                onChange={(e) => lib.setQ(e.target.value)}
                placeholder="Search…"
                className="w-40"
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

          {lib.loading && <p className="text-sm text-muted">Loading…</p>}
          {lib.error && <p className="text-sm text-danger">{lib.error}</p>}
          {lib.isEmpty && (
            <p className="text-sm text-subtle">
              {lib.isFiltered
                ? "Nothing matches that search."
                : `No ${kind}s in the library yet — upload one above.`}
            </p>
          )}
          {!lib.loading && !lib.error && lib.items.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {lib.items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onPick(a)}
                    className="flex flex-col items-center rounded-lg border border-border p-2 hover:border-text"
                  >
                    {a.kind === "image" ? (
                      <img
                        src={a.url}
                        alt={a.alt || a.filename}
                        loading="lazy"
                        className="h-16 w-full object-contain"
                      />
                    ) : (
                      <span className="flex h-16 items-center">
                        <FileIcon className="h-8 w-8" />
                      </span>
                    )}
                    <span className="mt-1 w-full truncate text-center text-xs text-muted" title={a.filename}>
                      {a.filename}
                    </span>
                  </button>
                ))}
              </div>

              <Pagination
                page={lib.page}
                pageCount={lib.pageCount}
                total={lib.total}
                onChange={lib.setPage}
                label={`${kind}s`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

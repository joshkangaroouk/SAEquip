import { useRef, useState } from "react";
import { uploadFile } from "../lib/upload";
import { Alert, Button, FileInput, FilePreview, ImageWell, Input, Modal, Pagination, Select, Skeleton } from "./ui";
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
 * page's 24, because the grid sits inside a dialog.
 */
const PICKER_PAGE_SIZE = 12;

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
  const lib = useMediaLibrary({ kind, pageSize: PICKER_PAGE_SIZE });
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
    // The shared Modal: focus moves in and is held, Escape and the backdrop
    // close it, and the title names it. Mounted only while open, by its callers.
    <Modal open onClose={onClose} title={`Choose ${KIND_LABEL[kind]}`} size="lg">
      <div className="-mx-6 -mt-5 mb-4 border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <FileInput
            file={file}
            onChange={setFile}
            accept={kind === "model" ? ".glb" : kind === "image" ? "image/*" : undefined}
            inputRef={fileRef}
          />
          <Button size="sm" onClick={onUpload} disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload new"}
          </Button>
          {uploadError && <span className="text-body text-danger">{uploadError}</span>}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="t-overline text-muted">
            Or choose existing
          </p>
          {/* One row — see the note in pages/Media.tsx on why the widths
              sit on the wrappers rather than on the controls. */}
          <div className="ml-auto flex items-center gap-2">
            <div className="w-32 min-w-0 sm:w-40">
              <Input
                type="search"
                value={lib.q}
                onChange={(e) => lib.setQ(e.target.value)}
                placeholder="Search…"
                aria-label="Search media"
              />
            </div>
            <div className="w-40 shrink-0">
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

        {/*
          * ⚠️ Skeletons only on the FIRST load. Paging keeps the current
          * tiles on screen (see below) — swapping them for placeholders is
          * the same flash in a different costume, since the grid still
          * empties and refills.
          */}
        {lib.isInitialLoad && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="Loading media">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex flex-col items-center rounded-lg border border-border p-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        )}
        {lib.error && <Alert tone="danger">{lib.error}</Alert>}
        {lib.isEmpty && (
          <p className="text-body text-muted">
            {lib.isFiltered
              ? "Nothing matches that search."
              : `No ${kind}s in the library yet — upload one above.`}
          </p>
        )}
        {/*
          * ⚠️ Rendered while loading too, NOT `!lib.loading && …`. That
          * condition unmounted the grid on every page click, so the dialog
          * collapsed to the height of a one-line "Loading…" and sprang back.
          * The previous page stays put and just dims until the next lands,
          * so nothing moves.
          */}
        {!lib.error && lib.items.length > 0 && (
          <>
            <div
              className={`grid grid-cols-3 gap-3 transition-opacity sm:grid-cols-4 ${
                lib.loading ? "pointer-events-none opacity-50" : ""
              }`}
              aria-busy={lib.loading}
            >
              {lib.items.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick(a)}
                  className="flex flex-col items-center rounded-lg border border-border p-2 hover:border-text"
                >
                  {a.kind === "image" ? (
                    <ImageWell src={a.url} alt={a.alt || a.filename} className="h-24" />
                  ) : (
                    <FilePreview
                      thumbnailUrl={a.thumbnailUrl}
                      filename={a.filename}
                      mimeType={a.mimeType}
                      className="h-24 w-full rounded"
                    />
                  )}
                  <span className="mt-1 w-full text-center text-label text-muted [overflow-wrap:anywhere]" title={a.filename}>
                    {a.filename}
                  </span>
                </button>
              ))}
            </div>

            <Pagination
              className="mt-5"
              page={lib.page}
              total={lib.total}
              pageSize={PICKER_PAGE_SIZE}
              onPageChange={lib.setPage}
              label={`${kind}s`}
            />
          </>
        )}
      </div>
    </Modal>
  );
}

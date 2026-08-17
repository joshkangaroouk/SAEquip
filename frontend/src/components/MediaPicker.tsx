import { useEffect, useRef, useState } from "react";
import { apiJson, apiUpload } from "../lib/api";
import { FileIcon } from "./ui";
import type { MediaAsset } from "../lib/types";

/**
 * Reusable modal to pick an existing MediaAsset (filtered by kind) or upload a
 * new one. On selection it calls onPick with the asset and the caller closes it.
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
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<MediaAsset[]>(`/api/media?kind=${kind}`)
      .then((d) => {
        if (!cancelled) setAssets(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load media");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  async function onUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload("/api/media", fd);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || json.error || `Upload failed (${res.status})`);
      onPick(json as MediaAsset);
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
            Or choose existing
          </p>
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {!loading && !error && assets && assets.length === 0 && (
            <p className="text-sm text-subtle">No {kind}s in the library yet — upload one above.</p>
          )}
          {!loading && !error && assets && assets.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick(a)}
                  className="flex flex-col items-center rounded-lg border border-border p-2 hover:border-text"
                >
                  {a.kind === "image" ? (
                    <img src={a.url} alt={a.alt || a.filename} className="h-16 w-full object-contain" />
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
          )}
        </div>
      </div>
    </div>
  );
}

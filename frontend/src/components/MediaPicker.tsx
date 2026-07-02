import { useEffect, useRef, useState } from "react";
import { apiFetch, apiUpload } from "../lib/api";
import type { MediaAsset } from "../lib/types";

/**
 * Reusable modal to pick an existing MediaAsset (filtered by kind) or upload a
 * new one. On selection it calls onPick with the asset and the caller closes it.
 */
export function MediaPicker({
  kind = "image",
  onPick,
  onClose,
}: {
  kind?: "image" | "file";
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
    apiFetch(`/api/media?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: MediaAsset[]) => {
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
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Choose {kind === "image" ? "an image" : "a file"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <button
              onClick={onUpload}
              disabled={!file || uploading}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Upload new"}
            </button>
            {uploadError && <span className="text-sm text-red-600">{uploadError}</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
            Or choose existing
          </p>
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && assets && assets.length === 0 && (
            <p className="text-sm text-gray-400">No {kind}s in the library yet — upload one above.</p>
          )}
          {!loading && !error && assets && assets.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick(a)}
                  className="flex flex-col items-center rounded-lg border border-gray-200 p-2 hover:border-gray-900"
                >
                  {a.kind === "image" ? (
                    <img src={a.url} alt={a.alt || a.filename} className="h-16 w-full object-contain" />
                  ) : (
                    <span className="flex h-16 items-center text-2xl">📄</span>
                  )}
                  <span className="mt-1 w-full truncate text-center text-xs text-gray-600" title={a.filename}>
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

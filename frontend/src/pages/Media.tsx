import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch, apiUpload } from "../lib/api";
import type { MediaAsset } from "../lib/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Filter = "" | "image" | "file";

export default function Media() {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("");

  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/media${filter ? `?kind=${filter}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: MediaAsset[]) => {
        if (!cancelled) setAssets(data);
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
  }, [filter]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (alt.trim()) fd.append("alt", alt.trim());
      const res = await apiUpload("/api/media", fd);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.detail || json.error || `Upload failed (${res.status})`);
      }
      // Show newest first; respect the active filter.
      if (!filter || json.kind === filter) {
        setAssets((prev) => [json as MediaAsset, ...(prev ?? [])]);
      }
      setFile(null);
      setAlt("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    setDeleteErrors((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    const res = await apiFetch(`/api/media/${id}`, { method: "DELETE" });
    if (res.status === 204) {
      setAssets((prev) => prev?.filter((a) => a.id !== id) ?? null);
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
      <h1 className="text-xl font-semibold text-gray-900">Media Centre</h1>
        <p className="mt-1 text-sm text-gray-500">
          Reusable library of images and files, stored in Supabase.
        </p>

        {/* Upload */}
        <form
          onSubmit={onUpload}
          className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
        >
          <label className="text-sm font-medium text-gray-700">
            File
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Alt text (optional)
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="describe the image"
              className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!file || uploading}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          {uploadError && <span className="text-sm text-red-600">{uploadError}</span>}
        </form>

        {/* Filter */}
        <div className="mt-6 flex gap-2 text-sm">
          {(["", "image", "file"] as Filter[]).map((f) => (
            <button
              key={f || "all"}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 font-medium ${
                filter === f ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "" ? "All" : f === "image" ? "Images" : "Files"}
            </button>
          ))}
        </div>

        {/* States */}
        {loading && <p className="mt-8 text-gray-500">Loading media…</p>}
        {error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && assets && assets.length === 0 && (
          <p className="mt-8 text-gray-500">No media yet. Upload a file to get started.</p>
        )}

        {/* Grid */}
        {!loading && !error && assets && assets.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((a) => (
              <div key={a.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                  {a.kind === "image" ? (
                    <img src={a.url} alt={a.alt || a.filename} className="max-h-32 max-w-full object-contain" />
                  ) : (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center text-gray-500 hover:text-gray-900"
                    >
                      <span className="text-3xl">📄</span>
                      <span className="mt-1 text-xs">Open file</span>
                    </a>
                  )}
                </div>

                <div className="mt-2 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900" title={a.filename}>
                    {a.filename}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5">{a.kind}</span>
                    <span>{formatBytes(a.sizeBytes)}</span>
                    <span>· used {a.usage}×</span>
                  </div>
                  {a.alt && <p className="mt-1 truncate text-xs text-gray-400">alt: {a.alt}</p>}
                </div>

                <button
                  onClick={() => onDelete(a.id)}
                  className="mt-2 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
                {deleteErrors[a.id] && (
                  <p className="mt-1 text-xs text-amber-700">{deleteErrors[a.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}
    </>
  );
}

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
              className="mt-1 block text-sm"
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

        {/* Filter */}
        <div className="mt-6 flex gap-2 text-sm">
          {(["", "image", "file"] as Filter[]).map((f) => (
            <button
              key={f || "all"}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 font-semibold ${
                filter === f ? "bg-accent text-accent-foreground" : "border border-border text-muted hover:bg-surface-2"
              }`}
            >
              {f === "" ? "All" : f === "image" ? "Images" : "Files"}
            </button>
          ))}
        </div>

        {/* States */}
        {loading && <p className="mt-8 text-muted">Loading media…</p>}
        {error && (
          <div className="mt-8 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {!loading && !error && assets && assets.length === 0 && (
          <p className="mt-8 text-muted">No media yet. Upload a file to get started.</p>
        )}

        {/* Grid */}
        {!loading && !error && assets && assets.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((a) => (
              <div key={a.id} className="flex flex-col rounded-xl border border-border bg-surface p-3">
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
                  {a.kind === "image" ? (
                    <img src={a.url} alt={a.alt || a.filename} className="max-h-32 max-w-full object-contain" />
                  ) : (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center text-muted hover:text-text"
                    >
                      <span className="text-3xl">📄</span>
                      <span className="mt-1 text-xs">Open file</span>
                    </a>
                  )}
                </div>

                <div className="mt-2 flex-1">
                  <p className="truncate text-sm font-semibold text-text" title={a.filename}>
                    {a.filename}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5">{a.kind}</span>
                    <span>{formatBytes(a.sizeBytes)}</span>
                    <span>· used {a.usage}×</span>
                  </div>
                  {a.alt && <p className="mt-1 truncate text-xs text-subtle">alt: {a.alt}</p>}
                </div>

                <button
                  onClick={() => onDelete(a.id)}
                  className="mt-2 rounded-md border border-border px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  Delete
                </button>
                {deleteErrors[a.id] && (
                  <p className="mt-1 text-xs text-danger">{deleteErrors[a.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}
    </>
  );
}

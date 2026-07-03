import { useCallback, useState } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { supabase } from "../../lib/supabase";
import { API_BASE } from "../../lib/api";
import { cn } from "../../lib/cn";
import { toast } from "./Toast";

interface UploadItem {
  id: string;
  name: string;
  progress: number; // 0–100
  status: "uploading" | "done" | "error";
  error?: string;
}

export interface FileDropzoneProps {
  /** Endpoint each file is POSTed to (multipart, field "file"). Path or absolute URL. */
  uploadUrl: string;
  /** Called once per successfully-uploaded file with the parsed response. */
  onUploaded?: (asset: any) => void;
  /** Restrict accepted types, e.g. { "image/*": [] }. */
  accept?: Accept;
  multiple?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}

/** Resolve a path against the API base; leave absolute URLs untouched. */
function resolveUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${API_BASE}${url}`;
}

/**
 * Drag-and-drop uploader. Each file uploads independently via XMLHttpRequest so
 * we can show a per-file yellow progress bar. Fires success/error toasts and
 * calls onUploaded(asset) for each completed upload.
 */
export function FileDropzone({
  uploadUrl,
  onUploaded,
  accept,
  multiple = true,
  label = "Drop files here or click to browse",
  hint,
  className,
}: FileDropzoneProps) {
  const [items, setItems] = useState<UploadItem[]>([]);

  const uploadOne = useCallback(
    async (file: File, id: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const form = new FormData();
      form.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", resolveUrl(uploadUrl));
      if (session?.access_token) {
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const progress = Math.round((e.loaded / e.total) * 100);
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress } : it)));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let asset: any = null;
          try {
            asset = JSON.parse(xhr.responseText);
          } catch {
            /* non-JSON success — ignore */
          }
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, progress: 100, status: "done" } : it)),
          );
          toast.success(`Uploaded ${file.name}`);
          if (asset) onUploaded?.(asset);
        } else {
          let detail = `HTTP ${xhr.status}`;
          try {
            const body = JSON.parse(xhr.responseText);
            detail = body.detail || body.error || detail;
          } catch {
            /* keep default */
          }
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, status: "error", error: detail } : it)),
          );
          toast.error(`Failed to upload ${file.name}: ${detail}`);
        }
      };

      xhr.onerror = () => {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, status: "error", error: "Network error" } : it,
          ),
        );
        toast.error(`Failed to upload ${file.name}`);
      };

      xhr.send(form);
    },
    [uploadUrl, onUploaded],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const next = accepted.map((file, i) => ({
        // No Math.random / Date.now dependency: index + name + size is unique enough per drop.
        id: `${file.name}-${file.size}-${i}-${file.lastModified}`,
        name: file.name,
        progress: 0,
        status: "uploading" as const,
      }));
      setItems((prev) => [...prev, ...next]);
      accepted.forEach((file, i) => uploadOne(file, next[i].id));
    },
    [uploadOne],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept, multiple });

  return (
    <div className={cn("space-y-3", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-10 text-center transition-colors",
          isDragActive
            ? "border-accent bg-accent/10 text-text"
            : "border-border bg-surface text-muted hover:border-subtle",
        )}
      >
        <input {...getInputProps()} />
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mb-3 text-subtle">
          <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <p className="text-body font-semibold text-text">{label}</p>
        {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="bg-surface border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-small">
                <span className="truncate text-text">{it.name}</span>
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    it.status === "error"
                      ? "text-danger"
                      : it.status === "done"
                        ? "text-success"
                        : "text-muted",
                  )}
                >
                  {it.status === "error" ? it.error : `${it.progress}%`}
                </span>
              </div>
              <div className="mt-2 h-1 w-full bg-surface-2">
                <div
                  className={cn(
                    "h-full transition-all",
                    it.status === "error" ? "bg-danger" : "bg-accent",
                  )}
                  style={{ width: `${it.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

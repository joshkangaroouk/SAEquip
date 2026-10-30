import { useCallback, useRef, useState } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { uploadFile } from "../../lib/upload";
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
  /** Called once per successfully-uploaded file with the created MediaAsset. */
  onUploaded?: (asset: any) => void;
  /** Restrict accepted types, e.g. { "image/*": [] }. */
  accept?: Accept;
  multiple?: boolean;
  label?: string;
  hint?: string;
  className?: string;
  /**
   * The upload itself — the real browser → Supabase upload by default. The UI
   * kit passes a local stand-in so dropping a file there uploads nothing.
   */
  upload?: typeof uploadFile;
}

/**
 * Drag-and-drop uploader. Each file uploads independently, with a per-file
 * progress bar. Fires success/error toasts and calls onUploaded(asset) for
 * each completed upload.
 *
 * The bytes go browser → Supabase directly and never through the API; see
 * `lib/upload.ts` for why (a serverless request body caps at 4.5MB, and a
 * model can be up to 50MB).
 */
export function FileDropzone({
  onUploaded,
  accept,
  multiple = true,
  label = "Drop files here or click to browse",
  hint,
  className,
  upload = uploadFile,
}: FileDropzoneProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  // An upload finishes after later renders, so it calls the CURRENT handler,
  // not the one captured when the file was dropped.
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const uploadOne = useCallback(
    async (file: File, id: string) => {
      try {
        const asset = await upload(file, {
          onProgress: (progress) =>
            setItems((prev) => prev.map((it) => (it.id === id ? { ...it, progress } : it))),
        });
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, progress: 100, status: "done" } : it)),
        );
        toast.success(`Uploaded ${file.name}`);
        onUploadedRef.current?.(asset);
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Upload failed";
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "error", error: detail } : it)),
        );
        toast.error(`Failed to upload ${file.name}: ${detail}`);
      }
    },
    [upload],
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
          "flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-10 text-center",
          "transition-colors duration-[120ms]",
          isDragActive
            ? "border-accent bg-accent/10 text-text"
            : "border-border-strong bg-surface text-muted hover:border-text",
        )}
      >
        <input {...getInputProps()} />
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mb-3 text-muted">
          <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <p className="text-body font-semibold text-text">{label}</p>
        {hint && <p className="t-help mt-1">{hint}</p>}
      </div>

      {items.length > 0 && (
        // Announced as files finish or fail.
        <ul className="space-y-2" aria-live="polite">
          {items.map((it) => (
            <li key={it.id} className="border border-border bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-help">
                <span className="truncate text-text">{it.name}</span>
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    it.status === "error"
                      ? "text-danger"
                      : it.status === "done"
                        ? "text-ok"
                        : "text-muted",
                  )}
                >
                  {it.status === "error" ? it.error : `${it.progress}%`}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden bg-surface-2">
                <div
                  className={cn(
                    "h-full transition-[width] duration-[120ms]",
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

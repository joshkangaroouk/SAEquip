import { cn } from "../../lib/cn";

/** Generic document icon — default thumbnail for a non-image file/download. */
export function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("h-7 w-7 shrink-0 text-subtle", className)} aria-hidden="true">
      <path
        d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v4a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

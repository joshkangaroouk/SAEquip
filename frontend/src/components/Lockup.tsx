import { cn } from "../lib/cn";

/**
 * The SA lockup in HTML rather than an image (02a Q6, Q15): a 40px yellow
 * block with "SA", then "SA Equip" over "Product Hub". `sidebar` sets the
 * words on the fixed dark sidebar tokens; `light` on the main panel's, for the
 * light-only sign-in pages.
 */
export function Lockup({ tone = "sidebar" }: { tone?: "sidebar" | "light" }) {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="t-lockup-mark flex h-10 w-10 shrink-0 items-center justify-center bg-sidebar-active text-sidebar-active-ink"
      >
        SA
      </span>
      <span className="min-w-0">
        <span className={cn("t-lockup-name block", tone === "sidebar" ? "text-sidebar-fg" : "text-text")}>SA Equip</span>
        <span className={cn("block text-label", tone === "sidebar" ? "text-sidebar-muted" : "text-muted")}>
          Product Hub
        </span>
      </span>
    </span>
  );
}

import { cn } from "../../lib/cn";

/**
 * Chip tones (00 "Chips", 02a Q2/Q9):
 * - `neutral` — Hidden, Off, counts: --muted on --chip-bg, 1px --border.
 * - `ok` — Live: --ok on --ok-bg, with a 7px square dot. (`success` is the
 *   old name for the same tone.)
 * - `solid` — --surface on --text: a strong label that is not a status
 *   (image "Primary", "Duda editor").
 * - `new` — yellow, Barlow 11 uppercase: "New" only. Yellow is for the
 *   active or primary thing, so nothing else uses it.
 * - `warning` — near-limit warnings: --warning on --warning-bg.
 * - `danger` — real faults ("File missing", "No longer in Duda"): --danger
 *   text on --chip-bg with a 1px --danger border.
 */
type Tone = "neutral" | "ok" | "success" | "solid" | "new" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-border bg-chip text-muted",
  ok: "border-transparent bg-ok-bg text-ok",
  success: "border-transparent bg-ok-bg text-ok",
  solid: "border-text bg-text text-surface",
  new: "border-accent bg-accent font-heading text-micro font-semibold uppercase text-accent-ink",
  warning: "border-transparent bg-warning-bg text-warning",
  danger: "border-danger bg-chip text-danger",
};

/**
 * Chip: 26px high, padding 0 10, 13px, square. Metadata, never a control —
 * wrap it in a button if it must be clickable.
 *
 * `dot`: the ok tone always shows its 7px square dot. `"unsaved"` adds the 8px
 * --text dot with a 1.5px --surface ring that reads on yellow and white
 * (02a Q8/Q9); `"error"` an 8px --danger one. The dot is decorative: the
 * state is in the chip's text.
 */
export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: "unsaved" | "error";
  className?: string;
  children: React.ReactNode;
}) {
  const ok = tone === "ok" || tone === "success";
  return (
    <span
      className={cn(
        "inline-flex h-6.5 w-fit shrink-0 items-center gap-1.5 border px-2.5 text-help font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {ok && <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 bg-current" />}
      {dot === "unsaved" && (
        <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-text outline outline-[1.5px] outline-surface" />
      )}
      {dot === "error" && <span aria-hidden="true" className="h-2 w-2 shrink-0 bg-danger" />}
      {children}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Live",
  HIDDEN: "Hidden",
  IN_STOCK: "In stock",
  OUT_OF_STOCK: "Out of stock",
};

/** A Duda product or stock status as a chip: ACTIVE → "Live" (ok), HIDDEN → "Hidden" (neutral). */
export function StatusBadge({ status }: { status: string }) {
  const live = status === "ACTIVE" || status === "IN_STOCK";
  const label = STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return <Badge tone={live ? "ok" : "neutral"}>{label}</Badge>;
}

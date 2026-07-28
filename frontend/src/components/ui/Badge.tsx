import { cn } from "../../lib/cn";

type Tone = "neutral" | "accent" | "success" | "danger";

// shadcn badges are quiet: a tinted fill with a matching hairline border and
// coloured text, rather than a saturated solid block. They read as metadata
// instead of competing with buttons for attention. Accent stays solid because
// yellow at 10% is invisible.
const tones: Record<Tone, string> = {
  neutral: "border-border bg-surface-2 text-muted",
  accent: "border-accent bg-accent text-accent-foreground",
  success: "border-success/25 bg-success/10 text-success",
  danger: "border-danger/25 bg-danger/10 text-danger",
};

/** Compact, solid-colour status pill. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        // rounded-md not full, and no hover — a badge isn't interactive.
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5",
        "text-xs font-medium leading-normal whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Status badge mapping product states to a tone. Replaces the old pill. */
export function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE" || status === "IN_STOCK";
  return <Badge tone={active ? "success" : "neutral"}>{status}</Badge>;
}

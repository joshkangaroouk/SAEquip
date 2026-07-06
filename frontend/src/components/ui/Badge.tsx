import { cn } from "../../lib/cn";

type Tone = "neutral" | "accent" | "success" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  accent: "bg-accent/15 text-accent border-accent/40",
  success: "bg-success/15 text-success border-success/40",
  danger: "bg-danger/15 text-danger border-danger/40",
};

/** Rounded status pill. */
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
        "inline-flex items-center rounded-full border px-2 py-0.5 text-small font-semibold uppercase tracking-wide",
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

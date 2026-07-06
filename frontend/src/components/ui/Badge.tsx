import { cn } from "../../lib/cn";

type Tone = "neutral" | "accent" | "success" | "danger";

// Solid backgrounds with white text (accent is the one exception — yellow is
// too light for white text to stay legible, so it keeps black text, matching
// the primary Button variant). Hover darkens the same solid colour.
const tones: Record<Tone, string> = {
  neutral: "bg-muted text-white",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success text-white",
  danger: "bg-danger text-white",
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        "transition hover:brightness-90",
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

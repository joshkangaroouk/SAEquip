import { cn } from "../../lib/cn";

/**
 * A placeholder block for content that has not arrived.
 *
 * ⚠️ A skeleton only earns its place if it occupies the SAME space the real
 * thing will. The whole point is that nothing moves when the data lands, so a
 * differently-sized placeholder is worse than "Loading…" text — it shifts the
 * page as well as delaying it. Size these against the real row.
 *
 * Deliberately just the primitive: each page composes its own out of the same
 * table and layout components the real content uses, so the two cannot drift.
 * A generic "table skeleton" would have to be told the column widths anyway,
 * and would then be a second place to keep them right.
 *
 * `aria-hidden` because the "loading" announcement belongs once on the
 * container, not on every grey rectangle.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden="true" />;
}

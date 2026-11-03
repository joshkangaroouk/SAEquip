import { cn } from "../../lib/cn";

/**
 * A placeholder block for content that has not arrived.
 *
 * ⚠️ A skeleton only earns its place if it occupies the SAME space the real
 * thing will. The whole point is that nothing moves when the data lands, so a
 * differently-sized placeholder is worse than "Loading…" text — it shifts the
 * page as well as delaying it. Size these against the real row.
 *
 * Deliberately just primitives (this, SkeletonLine, SkeletonField): each page
 * composes its own out of the same table and layout components the real
 * content uses, so the two cannot drift.
 * A generic "table skeleton" would have to be told the column widths anyway,
 * and would then be a second place to keep them right.
 *
 * `aria-hidden` because the "loading" announcement belongs once on the
 * container, not on every grey rectangle.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-surface-2 motion-reduce:animate-none", className)} aria-hidden="true" />;
}

/**
 * A bar on the line box of a type role (`t-help`, `t-label`, `t-section`…):
 * the row is exactly as tall as a line of that text whatever the bar's
 * width, so a skeleton line takes the space its text will. Pass the role as
 * `text`, plus any spacing; the bar's width (and height, as `h-[…em]`) in
 * `className`.
 */
export function SkeletonLine({ text, className }: { text: string; className?: string }) {
  return (
    <div className={text} aria-hidden="true">
      <Skeleton className={cn("inline-block h-[0.75em] align-middle", className)} />
    </div>
  );
}

/**
 * A Field's placeholder: the label, the control (34px, full width, unless
 * `control` says otherwise), and the hint when the real field has one.
 *
 * The label and the hint are static copy, not data, so pass their real text
 * and they show as themselves (and wrap where the real ones will); without
 * it each is a bar on its line.
 *
 * `textarea`: a textarea is inline-block, so it sits on a line box with the
 * descender's few px below it; the block does the same, or every textarea
 * field would come out short.
 */
export function SkeletonField({
  label,
  control = "h-8.5 w-full",
  hint,
  textarea,
}: {
  label?: string;
  control?: string;
  hint?: boolean | string;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {label ? <p className="t-label">{label}</p> : <SkeletonLine text="t-label" className="h-[0.8em] w-16" />}
      {textarea ? (
        <div>
          <Skeleton className={cn("inline-block align-baseline", control)} />
        </div>
      ) : (
        <Skeleton className={control} />
      )}
      {typeof hint === "string" ? (
        <p className="t-help">{hint}</p>
      ) : (
        hint && <SkeletonLine text="t-help" className="h-[0.7em] w-56 max-w-full" />
      )}
    </div>
  );
}

import { cn } from "../../lib/cn";

/**
 * The page's header (00 "Page header"): the H1 (Barlow 36/700), a one-line
 * muted description underneath, and the page's actions on the right with the
 * primary action last. `overline` is an optional group label above the title.
 *
 * Full-bleed on --surface with its own padding arrives with the new shell
 * (batch 4); until then it sits in the page column above a bottom border.
 */
export function PageHeader({
  title,
  description,
  actions,
  overline,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  overline?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        {overline && <p className="t-overline">{overline}</p>}
        <h1 className="t-h1 text-text">{title}</h1>
        {description && <p className="text-body text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

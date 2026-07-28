import { cn } from "../../lib/cn";

/** Surface panel with a hairline border. Rounded corners, generous padding. */
export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface p-5 shadow-xs", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Optional header row for a Card: title (+ description) with right-aligned actions. */
export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="space-y-1">
        <h3 className="text-h3 font-semibold text-text">{title}</h3>
        {description && <p className="text-small text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

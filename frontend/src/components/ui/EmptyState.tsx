import { cn } from "../../lib/cn";

/**
 * Centred empty-state block: optional icon, title, description, action.
 * Square, a dashed --border on --surface; the title is the design's
 * empty-state title (Inter 16/600, 02a Q7). `as` sets the heading level so a
 * page's outline stays in order (10 §6): h2 under a page title, the default;
 * h3 inside a card or editor section that has its own h2.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  as: Heading = "h2",
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h2" | "h3" | "h4";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-dashed border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {icon && <div className="mb-3 text-muted [&_svg]:h-6 [&_svg]:w-6">{icon}</div>}
      <Heading className="t-empty-title text-text">{title}</Heading>
      {description && <p className="t-help mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

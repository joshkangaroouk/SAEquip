import { cn } from "../../lib/cn";

/** Centred empty-state block: optional icon, title, description, action. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border",
        "bg-surface/50 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && <div className="mb-4 text-3xl text-subtle">{icon}</div>}
      <h3 className="text-h3 font-semibold text-text">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-body text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

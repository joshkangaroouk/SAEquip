import { createContext, useContext } from "react";
import { cn } from "../../lib/cn";

/**
 * True inside an AccordionCard body.
 *
 * ⚠️ Why context rather than a prop: every editor section renders its own
 * Card + CardHeader, so putting them inside an accordion would draw a card in
 * a card and print the title twice. The alternative was threading a `bare`
 * prop through eight section components that have nothing else in common —
 * eight signatures changed to say one thing about their surroundings. The
 * accordion already knows; this lets it tell them.
 */
const InAccordion = createContext(false);

export function AccordionBodyProvider({ children }: { children: React.ReactNode }) {
  return <InAccordion.Provider value={true}>{children}</InAccordion.Provider>;
}

/** Surface panel with a hairline border. Rounded corners, generous padding. */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  const bare = useContext(InAccordion);
  return (
    <div
      className={cn(
        // Inside an accordion the chrome belongs to the accordion, so this
        // collapses to a plain wrapper and keeps only a caller's own classes.
        bare ? "" : "rounded-xl border border-border bg-surface p-5 shadow-xs",
        className,
      )}
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
  const bare = useContext(InAccordion);

  // The accordion's own header already shows the title, the dirty badge and a
  // summary, so repeating them here would be noise. Actions can carry real
  // controls, so they stay.
  if (bare) {
    if (!description && !actions) return null;
    return (
      <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
        {description ? <p className="text-small text-muted">{description}</p> : <span />}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    );
  }

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

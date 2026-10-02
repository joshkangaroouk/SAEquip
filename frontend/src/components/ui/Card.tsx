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

/**
 * Surface panel with a hairline border. Rounded corners, generous padding.
 *
 * ⚠️ Use `padded={false}` for flush content — NOT `className="p-0"`. `cn()` is
 * a plain string JOIN, not tailwind-merge, so `p-0` lands in the list beside
 * this component's own `p-5` and loses on stylesheet order. That silently left
 * 20px wrapping a table on three pages and read as a box inside a box. The
 * same trap has cost `w-56` on an Input and `p-0` on AccordionCard; a real
 * prop is the only form that cannot lose.
 */
export function Card({
  className,
  children,
  padded = true,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  const bare = useContext(InAccordion);
  return (
    <div
      className={cn(
        // Inside an accordion the chrome belongs to the accordion, so this
        // collapses to a plain wrapper and keeps only a caller's own classes.
        bare ? "" : "rounded-xl border border-border bg-surface shadow-xs",
        // overflow-hidden so flush content cannot square off the rounded
        // corners it now sits against.
        bare ? "" : padded ? "p-5" : "overflow-hidden",
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

  /*
   * Inside an accordion, only ACTIONS survive.
   *
   * The accordion header already carries the title, the dirty badge, a summary
   * and the description, so a section's own header repeated all of it — the
   * same sentence twice, each with its own bottom margin. That duplication,
   * not the container, was most of the "padding" around accordion content.
   * Actions stay because they can be real controls rather than decoration.
   */
  if (bare) {
    if (!actions) return null;
    return (
      <div className={cn("mb-3 flex flex-wrap items-center justify-end gap-2", className)}>
        {actions}
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

/**
 * A section's error message — the ONE error box every editor section uses.
 *
 * ⚠️ Renders nothing inside an accordion body, because the accordion prints the
 * same message itself, at the top of the body. Each section used to carry its
 * own copy of this box AND be wrapped in an accordion that carried another, so
 * every failing section showed the sentence twice, one box above the other.
 * The accordion keeps it rather than the section: it is the one place that
 * exists for every section, including those that render no box of their own.
 */
export function SectionError({ message }: { message?: string | null }) {
  const bare = useContext(InAccordion);
  if (!message || bare) return null;
  return (
    <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
      {message}
    </div>
  );
}

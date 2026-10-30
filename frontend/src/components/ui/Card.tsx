import { createContext, useContext } from "react";
import { cn } from "../../lib/cn";
import { Alert } from "./Alert";
import { useInAccordionBody } from "./AccordionBody";

// The accordion-body context lives in AccordionBody.tsx; re-exported for existing imports.
export { AccordionBodyProvider } from "./AccordionBody";

/** True inside a padded Card, so a CardHeader can run edge to edge as its own row. */
const InPaddedCard = createContext(false);

/**
 * Surface panel: --surface, a 1px --border, square, no shadow (00 "Card").
 *
 * ⚠️ Use `padded={false}` for flush content — not `className="p-0"`. A prop
 * says what the content is; a class only says what it should look like.
 */
export function Card({
  className,
  children,
  padded = true,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  const bare = useInAccordionBody();
  return (
    <div
      className={cn(
        // Inside an accordion the chrome belongs to the accordion, so this
        // collapses to a plain wrapper and keeps only a caller's own classes.
        bare ? "" : "border border-border bg-surface",
        bare ? "" : padded ? "p-5" : "overflow-hidden",
        className,
      )}
      {...rest}
    >
      <InPaddedCard.Provider value={!bare && padded}>{children}</InPaddedCard.Provider>
    </div>
  );
}

/**
 * The card's header row (00): the title as the section heading (Barlow
 * 14/600 uppercase .09em), an optional muted description, and actions on the
 * right.
 *
 * As the first child of a padded Card it runs edge to edge with padding 16 20
 * and a bottom border — the design's header row — without every caller
 * restructuring into header and body. (Checked: every CardHeader in the app
 * is the first child of a padded Card.)
 */
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
  const bare = useInAccordionBody();
  const row = useContext(InPaddedCard);

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
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        row ? "-mx-5 -mt-5 mb-5 border-b border-border px-5 py-4" : "mb-4",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="t-section text-text">{title}</h3>
        {description && <p className="t-help">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A section's error message — the ONE error box every editor section uses: a
 * danger `Alert` (role="alert").
 *
 * ⚠️ Renders nothing inside an accordion body, because the accordion prints the
 * same message itself, at the top of the body. Each section used to carry its
 * own copy of this box AND be wrapped in an accordion that carried another, so
 * every failing section showed the sentence twice, one box above the other.
 * The accordion keeps it rather than the section: it is the one place that
 * exists for every section, including those that render no box of their own.
 */
export function SectionError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert tone="danger" section className="mb-3">
      {message}
    </Alert>
  );
}

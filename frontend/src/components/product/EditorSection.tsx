import { useId, type ReactNode } from "react";
import { AccordionBodyProvider, SectionError } from "../ui";

/**
 * One section of the product editor inside a tab panel: a card with the
 * section's heading (the card heading role), a short description, optional
 * header actions, its error, and the section itself.
 *
 * It replaced the collapsible accordion cards when the editor moved to tabs
 * (02a "Batch 8"): tabs now do the hiding. It wraps the section in
 * AccordionBodyProvider, so the section's own Card, CardHeader title and
 * SectionError stay silent and nothing is drawn twice. Its error shows here,
 * at the top of the body, once.
 *
 * The dirty state is NOT shown here: the tab's dot and the save bar carry it.
 */
export function EditorSection({
  id,
  title,
  description,
  actions,
  error,
  children,
}: {
  /** For a section with no Card of its own to carry its `section-*` anchor. */
  id?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    // tabIndex -1: the save bar's failed pills move focus here (focus() needs
    // a focusable element); scroll-mt clears the sticky top bar.
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="scroll-mt-20 border border-border bg-surface"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-1">
          <h2 id={headingId} className="t-section text-text">
            {title}
          </h2>
          {description && <p className="t-help">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="px-5 py-4">
        {/* Outside the provider, so this one renders; the copies the sections
            carry stay silent inside it. */}
        <SectionError message={error ?? undefined} />
        <AccordionBodyProvider>{children}</AccordionBodyProvider>
      </div>
    </section>
  );
}

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";

/**
 * Where the shell wants the page header: an element directly under the top
 * bar, spanning the main column (Layout provides it). `full` drops the
 * max-w-6xl column, as on the split-view pages.
 */
interface Slot {
  el: HTMLElement | null;
  full: boolean;
}
const SlotContext = createContext<Slot | null>(null);

export function PageHeaderSlot({ value, children }: { value: Slot; children: ReactNode }) {
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/**
 * The page's header (00 "Page header"): a band on --surface with a bottom
 * rule, padding 32 40 28, under the top bar — the H1 (Barlow 36/700), a
 * one-line muted description, and the page's actions on the right with the
 * primary action last. `overline` is an optional label above the title.
 *
 * A page renders it first, wherever it likes; inside the shell it is drawn in
 * the slot under the top bar (a portal), so the band spans the whole main
 * column while its content lines up with the page's. Outside the shell (the
 * /ui kit) it renders in place.
 */
export function PageHeader({
  title,
  description,
  actions,
  overline,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  overline?: ReactNode;
  className?: string;
}) {
  const slot = useContext(SlotContext);
  const band = (
    <div className={cn("border-b border-border bg-surface", className)}>
      <div
        className={cn(
          "flex flex-col gap-4 px-5 pb-5 pt-6 sm:flex-row sm:items-end sm:justify-between lg:px-10 lg:pb-7 lg:pt-8",
          !slot?.full && "mx-auto max-w-6xl",
        )}
      >
        <div className="min-w-0 space-y-2">
          {overline && <p className="t-overline">{overline}</p>}
          <h1 className="t-h1 text-text">{title}</h1>
          {description && <p className="text-body text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
  if (!slot) return band;
  // The slot's element is attached in the same commit as the page; until it
  // is (the first render), nothing — the next render, before paint, portals.
  return slot.el ? createPortal(band, slot.el) : null;
}

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge } from "./Badge";
import { AccordionBodyProvider, Card } from "./Card";

/**
 * A Card whose body collapses.
 *
 * ⚠️ Opens itself when the section becomes dirty or reports an error, and will
 * not let you collapse away an error. An editor that can hide an unsaved or
 * failed section is how you lose work: the save bar says something is wrong
 * and the section saying it is folded out of sight.
 *
 * The body is UNMOUNTED when closed rather than hidden. These bodies are not
 * cheap — the compatible picker fetches the whole catalogue, the 3D section
 * mounts a model-viewer — and a product page with twelve of them open at once
 * is the thing this change exists to avoid.
 */
export function AccordionCard({
  id,
  title,
  description,
  summary,
  dirty = false,
  error,
  defaultOpen = false,
  flush = false,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  /** A short right-aligned hint — "6 rows", "2 selected". */
  summary?: ReactNode;
  dirty?: boolean;
  error?: string;
  defaultOpen?: boolean;
  /**
   * Drop the body's own padding.
   *
   * For content sections whose inner layout is a table or a full-width list —
   * those read better edge to edge, and the container's inset only added a
   * second margin on top of the one the section already has.
   */
  flush?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  // Only force it open on the TRANSITION into dirty/error — otherwise the
  // section could never be collapsed again while it stayed dirty.
  const wasFlagged = useRef(dirty || !!error);
  useEffect(() => {
    const flagged = dirty || !!error;
    if (flagged && !wasFlagged.current) setOpen(true);
    wasFlagged.current = flagged;
  }, [dirty, error]);

  return (
    <Card id={id} className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className={cn(
            "shrink-0 text-muted transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold text-text">{title}</span>
          {/* Shown here whether open or closed — it used to move into the body
              on open, which put it next to the section's own copy of the same
              sentence. */}
          {description && (
            <span className="mt-0.5 block truncate text-small text-muted">{description}</span>
          )}
        </span>
        {summary != null && <span className="shrink-0 text-xs text-subtle">{summary}</span>}
        {error ? <Badge tone="danger">Error</Badge> : dirty ? <Badge tone="accent">Unsaved</Badge> : null}
      </button>

      {open && (
        <div id={bodyId} className={cn("border-t border-border", flush ? "" : "px-5 py-4")}>
          {error && (
            <div className={cn(
              "rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger",
              flush ? "m-4 mb-0" : "mb-3",
            )}>
              {error}
            </div>
          )}
          {/* Tells any nested Card/CardHeader to drop its own chrome. */}
          <AccordionBodyProvider>{children}</AccordionBodyProvider>
        </div>
      )}
    </Card>
  );
}

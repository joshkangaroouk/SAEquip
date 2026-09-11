import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge } from "./Badge";
import { AccordionBodyProvider } from "./Card";

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
    /*
     * ⚠️ Its own container, NOT <Card className="p-0">.
     *
     * `cn()` is a plain string join rather than tailwind-merge, so `p-0`
     * landed in the class list ALONGSIDE Card's own `p-5` and lost on
     * stylesheet order — leaving 22px of padding wrapping the whole
     * accordion, header included. Same trap as `w-56` on an Input and the
     * `hidden` attribute beside a `flex` utility. Declaring the chrome here
     * means there is nothing to override.
     */
    <div id={id} className="rounded-xl border border-border bg-surface shadow-xs">
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
        <div id={bodyId} className="border-t border-border px-5 py-4">
          {error && (
            <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
              {error}
            </div>
          )}
          {/* Tells any nested Card/CardHeader to drop its own chrome. */}
          <AccordionBodyProvider>{children}</AccordionBodyProvider>
        </div>
      )}
    </div>
  );
}

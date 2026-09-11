import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/cn";

export interface MenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Shown as a tooltip — useful for explaining why something is disabled. */
  title?: string;
}

/** Breathing room between the trigger and the menu, and from the viewport edge. */
const GAP = 4;
const EDGE = 8;

/**
 * The row-level "⋯" menu used by the catalog tables.
 *
 * Deliberately lightweight rather than a headless-UI dependency: closes on
 * outside click, Escape, scroll and resize.
 *
 * ⚠️ Rendered in a PORTAL on <body>, positioned `fixed` from the trigger's
 * bounding rect. It used to be an absolutely-positioned sibling, which any
 * ancestor with `overflow` clips — the categories table scrolls, so the menu
 * was cut off at the table's edge with its lower items unreachable. No amount
 * of z-index fixes that; only leaving the clipping context does.
 *
 * It also flips above the trigger when there is not room below, which is the
 * other half of the same problem: the last row of a table has nowhere to open
 * downwards.
 */
export function DropdownMenu({
  actions,
  label = "More actions",
  className,
}: {
  actions: MenuAction[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  /**
   * Two-pass placement: the portal mounts as soon as `open`, so by the time
   * this runs the menu is in the DOM and can be MEASURED rather than guessed
   * at from item count and padding. It stays hidden until `pos` exists, and
   * measuring happens in a LAYOUT effect, so the placement lands before paint
   * — it is never visible in the wrong place.
   */
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const w = wrap.current;
    const m = menu.current;
    if (!w || !m) return;
    const r = w.getBoundingClientRect();
    const { offsetHeight: h, offsetWidth: mw } = m;
    // Flip above only when it genuinely does not fit below AND does fit above
    // — the last row of a long table has nowhere to open downwards.
    const flip = r.bottom + GAP + h > window.innerHeight && r.top - GAP - h >= 0;
    const right = window.innerWidth - r.right;
    setPos({
      top: flip ? r.top - h - GAP : r.bottom + GAP,
      // Clamped so a narrow viewport can't push the menu off the left edge.
      right: Math.max(EDGE, Math.min(right, window.innerWidth - mw - EDGE)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // The menu is a portal, so it is NOT inside `wrap` — testing only the
      // wrapper would close it the instant you clicked an item.
      if (!wrap.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Fixed positioning does not follow a scrolling ancestor, so close rather
    // than let the menu drift away from its row.
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn("flex justify-end", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // Stop row-level onClick handlers (e.g. navigate-to-detail) firing.
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors",
          "hover:bg-surface-2 hover:text-text outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          open && "bg-surface-2 text-text",
        )}
      >
        <MoreHorizontal size={16} strokeWidth={2} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              right: pos?.right ?? 0,
              // Mounted-but-unplaced on the first pass purely so it can be
              // measured. `visibility` rather than `display:none`, which would
              // report a height of 0.
              visibility: pos ? undefined : "hidden",
            }}
            className={cn(
              // z-50 to clear the sticky table header and the product save bar;
              // the portal already puts it outside every clipping ancestor.
              "z-50 min-w-40 overflow-hidden rounded-md border border-border",
              "bg-surface py-1 shadow-md",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                disabled={a.disabled}
                title={a.title}
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className={cn(
                  "block w-full px-3 py-1.5 text-left text-body transition-colors",
                  a.danger ? "text-danger hover:bg-danger/10" : "text-text hover:bg-surface-2",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

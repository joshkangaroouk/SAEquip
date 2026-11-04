import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
 *
 * ⚠️ Keyboard: the menu-button pattern. Opening moves focus INTO the menu (the
 * first item, or the last with ArrowUp); ArrowUp/Down/Home/End and type-ahead
 * move between enabled items; Escape and Tab close and return focus to the
 * trigger. Because the menu sits at the end of <body>, focus has to be moved —
 * until 2026-10 it stayed on the trigger, so Tab walked the page instead of
 * the items. Choosing an item returns focus to the trigger BEFORE running the
 * action, so a dialog it opens restores focus there when it closes.
 */
export function DropdownMenu({
  actions,
  label = "More actions",
  className,
}: {
  actions: MenuAction[];
  /** The trigger's accessible name — prefer a specific one, e.g. "Actions for EX Heater". */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const enabled = actions.map((a, i) => (a.disabled ? -1 : i)).filter((i) => i >= 0);
  const first = enabled[0] ?? -1;
  const last = enabled[enabled.length - 1] ?? -1;

  function openAt(index: number) {
    setActive(index);
    setOpen(true);
  }
  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }

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

  // Move focus to the highlighted item once the menu is placed and visible.
  useEffect(() => {
    if (open && pos && active >= 0) items.current[active]?.focus();
  }, [open, pos, active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // The menu is a portal, so it is NOT inside `wrap` — testing only the
      // wrapper would close it the instant you clicked an item.
      if (!wrap.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    // Fixed positioning does not follow a scrolling ancestor, so close rather
    // than let the menu drift away from its row.
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  function onTriggerKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAt(first);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt(last);
    }
  }

  function onMenuKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const at = enabled.indexOf(active);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive(enabled[(at + 1) % enabled.length] ?? -1);
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive(enabled[(at - 1 + enabled.length) % enabled.length] ?? -1);
        return;
      case "Home":
        e.preventDefault();
        setActive(first);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "Escape":
        // Stopped here so a dialog underneath, listening on document, stays open.
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      case "Tab":
        e.preventDefault();
        close(true);
        return;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const k = e.key.toLowerCase();
          for (let n = 1; n <= enabled.length; n++) {
            const i = enabled[(at + n) % enabled.length];
            if (actions[i].label.trim().toLowerCase().startsWith(k)) {
              setActive(i);
              break;
            }
          }
        }
    }
  }

  return (
    <div ref={wrap} className={cn("flex justify-end", className)}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // Stop row-level onClick handlers (e.g. navigate-to-detail) firing.
          e.stopPropagation();
          if (open) close(false);
          else openAt(first);
        }}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex h-8.5 w-8.5 items-center justify-center text-muted transition-colors duration-[120ms]",
          "hover:bg-surface-2 hover:text-text",
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
            aria-label={label}
            onKeyDown={onMenuKey}
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              right: pos?.right ?? 0,
              // Mounted-but-unplaced on the first pass purely so it can be
              // measured. `visibility` rather than `display:none`, which would
              // report a height of 0.
              visibility: pos ? undefined : "hidden",
            }}
            className="z-50 min-w-40 overflow-hidden border border-border bg-surface py-1 shadow-menu"
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((a, i) => (
              <button
                key={a.label}
                ref={(el) => {
                  items.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={a.disabled}
                aria-disabled={a.disabled || undefined}
                title={a.title}
                onMouseEnter={() => !a.disabled && setActive(i)}
                onClick={() => {
                  close(true);
                  a.onSelect();
                }}
                className={cn(
                  // The panel clips overflow, so the focus outline is drawn inside the item.
                  "block w-full px-3 py-2 text-left text-body transition-colors duration-[120ms] focus-visible:outline-offset-[-2px]",
                  a.danger ? "text-danger" : "text-text",
                  i === active && "bg-surface-2",
                  "enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted",
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

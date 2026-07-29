import { useEffect, useRef, useState } from "react";
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

/**
 * The row-level "⋯" menu used by the catalog tables.
 *
 * Deliberately lightweight rather than a headless-UI dependency: closes on
 * outside click, Escape, and scroll, and renders in-flow (no portal) since it
 * only ever sits in a table row. Right-aligned so it never overflows the row's
 * trailing edge.
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
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Scroll closes it because the menu is positioned in-flow, so it would
    // otherwise drift away from its trigger inside a scrolling table.
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn("relative flex justify-end", className)}>
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

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-9 z-20 min-w-40 overflow-hidden rounded-md border border-border",
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
        </div>
      )}
    </div>
  );
}

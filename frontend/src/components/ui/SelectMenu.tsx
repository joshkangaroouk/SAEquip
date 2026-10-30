import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  /** Indent level, for a tree. Purely visual. */
  depth?: number;
}

/** Breathing room between the trigger and the list, and from the viewport edge. */
const GAP = 4;
const EDGE = 8;
/** ~9 rows. Long enough to be useful, short enough to leave the page visible. */
const MAX_H = 320;

/**
 * A styled single-select, for cases where a native `<select>` cannot be made to
 * match the rest of the UI — a browser renders its option list with the OS
 * chrome, which no CSS reaches, and a 23-item category tree drops an unstyled,
 * unbounded list over the page.
 *
 * ⚠️ Rendered in a PORTAL on <body>, positioned `fixed` from the trigger's
 * rect, for the same reason `DropdownMenu` is: any ancestor with `overflow`
 * clips an absolutely-positioned sibling, and no z-index fixes that.
 *
 * ⚠️ It also SCROLLS, which `DropdownMenu` does not, and that changes two
 * things: the height used for the flip decision must be the capped one, and
 * the close-on-scroll listener must ignore scrolls that came from inside the
 * list — a capture-phase `scroll` handler sees those too, so without the check
 * the menu closes the moment you scroll it.
 *
 * ⚠️ Keyboard: the select-only combobox pattern. Focus STAYS on the trigger;
 * arrows/Home/End/type-ahead move a highlight announced through
 * `aria-activedescendant`, Enter/Space/Tab choose, Escape closes. The options
 * are not focusable. They used to be buttons with no key handling at all, in
 * a portal at the END of <body> — so Tab walked the page instead of the list,
 * and the category filter and sort were mouse-only (fixed 2026-10-12).
 */
export function SelectMenu({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Select…",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-o${i}`;
  /** The highlighted option while open, by index. */
  const [active, setActive] = useState(-1);

  const current = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  function openList() {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }
  function choose(i: number) {
    const o = options[i];
    setOpen(false);
    if (o) onChange(o.value);
  }

  // Keep the highlighted option in view as it moves.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId is derived from listId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function onTriggerKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        // Stopped here so a dialog underneath, listening on document, does not
        // close too.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(last, a + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        return;
      case "Tab":
        // Choose and let focus move on, as a native select does.
        if (active >= 0) choose(active);
        else setOpen(false);
        return;
      default:
        // Type-ahead: the next option starting with the typed letter.
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const k = e.key.toLowerCase();
          for (let n = 1; n <= options.length; n++) {
            const i = (active + n) % options.length;
            if (options[i].label.trim().toLowerCase().startsWith(k)) {
              setActive(i);
              break;
            }
          }
        }
    }
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const w = wrap.current;
    const m = menu.current;
    if (!w || !m) return;
    const r = w.getBoundingClientRect();
    // The RENDERED height, capped — the natural height of 23 rows would flip
    // the menu upwards on a list that will never actually be that tall.
    const h = Math.min(m.offsetHeight, MAX_H);
    const flip = r.bottom + GAP + h > window.innerHeight && r.top - GAP - h >= 0;
    // ⚠️ Clamped at BOTH ends. The 200px floor keeps a narrow trigger from
    // producing an unreadable list, but on a phone that floor is wider than
    // the viewport allows, so it has to yield to the upper bound.
    const width = Math.min(Math.max(r.width, 200), window.innerWidth - EDGE * 2);
    setPos({
      top: flip ? r.top - h - GAP : r.bottom + GAP,
      // Clamped so a trigger near the right edge cannot push the list off it.
      left: Math.max(EDGE, Math.min(r.left, window.innerWidth - width - EDGE)),
      width,
    });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // The list is a portal, so it is NOT inside `wrap`.
      if (!wrap.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // ⚠️ Capture phase sees the LIST's own scroll as well as the page's.
    // Closing on that would make the list impossible to scroll.
    const onScroll = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface",
          "px-2.5 text-body text-text shadow-xs transition-[color,box-shadow] outline-none",
          "hover:bg-surface-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          open && "border-ring",
        )}
      >
        <span className="truncate">{current ? current.label : placeholder}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menu}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: pos?.width,
              maxHeight: MAX_H,
              // Mounted-but-unplaced on the first pass purely so it can be
              // measured. `visibility` rather than `display:none`, which would
              // report a height of 0.
              visibility: pos ? undefined : "hidden",
            }}
            className={cn(
              // z-50 clears the sticky table header and the product save bar.
              "z-50 overflow-y-auto overscroll-contain rounded-md border border-border",
              "bg-surface py-1 shadow-md",
            )}
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <div
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  // Keeps focus on the trigger, where the keyboard handling is.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  style={{ paddingLeft: 10 + (o.depth ?? 0) * 14 }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 py-1.5 pr-2.5 text-left text-body transition-colors",
                    selected ? "font-semibold text-text" : "text-muted",
                    i === active ? "bg-surface-2 text-text" : selected && "bg-surface-2/60",
                  )}
                >
                  {/* Always rendered, so the labels do not shift by the width
                      of a tick as the selection moves. */}
                  <Check
                    size={14}
                    strokeWidth={2.5}
                    className={cn("shrink-0", selected ? "text-accent-foreground" : "invisible")}
                  />
                  <span className="truncate">{o.label}</span>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

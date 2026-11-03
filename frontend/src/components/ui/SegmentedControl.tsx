import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Shown inside the segment in mono, and read as part of its name ("Live, 88") when the label is a string. */
  count?: number;
  /**
   * Icon-only: the segment shows just this (a 16px icon) in a 32×32 square,
   * and the label, which must be a string, becomes its accessible name and a
   * tooltip on hover and keyboard focus. The top bar's theme switch.
   */
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * One choice from a few, shown all at once (00 "Segmented control"): a --track
 * container with 4px padding and gap, 32px segments, the selected one yellow
 * with 600 text, the others muted (--text on hover, 02a Q4).
 *
 * A radio group for assistive tech and the keyboard: only the checked segment
 * is in the tab order, and the arrow keys (and Home/End) move AND select,
 * skipping disabled segments.
 *
 * Each label is laid out twice in the same grid cell — once invisibly at 600 —
 * so a segment is always as wide as its selected state and the row does not
 * shift by a few pixels as the selection moves.
 *
 * An option with an `icon` is icon-only (see SegmentOption). Its tooltip is
 * drawn here, not by `title`, because a title shows on hover only, never on
 * focus; it is aria-hidden, as the segment's name already says the same.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Names the group, e.g. "File type". Required: the segments alone don't say what they choose. */
  ariaLabel: string;
  /** One size today (32px segments); the prop exists so a denser one can be added without a call-site change. */
  size?: "md";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const checked = options.findIndex((o) => o.value === value);
  // The tab stop: the checked segment, or the first usable one when none is.
  const tabStop = checked >= 0 && !options[checked].disabled ? checked : enabled[0];

  function move(to: number) {
    const o = options[to];
    if (!o) return;
    refs.current[to]?.focus();
    if (o.value !== value) onChange(o.value);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const at = enabled.indexOf(index);
    let to: number | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = enabled[(at + 1) % enabled.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") to = enabled[0];
    else if (e.key === "End") to = enabled[enabled.length - 1];
    if (to === undefined) return;
    e.preventDefault();
    move(to);
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex max-w-full flex-wrap gap-1 bg-track p-1", className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        const iconOnly = o.icon !== undefined;
        const name = typeof o.label === "string" ? o.label : undefined;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            // "Live, 88". Spelled out because the flex layout puts a stray
            // space before a visually hidden comma ("Live , 88").
            aria-label={
              iconOnly ? name : o.count !== undefined && typeof o.label === "string" ? `${o.label}, ${o.count}` : undefined
            }
            disabled={o.disabled}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => !on && onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 px-3 text-body whitespace-nowrap transition-colors duration-[120ms]",
              iconOnly && "group relative w-8 justify-center px-0",
              on
                ? "bg-accent font-semibold text-accent-ink"
                : "font-medium text-muted enabled:hover:text-text",
              "disabled:cursor-not-allowed disabled:text-border-input",
            )}
          >
            {iconOnly ? (
              <>
                <span aria-hidden="true" className="flex [&_svg]:h-4 [&_svg]:w-4">
                  {o.icon}
                </span>
                {/* Under the segment, inside the screen: the first aligns to
                    its left edge, the last to its right, any between centre. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute top-full z-30 mt-2 border border-border bg-surface px-2 py-1 text-label font-medium text-text opacity-0 shadow-menu",
                    "transition-opacity duration-[120ms] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none",
                    i === 0 ? "left-0" : i === options.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                  )}
                >
                  {o.label}
                </span>
              </>
            ) : (
              <span className="grid justify-items-center">
                <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
                  {o.label}
                </span>
                <span className="col-start-1 row-start-1">{o.label}</span>
              </span>
            )}
            {o.count !== undefined && (
              <span className={cn("text-micro font-normal tabular-nums", on ? "text-accent-ink" : "text-muted")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

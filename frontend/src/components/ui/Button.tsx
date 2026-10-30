import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
type Size = "xs" | "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * - `primary`: yellow — the one primary action in a view.
   * - `secondary`: the design's "ghost" button — transparent, bordered.
   * - `ghost`: text only, no border (toolbars, quiet actions).
   * - `danger`: everyday destructive action — red outline.
   * - `danger-solid`: the confirm-delete button inside a dialog — solid red in
   *   both themes (02a "After 3b").
   */
  variant?: Variant;
  /** `md` 40px; `sm` 34px (the design's small ghost); `xs` is the same as `sm`. */
  size?: Size;
  loading?: boolean;
  /** A 34×34 square for an icon on its own. Needs an `aria-label`. */
  icon?: boolean;
}

/*
 * Square, 1px border on every variant (transparent where there is none) so
 * all variants share one box. Inter 14/600. Focus is the global outline
 * (index.css), never a ring.
 *
 * Hovers apply only while ENABLED (`enabled:hover:`), so a disabled button
 * cannot light up. Disabled is drawn explicitly — surface-2 fill, muted text,
 * the plain border — never with opacity, which turned yellow into olive on
 * dark (02a "After 3b").
 */
const base =
  "inline-flex shrink-0 items-center justify-center gap-2 border font-semibold whitespace-nowrap select-none " +
  "transition-colors duration-[120ms] " +
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-muted " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "border-accent bg-accent text-accent-ink enabled:hover:border-accent-hover enabled:hover:bg-accent-hover",
  secondary: "border-border-strong bg-transparent text-text enabled:hover:border-text enabled:hover:bg-surface-2",
  ghost: "border-transparent bg-transparent text-muted enabled:hover:bg-surface-2 enabled:hover:text-text",
  danger: "border-danger bg-transparent text-danger enabled:hover:bg-danger-bg",
  "danger-solid": "border-danger bg-danger-solid text-white enabled:hover:bg-danger-solid-hover",
};

/* The sizes are a scale of BOX, not of type: every size is 14px (text-body). */
const sizes: Record<Size, string> = {
  xs: "h-8.5 px-3 text-body",
  sm: "h-8.5 px-3 text-body",
  md: "h-10 px-4.5 text-body",
};

/** Square button: yellow primary, outline secondary, text ghost, danger outline, solid confirm-delete. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon = false, disabled, className, children, ...rest },
  ref,
) {
  if (import.meta.env.DEV && icon && !rest["aria-label"] && !rest["aria-labelledby"]) {
    console.warn("Button: an icon button needs an aria-label.");
  }
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], icon && "h-8.5 w-8.5 p-0", className)}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

/**
 * A link that looks like a Button — for navigation, e.g. "View live site"
 * opening another site. A real <a>, so it opens in a new tab, copies and
 * reads as a link. Same variants and sizes; the hovers drop `enabled:`,
 * which never matches a link.
 */
export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Exclude<Variant, "danger-solid">; size?: Size }) {
  return (
    <a className={cn(base, variants[variant].replace(/enabled:hover:/g, "hover:"), sizes[size], className)} {...rest}>
      {children}
    </a>
  );
}

/**
 * The "×" remove control: neutral until hovered, then a surface-2 square and
 * a red glyph.
 *
 * `size` is a prop, not something to override through className: the box and
 * the glyph change together.
 */
export function RemoveButton({
  onClick,
  title = "Remove",
  disabled,
  size = "md",
  className,
}: {
  onClick: () => void;
  /** Also the accessible name — prefer a specific one, e.g. "Remove EX Heater". */
  title?: string;
  disabled?: boolean;
  /** "sm" (20px) sits inside a 26px chip; "md" (34px) stands alone in a row. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "flex shrink-0 items-center justify-center text-muted transition-colors duration-[120ms]",
        size === "sm" ? "h-5 w-5" : "h-8.5 w-8.5",
        "enabled:hover:bg-surface-2 enabled:hover:text-danger",
        "disabled:cursor-not-allowed disabled:text-border-input",
        className,
      )}
    >
      <X size={size === "sm" ? 12 : 16} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

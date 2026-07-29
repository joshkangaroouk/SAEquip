import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// shadcn buttons are medium-weight, compact, and focus with a soft 3px ring at
// half opacity rather than a hard offset outline.
const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap " +
  "transition-colors select-none outline-none " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  // Brand yellow keeps the primary slot — shadcn's own primary is near-black.
  primary: "bg-accent text-accent-foreground shadow-xs hover:bg-accent-hover",
  // shadcn's "outline": bordered, transparent, subtle hover fill.
  secondary: "border border-border bg-surface text-text shadow-xs hover:bg-surface-2",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-text",
  danger: "bg-danger text-white shadow-xs hover:bg-danger/90",
};

// shadcn's control heights: 36px default, 32px small. `xs` (28px) exists to sit
// inline with pill-shaped chips without towering over them.
const sizes: Record<Size, string> = {
  xs: "h-7 gap-1 px-2.5 text-small",
  sm: "h-8 gap-1.5 px-3 text-small",
  md: "h-9 px-4 text-body",
};

/** Rounded button. Yellow primary, outline secondary, ghost, danger. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

/** Bigger "×" remove/delete control. Same neutral background hover as DragHandle for consistency. */
export function RemoveButton({
  onClick,
  title = "Remove",
  disabled,
  className,
}: {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg leading-none text-muted transition-colors",
        "hover:bg-surface-2 hover:text-danger outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
        className,
      )}
    >
      ×
    </button>
  );
}

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap " +
  "transition-colors select-none focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "border border-border bg-transparent text-text hover:bg-surface-2",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-text",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-small",
  md: "h-11 px-5 text-body",
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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xl leading-none text-danger transition-colors",
        "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
        className,
      )}
    >
      ×
    </button>
  );
}

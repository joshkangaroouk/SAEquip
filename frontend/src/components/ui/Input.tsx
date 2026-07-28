import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const fieldBase =
  "w-full rounded-md bg-surface border border-border text-text placeholder:text-subtle " +
  "transition-colors " +
  "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Control density. "sm" is used across the product editor, which packs a lot of
 * fields into one page; "md" stays the default so other pages are unchanged.
 */
export type FieldSize = "sm" | "md";

export const fieldSizes: Record<FieldSize, string> = {
  sm: "px-2.5 py-1.5 text-small",
  md: "px-3 py-2.5 text-body",
};

// Omit the native numeric `size` so ours (density) wins without widening to
// string | number.
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: FieldSize;
};

/** Rounded text input with a yellow focus ring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = "md", ...rest },
  ref,
) {
  return <input ref={ref} className={cn(fieldBase, fieldSizes[size], className)} {...rest} />;
});

/** Label + field + optional hint/error wrapper for consistent form rows. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-small font-semibold text-text">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-small text-danger">{error}</p>
      ) : hint ? (
        <p className="text-small text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export { fieldBase };

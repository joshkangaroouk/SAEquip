import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// shadcn field treatment: hairline border, soft 3px ring at half opacity on
// focus, and a red ring when aria-invalid. The previous hard 1px yellow ring
// plus border colour change read as much more aggressive.
const fieldBase =
  "w-full rounded-md bg-surface border border-input text-text placeholder:text-subtle " +
  "shadow-xs transition-[color,box-shadow] outline-none " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-danger/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Control density. "sm" is used across the product editor, which packs a lot of
 * fields into one page; "md" stays the default so other pages are unchanged.
 */
export type FieldSize = "sm" | "md";

// Matches the Button heights: 32px compact, 36px default.
export const fieldSizes: Record<FieldSize, string> = {
  sm: "h-8 px-2.5 text-body",
  md: "h-9 px-3 text-body",
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
        <label htmlFor={htmlFor} className="block text-body font-medium text-text">
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

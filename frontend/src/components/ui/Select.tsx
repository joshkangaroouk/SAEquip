import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Rounded native select with a yellow focus ring and a custom chevron
 * (native arrow hidden via appearance-none).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full appearance-none rounded-md bg-surface border border-border text-text",
          "px-3 py-2.5 pr-10 text-body transition-colors",
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
});

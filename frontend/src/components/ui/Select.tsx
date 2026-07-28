import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { fieldSizes, type FieldSize } from "./Input";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: FieldSize;
};

/**
 * Rounded native select with a yellow focus ring and a custom chevron
 * (native arrow hidden via appearance-none).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, size = "md", ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full appearance-none rounded-md bg-surface border border-input text-text",
          fieldSizes[size],
          size === "sm" ? "pr-8" : "pr-9",
          "shadow-xs transition-[color,box-shadow] outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted",
          size === "sm" ? "right-2.5" : "right-3",
        )}
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

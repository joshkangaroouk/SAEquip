import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { fieldBase, fieldSizes, useFieldControl, type FieldSize } from "./Input";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: FieldSize;
};

/**
 * Native select in the field box, with a drawn chevron (the native arrow is
 * hidden by appearance-none). Native, so its option list and keyboard
 * behaviour are the browser's own.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, size = "md", ...rest },
  ref,
) {
  const a11y = useFieldControl(rest);
  return (
    <div className="relative">
      <select
        ref={ref}
        // pr-9 AFTER the size: its px-3 would otherwise cancel the chevron's room.
        className={cn(fieldBase, "appearance-none", fieldSizes[size], "pr-9", className)}
        {...rest}
        {...a11y}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
});

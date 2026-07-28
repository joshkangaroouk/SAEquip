import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { fieldBase, type FieldSize } from "./Input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: FieldSize;
};

/** Rounded multiline input matching Input styling. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, size = "md", ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        fieldBase,
        // fieldSizes carries a fixed height for inputs; a textarea needs to grow,
        // so only its padding/type size is reused.
        size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2",
        "min-h-16 resize-y text-body leading-relaxed",
        className,
      )}
      {...rest}
    />
  );
});

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { fieldBase, useFieldControl, type FieldSize } from "./Input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: FieldSize;
};

/** Square multiline input, the same box as Input. Grows vertically; padding 8 12 (6 12 dense). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, size = "md", ...rest },
  ref,
) {
  const a11y = useFieldControl(rest);
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        fieldBase,
        // fieldSizes carries a fixed height for inputs; a textarea needs to grow,
        // so only its padding/type size is reused.
        size === "md" ? "px-3 py-2" : "px-3 py-1.5",
        "min-h-16 resize-y text-body leading-relaxed",
        className,
      )}
      {...rest}
      {...a11y}
    />
  );
});

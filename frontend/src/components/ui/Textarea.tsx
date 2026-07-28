import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { fieldBase, fieldSizes, type FieldSize } from "./Input";

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
      className={cn(fieldBase, fieldSizes[size], "resize-y leading-relaxed", className)}
      {...rest}
    />
  );
});

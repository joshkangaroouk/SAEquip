import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { fieldBase } from "./Input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Rounded multiline input matching Input styling. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldBase, "resize-y leading-relaxed", className)}
      {...rest}
    />
  );
});

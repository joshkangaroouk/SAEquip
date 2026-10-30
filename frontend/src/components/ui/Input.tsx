import { createContext, forwardRef, useContext, useId, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/*
 * The field box (00 "Input and select"): square, --input-bg, a 1px
 * --border-input edge (3:1 against the page, 02a Q13), focus via the global
 * 2px outline, a --danger border when aria-invalid. Disabled is drawn, not
 * dimmed: --surface-2 fill, muted text, the plain border.
 */
const fieldBase =
  "w-full border border-border-input bg-field text-text placeholder:text-muted " +
  "transition-colors duration-[120ms] " +
  "aria-[invalid=true]:border-danger " +
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-muted";

/**
 * Control density: "md" is the design's 40px field; "sm" and "xs" are the
 * 34px dense field for toolbars and the packed product editor (02a Q11).
 * Every density is 14px type and 12px side padding.
 *
 * Pick the density here rather than passing a height through `className`.
 */
export type FieldSize = "xs" | "sm" | "md";

export const fieldSizes: Record<FieldSize, string> = {
  xs: "h-8.5 px-3 text-body",
  sm: "h-8.5 px-3 text-body",
  md: "h-10 px-3 text-body",
};

/* ---------------------------------------------------------------------------
 * Field ↔ control wiring.
 *
 * A Field tells the control inside it which id its label points at, whether
 * it is invalid, and which hint or error describes it — so an error is
 * announced with its input and draws the red border, without every caller
 * threading three attributes through. A control's own props always win.
 * ------------------------------------------------------------------------- */
interface FieldState {
  id: string;
  describedBy?: string;
  invalid: boolean;
}
const FieldContext = createContext<FieldState | null>(null);

/** The id / aria-invalid / aria-describedby a control inside a Field should carry. */
export function useFieldControl(own: {
  id?: string;
  "aria-invalid"?: InputHTMLAttributes<HTMLInputElement>["aria-invalid"];
  "aria-describedby"?: string;
}) {
  const field = useContext(FieldContext);
  const describedBy = [own["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  return {
    id: own.id ?? field?.id,
    "aria-invalid": own["aria-invalid"] ?? (field?.invalid ? true : undefined),
    "aria-describedby": describedBy,
  };
}

// Omit the native numeric `size` so ours (density) wins without widening to
// string | number.
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: FieldSize;
};

/** Square text input. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = "md", ...rest },
  ref,
) {
  const a11y = useFieldControl(rest);
  return <input ref={ref} className={cn(fieldBase, fieldSizes[size], className)} {...rest} {...a11y} />;
});

/**
 * Label + control + optional hint/error, for consistent form rows.
 *
 * The label is the design's field label (Inter 12/600, muted). Without
 * `htmlFor`, the label points at an id the Field generates and hands to the
 * Input / Select / Textarea inside it.
 */
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
  const auto = useId();
  const controlId = htmlFor ?? `${auto}-control`;
  const messageId = `${auto}-message`;
  const message = error || hint;
  return (
    <FieldContext.Provider value={{ id: controlId, describedBy: message ? messageId : undefined, invalid: !!error }}>
      <div className={cn("space-y-1.5", className)}>
        {label && (
          <label htmlFor={controlId} className="t-label block">
            {label}
          </label>
        )}
        {children}
        {error ? (
          <p id={messageId} className="t-help text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={messageId} className="t-help">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export { fieldBase };

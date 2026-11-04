import { useId } from "react";
import { cn } from "../../lib/cn";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * Square 16px checkbox (02a Q27): a custom appearance-none box rather than a
 * native one with accent-color, whose corners and tick the browser draws.
 * Unchecked: --input-bg with a --border-input edge. Checked: yellow fill, black
 * tick. Disabled: drawn (surface-2, plain border; a checked one goes grey), not
 * dimmed. Focus is the global outline on the box.
 */
export function Checkbox({ checked, onChange, disabled, label, id, className }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-center gap-2.5 select-none",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative inline-flex">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            "peer h-4 w-4 shrink-0 cursor-[inherit] appearance-none border border-border-input bg-field",
            "transition-colors duration-[120ms] checked:border-accent checked:bg-accent",
            "disabled:border-border disabled:bg-surface-2 disabled:checked:border-border-input disabled:checked:bg-border-input",
          )}
        />
        <svg
          className="pointer-events-none absolute left-0 top-0 hidden h-4 w-4 text-accent-ink peer-checked:block"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path d="M5 10l3.5 3.5L15 6.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      {label && <span className={cn("text-body", disabled ? "text-muted" : "text-text")}>{label}</span>}
    </label>
  );
}

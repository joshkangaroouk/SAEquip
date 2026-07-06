import { useId } from "react";
import { cn } from "../../lib/cn";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  id?: string;
}

/** Rounded checkbox — yellow fill with a black tick when checked. */
export function Checkbox({ checked, onChange, disabled, label, id }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-center gap-2.5 select-none",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
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
            "peer h-5 w-5 shrink-0 appearance-none rounded border bg-surface transition-colors",
            "checked:bg-accent checked:border-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            "focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            checked ? "border-accent" : "border-border",
          )}
        />
        <svg
          className="pointer-events-none absolute left-0 top-0 hidden h-5 w-5 text-accent-foreground peer-checked:block"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path d="M5 10l3.5 3.5L15 6.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      {label && <span className="text-body text-text">{label}</span>}
    </label>
  );
}

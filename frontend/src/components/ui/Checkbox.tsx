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

/** Rounded checkbox — yellow fill with a black tick when checked. */
export function Checkbox({ checked, onChange, disabled, label, id, className }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-center gap-2.5 select-none",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
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
            // shadcn checkbox is 16px with a small radius and a soft ring.
            "peer h-4 w-4 shrink-0 appearance-none rounded-sm border bg-surface shadow-xs transition-shadow",
            "checked:bg-accent checked:border-accent outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50",
            checked ? "border-accent" : "border-border",
          )}
        />
        <svg
          className="pointer-events-none absolute left-0 top-0 hidden h-4 w-4 text-accent-foreground peer-checked:block"
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

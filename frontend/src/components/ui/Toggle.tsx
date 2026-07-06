import { cn } from "../../lib/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

/**
 * Rounded pill switch. Track turns yellow when on; a circular knob slides.
 * Uses a real checkbox role for keyboard/AT support.
 */
export function Toggle({ checked, onChange, disabled, label, id }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-3 select-none",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          checked ? "bg-accent border-accent" : "bg-surface-2 border-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition-transform",
            checked ? "translate-x-[22px] bg-accent-foreground" : "translate-x-1 bg-muted",
          )}
        />
      </button>
      {label && <span className="text-body text-text">{label}</span>}
    </label>
  );
}

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
        "inline-flex items-center gap-2 select-none",
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
          // shadcn switch: 32x18 track, soft focus ring, no offset outline.
          "relative h-[1.15rem] w-8 shrink-0 rounded-full border transition-colors outline-none",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50",
          checked ? "bg-accent border-accent" : "bg-surface-2 border-border",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full shadow-xs transition-transform",
            checked ? "translate-x-[0.875rem] bg-accent-foreground" : "translate-x-0 bg-surface",
          )}
        />
      </button>
      {label && <span className="text-body text-text">{label}</span>}
    </label>
  );
}

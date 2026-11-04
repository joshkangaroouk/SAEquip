import { cn } from "../../lib/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Visible label. Without one, pass `ariaLabel` — a switch must have a name. */
  label?: string;
  ariaLabel?: string;
  id?: string;
}

/**
 * The drawn switch — 42×24, square, a 16px square knob (00, 02a "After 3b"):
 *  - off: --surface-2 track, 1px --border-input edge, --muted knob;
 *  - on: yellow track and edge, #0B0B0B knob;
 *  - disabled: the plain border and a --border-input knob.
 * The knob jumps rather than slides: transitions are colour only (02a Q4).
 *
 * Exported on its own for a control that IS already a button and only needs
 * to show the state (LogoActivationPanel's toggle cards) — nesting a real
 * switch button inside another button is invalid. Always aria-hidden: the
 * state belongs to the control around it.
 */
export function ToggleTrack({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-block h-6 w-10.5 shrink-0 border transition-colors duration-[120ms]",
        disabled
          ? "border-border bg-surface-2"
          : checked
            ? "border-accent bg-accent"
            : "border-border-input bg-surface-2",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-4 w-4",
          checked ? "left-[21px]" : "left-[3px]",
          disabled ? "bg-border-input" : checked ? "bg-accent-ink" : "bg-muted",
        )}
      />
    </span>
  );
}

/** Switch. A real `role="switch"` button, so keyboard and assistive tech get it for free. */
export function Toggle({ checked, onChange, disabled, label, ariaLabel, id }: ToggleProps) {
  if (import.meta.env.DEV && !label && !ariaLabel) console.warn("Toggle: pass `label` or `ariaLabel`.");
  return (
    <label
      htmlFor={id}
      className={cn("inline-flex items-center gap-2 select-none", disabled ? "cursor-not-allowed" : "cursor-pointer")}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ? undefined : ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="inline-flex shrink-0 disabled:cursor-not-allowed"
      >
        <ToggleTrack checked={checked} disabled={disabled} />
      </button>
      {label && <span className={cn("text-body", disabled ? "text-muted" : "text-text")}>{label}</span>}
    </label>
  );
}

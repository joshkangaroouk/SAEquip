import { useId, useRef, type Ref } from "react";
import { Button } from "./Button";

/**
 * Choose one file: a real Button that opens the browser's file dialog, and
 * the chosen file's name beside it (02a "After 4a").
 *
 * The native <input type="file"> is kept — it is what the browser opens and
 * what holds the file — but visually hidden and out of the tab order, because
 * its own "Choose file" button cannot be styled, has no disabled look and no
 * focus outline of ours. The Button carries the focus, the outline and the
 * disabled state, and is described by the file name, so a screen reader
 * hears "Choose file, No file chosen".
 */
export function FileInput({
  file,
  onChange,
  accept,
  disabled,
  label = "Choose file",
  inputRef,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  label?: string;
  /** The native input, e.g. to clear its value after an upload. */
  inputRef?: Ref<HTMLInputElement>;
}) {
  const own = useRef<HTMLInputElement | null>(null);
  const statusId = useId();
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <input
        ref={(el) => {
          own.current = el;
          if (typeof inputRef === "function") inputRef(el);
          else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el;
        }}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {/* type="button": it often sits inside a form, where a bare button submits. */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        aria-describedby={statusId}
        onClick={() => own.current?.click()}
      >
        {label}
      </Button>
      <span id={statusId} className="min-w-0 truncate text-body font-normal text-muted">
        {file ? file.name : "No file chosen"}
      </span>
    </span>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: Size;
  /** When false, backdrop click / Escape won't close. Default true. */
  dismissable?: boolean;
}

/** Rounded dialog rendered in a portal with a dimmed backdrop. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissable = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissable) onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => dismissable && onClose()}
      />
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl bg-surface border border-border shadow-2xl",
          sizes[size],
        )}
      >
        {(title || description) && (
          <div className="border-b border-border px-6 py-5">
            {title && <h2 className="text-h3 font-semibold text-text">{title}</h2>}
            {description && <p className="mt-1 text-small text-muted">{description}</p>}
          </div>
        )}
        {children && <div className="px-6 py-5 text-body text-text">{children}</div>}
        {footer && (
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------------ *
 * useConfirm — imperative confirm dialog returning a Promise<boolean>.
 * Mount <ConfirmProvider> once at the app root; then anywhere:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete?", danger: true })) { … }
 * ------------------------------------------------------------------------ */

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setState(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => settle(false)}
        title={state?.title}
        description={state?.description}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => settle(false)}>
              {state?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={state?.danger ? "danger" : "primary"}
              size="sm"
              onClick={() => settle(true)}
            >
              {state?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

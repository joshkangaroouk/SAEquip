import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
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
  /** The dialog's accessible name when it has no visible `title`. One of the two is required. */
  ariaLabel?: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: Size;
  /** When false, backdrop click / Escape won't close. Default true. */
  dismissable?: boolean;
}

/**
 * Open modals, innermost last. Only the TOP one answers Escape and Tab:
 * every modal listens on `document`, so without this a confirm opened over
 * another dialog closed both on one Escape, and two focus traps fought over
 * every Tab.
 */
const openStack: symbol[] = [];

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

/**
 * Square dialog in a portal over the --backdrop: a 1px --border and the menu
 * shadow (02a Q10), the title in .t-modal-title, a footer on --surface-2, and
 * a Close (×) button whenever it is dismissable.
 *
 * ⚠️ The panel is capped at the viewport and its BODY scrolls, between a
 * fixed header and footer. It used to be `overflow-hidden` with no height
 * cap while the page behind was scroll-locked, so a tall dialog — a long
 * translation, a quote with many lines, anything on a phone — was cut off
 * with its Save button out of reach.
 *
 * Focus moves in on open (unless something inside already took it, e.g. an
 * `autoFocus` input), is held inside, and returns to where it was on close;
 * the title and description name the dialog for assistive tech.
 */
export function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  description,
  children,
  footer,
  size = "md",
  dismissable = true,
}: ModalProps) {
  if (import.meta.env.DEV && open && !title && !ariaLabel) console.warn("Modal: pass a `title` or an `ariaLabel`.");
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // The latest handler without re-running the open/close effect on each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissableRef = useRef(dismissable);
  dismissableRef.current = dismissable;

  useEffect(() => {
    if (!open) return;
    const me = Symbol("modal");
    openStack.push(me);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    function onKey(e: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== me) return;
      if (e.key === "Escape") {
        if (dismissableRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      const at = openStack.indexOf(me);
      if (at !== -1) openStack.splice(at, 1);
      document.body.style.overflow = prevOverflow;
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
        onClick={() => dismissable && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex w-full flex-col overflow-hidden border border-border bg-surface shadow-menu outline-none",
          "max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)]",
          sizes[size],
        )}
      >
        {dismissable && (
          <Button
            variant="ghost"
            icon
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 z-10"
          >
            <X size={18} strokeWidth={2} />
          </Button>
        )}
        {(title || description) && (
          <div className={cn("shrink-0 border-b border-border px-6 py-5", dismissable && "pr-14")}>
            {title && (
              <h2 id={titleId} className="t-modal-title text-text">
                {title}
              </h2>
            )}
            {description && (
              <p id={descriptionId} className="t-help mt-1">
                {description}
              </p>
            )}
          </div>
        )}
        {children && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-body text-text">{children}</div>
        )}
        {footer && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-surface-2 px-6 py-4">
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
              variant={state?.danger ? "danger-solid" : "primary"}
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

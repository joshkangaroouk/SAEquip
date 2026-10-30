import { Toaster as SonnerToaster, toast } from "sonner";
import { useDocumentTheme } from "../../lib/theme";

/**
 * Themed sonner Toaster — follows the page theme, square, top-right.
 * Mount ONCE near the app root. Fire toasts with the re-exported `toast`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme={useDocumentTheme()}
      richColors={false}
      toastOptions={{
        style: {
          background: "rgb(var(--surface))",
          border: "1px solid rgb(var(--border))",
          borderRadius: "0",
          boxShadow: "var(--shadow-menu)",
          color: "rgb(var(--text))",
          fontFamily: '"Inter", sans-serif',
          fontWeight: 400,
        },
        classNames: {
          title: "font-semibold",
          description: "text-muted",
          actionButton: "!rounded-none !bg-accent !text-accent-ink !font-semibold hover:!bg-accent-hover",
          cancelButton: "!rounded-none !bg-surface-2 !text-muted",
          success: "!text-ok",
          error: "!text-danger",
          // translate-on-save reports with toast.warning; without these two
          // the warning and info toasts fell back to sonner's own colours.
          warning: "!text-warning",
          info: "!text-text",
          loading: "!text-text",
        },
      }}
    />
  );
}

// Re-export the fire-and-forget API: toast.success / .error / .loading / .promise / …
export { toast };

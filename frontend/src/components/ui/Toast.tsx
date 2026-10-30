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
          actionButton: "!bg-accent !text-accent-ink font-semibold",
          cancelButton: "!bg-surface-2 !text-muted",
          success: "!text-ok",
          error: "!text-danger",
          loading: "!text-accent",
        },
      }}
    />
  );
}

// Re-export the fire-and-forget API: toast.success / .error / .loading / .promise / …
export { toast };

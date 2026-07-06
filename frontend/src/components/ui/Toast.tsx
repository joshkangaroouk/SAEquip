import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Themed sonner Toaster — light, rounded, top-right, yellow accents.
 * Mount ONCE near the app root. Fire toasts with the re-exported `toast`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="light"
      richColors={false}
      toastOptions={{
        style: {
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          color: "var(--text)",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: 400,
        },
        classNames: {
          title: "font-semibold",
          description: "text-muted",
          actionButton: "!bg-accent !text-accent-foreground !rounded-md font-semibold",
          cancelButton: "!bg-surface-2 !text-muted !rounded-md",
          success: "!text-success",
          error: "!text-danger",
          loading: "!text-accent",
        },
      }}
    />
  );
}

// Re-export the fire-and-forget API: toast.success / .error / .loading / .promise / …
export { toast };

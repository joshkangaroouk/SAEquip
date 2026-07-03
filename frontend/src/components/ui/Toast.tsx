import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Themed sonner Toaster — dark, sharp-cornered, top-right, yellow accents.
 * Mount ONCE near the app root. Fire toasts with the re-exported `toast`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="dark"
      richColors={false}
      toastOptions={{
        style: {
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "0",
          color: "var(--text)",
          fontFamily: '"Clash Grotesk", sans-serif',
          fontWeight: 300,
        },
        classNames: {
          title: "font-semibold",
          description: "text-muted",
          actionButton: "!bg-accent !text-accent-foreground !rounded-none font-semibold",
          cancelButton: "!bg-surface-2 !text-muted !rounded-none",
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

import { apiFetch } from "./api";

/**
 * What the browser tells the activity log (POST /api/activity/report), because
 * the server never sees it: signing out, a password change and two-factor go
 * browser → Supabase, and these CSVs are built in the page.
 *
 * Best effort, and never in the way: it gives up after a second and never
 * throws, so a sign-out or a download cannot wait on it.
 */
export type ReportableAction =
  | "auth.sign_out"
  | "auth.password_changed"
  | "auth.two_factor_on"
  | "auth.two_factor_off"
  | "enquiry.quote.export"
  | "enquiry.file_request.export"
  | "translation.export";

export async function reportActivity(action: ReportableAction, extra: { rows?: number; filtered?: boolean } = {}): Promise<void> {
  try {
    await Promise.race([
      apiFetch("/api/activity/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
        keepalive: true,
      }),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
  } catch {
    // The log is a record, not a gate.
  }
}

import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "./api";
import { supabase } from "./supabase";

/**
 * The super admin's Activity badge (Josh, 2026-11-19, USERS-AUDIT L18): how
 * many access changes someone ELSE made since the super admin last opened the
 * Activity page. Invites, accounts disabled, enabled or deleted, Website Editor
 * access, two-factor and passwords: the server decides what counts
 * (ACCESS_ALERT in services/activityCatalog.ts, GET /api/activity/unseen).
 *
 * "Last opened" is the account's `activitySeenAt` (Supabase user_metadata, so
 * it follows the super admin between computers), set by markActivitySeen()
 * when the Activity page opens. Never set: the server counts the last 7 days.
 *
 * Refreshed on load, when the window regains focus (at most once a minute) and
 * every 5 minutes while the dashboard is open, so a change made elsewhere shows
 * without a reload. ⚠️ Fails silently, like the enquiry badges: no copy means
 * no badge, never a wrong one.
 */
export const SEEN_KEY = "activitySeenAt";
const POLL_MS = 5 * 60 * 1000;
const FOCUS_MIN_MS = 60 * 1000;

let cache: number | null = null;
let seq = 0;
let lastFetch = 0;
const listeners = new Set<() => void>();

function publish(next: number | null) {
  cache = next;
  listeners.forEach((l) => l());
}

export function refreshAccessAlerts(since: string | null): void {
  const mine = ++seq;
  lastFetch = Date.now();
  apiFetch(`/api/activity/unseen${since ? `?since=${encodeURIComponent(since)}` : ""}`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((body: { count: number }) => {
      if (mine === seq && typeof body.count === "number") publish(body.count);
    })
    .catch(() => {
      /* silent, see above */
    });
}

/** The Activity page is open: everything so far has been seen, on every computer. */
export async function markActivitySeen(): Promise<void> {
  seq++; // a count already on its way is out of date
  publish(0);
  await supabase.auth.updateUser({ data: { [SEEN_KEY]: new Date().toISOString() } }).catch(() => {});
}

/** The count as it stands now, without subscribing (the Activity page, as it opens). */
export const accessAlertCount = (): number | null => cache;

/** On sign-out, so the next account starts clean. */
export function clearAccessAlerts(): void {
  seq++;
  publish(null);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The count for the super admin (`enabled`); null for anyone else or before it loads. */
export function useAccessAlerts(enabled: boolean, since: string | null): number | null {
  const count = useSyncExternalStore(subscribe, () => cache);
  useEffect(() => {
    if (!enabled) return;
    refreshAccessAlerts(since);
    const timer = window.setInterval(() => refreshAccessAlerts(since), POLL_MS);
    const onFocus = () => {
      if (Date.now() - lastFetch > FOCUS_MIN_MS) refreshAccessAlerts(since);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, since]);
  return enabled ? count : null;
}

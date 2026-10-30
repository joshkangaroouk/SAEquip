import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "./api";

/**
 * The sidebar's enquiry badges (02a "After 4b"): how many quote requests and
 * resource requests are not yet handled, from GET /api/enquiries/counts, held
 * for the session like the product index.
 *
 * Refreshed after Mark as handled / Mark as new and whenever an enquiry list
 * loads, so the badge agrees with the list on screen without a reload.
 *
 * ⚠️ Fails silently: a badge is a convenience, and until the batch 6 migration
 * is applied the route errors. No copy means no badge, never a wrong one.
 */
export interface EnquiryCounts {
  quotes: number;
  resourceRequests: number;
}

let cache: EnquiryCounts | null = null;
let requested = false;
// Only the latest request may publish, so a slow reply that left before a
// Mark as handled cannot overwrite the count that followed it.
let seq = 0;
const listeners = new Set<() => void>();

function publish(next: EnquiryCounts | null) {
  cache = next;
  listeners.forEach((l) => l());
}

export function refreshEnquiryCounts(): void {
  requested = true;
  const mine = ++seq;
  apiFetch("/api/enquiries/counts")
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((counts: EnquiryCounts) => {
      if (mine === seq) publish(counts);
    })
    .catch(() => {
      // Silent, see above. Keep whatever copy there is.
    });
}

/** Forget the copy — on sign-out, so the next account starts clean. */
export function clearEnquiryCounts() {
  requested = false;
  seq++;
  publish(null);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The session's counts, loading them the first time anything asks. */
export function useEnquiryCounts(): EnquiryCounts | null {
  const counts = useSyncExternalStore(subscribe, () => cache);
  useEffect(() => {
    if (!requested) refreshEnquiryCounts();
  }, []);
  return counts;
}

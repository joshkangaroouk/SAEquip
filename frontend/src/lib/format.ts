/** "29 Oct 2026, 10:00" — a request's submitted time in full. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "29 Oct" this year, "29 Oct 2025" otherwise — a list row's date. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/** "just now", "3 minutes ago", "yesterday", then the date: an activity row's time. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 60 * 60) return RELATIVE.format(Math.round(seconds / 60), "minute");
  if (abs < 60 * 60 * 24) return RELATIVE.format(Math.round(seconds / 3600), "hour");
  if (abs < 60 * 60 * 24 * 7) return RELATIVE.format(Math.round(seconds / 86400), "day");
  return formatShortDate(iso);
}

/**
 * "18 Nov 2026, 14:32:05": to the second, in UK time, whatever the browser's
 * own zone, because the log is read as a record of when things happened here.
 */
export function formatDateTimeSeconds(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

import type { Request, Response, NextFunction } from "express";
import { ActivityRecorder, WRITE_TIMEOUT_MS, flushActivity, type RequestFacts } from "../services/activity.js";

/**
 * Mounted on /api only (index.ts): attaches `req.activity` and writes the
 * request's activity row(s) when its response ends.
 *
 * ⚠️ The row is written BEFORE the response finishes, by wrapping `res.end`.
 * On Vercel a function may be frozen as soon as its response is sent, so
 * writing on `finish` could lose rows. The wait is bounded by WRITE_TIMEOUT_MS
 * and a failure is logged without the event's details: the activity log can
 * slow a response down by that much at worst, never fail or change it.
 *
 * A request with nothing to log (every GET but an export) ends at once.
 *
 * /public is deliberately not covered: website visitors are not logged, and
 * the live widget should not carry this code at all.
 */
export function activityContext(req: Request, res: Response, next: NextFunction): void {
  req.activity = new ActivityRecorder(requestFacts(req));

  const end = res.end.bind(res) as (...args: unknown[]) => Response;
  let flushing = false;
  (res as { end: unknown }).end = (...args: unknown[]): Response => {
    if (flushing) return end(...args);
    flushing = true;
    let write: Promise<void> | null = null;
    try {
      write = flushActivity(req, res.statusCode);
    } catch (err) {
      console.error("[activity] could not plan the entry:", (err as Error).message);
    }
    if (!write) return end(...args);

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), WRITE_TIMEOUT_MS);
    });
    Promise.race([write.then(() => "done" as const), timeout])
      .then((r) => {
        if (r === "timeout") console.error(`[activity] write timed out: ${req.method} ${req.baseUrl}${req.path}`);
      })
      .catch((err: Error) => {
        // The message only: an event's details must not reach the logs.
        console.error(`[activity] write failed: ${req.method} ${req.baseUrl}${req.path}: ${err.message}`);
      })
      .finally(() => {
        clearTimeout(timer);
        end(...args);
      });
    return res;
  };
  next();
}

const BATCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function header(req: Request, name: string): string | null {
  const v = req.headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s ? s : null;
}

/**
 * IP, device, rough location and the save it belongs to.
 *
 * `req.ip` is the visitor's address on Vercel because `trust proxy` is on
 * there (index.ts). The geo headers are Vercel's own, and for the same reason
 * are only believed on Vercel: anywhere else a caller could simply send them.
 */
export function requestFacts(req: Request): RequestFacts {
  const onVercel = Boolean(process.env.VERCEL);
  const decode = (s: string | null) => {
    if (!s) return null;
    try {
      return decodeURIComponent(s).slice(0, 100);
    } catch {
      return s.slice(0, 100);
    }
  };
  const batch = header(req, "x-activity-batch");
  return {
    ip: req.ip ?? null,
    userAgent: header(req, "user-agent")?.slice(0, 500) ?? null,
    country: onVercel ? decode(header(req, "x-vercel-ip-country")) : null,
    city: onVercel ? decode(header(req, "x-vercel-ip-city")) : null,
    batchId: batch && BATCH_ID.test(batch) ? batch.toLowerCase() : null,
  };
}

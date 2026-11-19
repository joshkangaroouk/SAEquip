import express, { Router } from "express";
import rateLimit from "express-rate-limit";

/**
 * POST /api/csp-report: where browsers send Content-Security-Policy violation
 * reports (USERS-AUDIT M8, 2026-11-19).
 *
 * The dashboard's policy is still Report-Only, and until now it named nowhere
 * to report to, so it neither blocked nor told anyone anything. With this in
 * place, a week of Vercel logs shows what an ENFORCED policy would break
 * (search the logs for "[csp]"); then vercel.json can switch the header to
 * `Content-Security-Policy`, which is what stops an injected script from
 * reading the Supabase session in localStorage.
 *
 * Public by necessity (a browser sends it with no credentials), so:
 * - nothing is stored, only a console line;
 * - URLs are cut to origin and path, never their query or fragment, which
 *   could carry an invite or recovery token;
 * - bodies are capped at 16 KB and the route at 60 a minute per IP
 *   (in-memory: these are log lines, so a soft limit is enough).
 */
export const cspReportRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: false, legacyHeaders: false });
const parse = express.json({ type: ["application/csp-report", "application/reports+json", "application/json"], limit: "16kb" });

/** Origin and path only. */
function where(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const u = new URL(value);
    return `${u.origin}${u.pathname}`.slice(0, 300);
  } catch {
    // "inline", "eval", "data", "blob" and the like
    return value.slice(0, 40);
  }
}

type Report = Record<string, unknown>;

/** The two shapes: report-uri's { "csp-report": {...} }, and report-to's [{ type, body }]. */
function reportsIn(body: unknown): Report[] {
  if (Array.isArray(body)) {
    return body
      .filter((r): r is { type?: unknown; body?: unknown } => !!r && typeof r === "object")
      .filter((r) => r.type === "csp-violation" && r.body && typeof r.body === "object")
      .map((r) => r.body as Report)
      .slice(0, 20);
  }
  const legacy = (body as { "csp-report"?: unknown } | null)?.["csp-report"];
  return legacy && typeof legacy === "object" ? [legacy as Report] : [];
}

cspReportRouter.post("/", limiter, parse, (req, res) => {
  for (const r of reportsIn(req.body)) {
    const line = {
      directive: String(r.effectiveDirective ?? r["effective-directive"] ?? r["violated-directive"] ?? "").slice(0, 60),
      blocked: where(r.blockedURL ?? r["blocked-uri"]),
      page: where(r.documentURL ?? r["document-uri"]),
      source: where(r.sourceFile ?? r["source-file"]),
      line: typeof (r.lineNumber ?? r["line-number"]) === "number" ? (r.lineNumber ?? r["line-number"]) : null,
      disposition: String(r.disposition ?? "").slice(0, 20) || null,
    };
    console.warn(`[csp] ${JSON.stringify(line)}`);
  }
  res.status(204).end();
});

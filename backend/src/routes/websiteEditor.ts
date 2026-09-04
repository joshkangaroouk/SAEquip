import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { DudaApiError } from "../services/duda.js";
import { dudaSso } from "../services/dudaSso.js";

/**
 * Website Editor — mints Duda editor SSO links for the signed-in staff member.
 *
 * Mounted under the requireAuth'd /api router, but a valid token is NOT
 * sufficient authorization here: requireAuth only proves "valid Supabase token
 * with an allowed email domain", and ALLOWED_EMAIL_DOMAINS spans both
 * kangaroouk.com and saequip.com. The real gate is the DudaEditorAccount /
 * DudaEditorSiteAccess mapping — no row, no link. Fail closed; never fall back
 * to a shared or agency account.
 *
 * An SSO link is a bearer credential: whoever holds the URL becomes that Duda
 * account on that site. Hence: minted per click, returned once in a JSON body,
 * never persisted, never logged, and never echoed from an upstream error.
 */
export const websiteEditorRouter = Router();

/**
 * Keyed on the authenticated user, not IP: `app.set("trust proxy", …)` is
 * never called, so behind Railway's proxy req.ip is the proxy address and an
 * IP-keyed limiter would bucket every staff member into one shared bucket.
 */
const ssoLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
  keyGenerator: (req) => req.user?.id ?? "anonymous",
});

const ssoBody = z.object({ siteName: z.string().trim().min(1).max(64) }).strict();

/** Audit every attempt — granted or denied. Never records the minted URL. */
async function audit(
  req: { user?: { id: string; email: string }; ip?: string; headers: Record<string, unknown> },
  siteName: string,
  outcome: string,
  dudaAccountName: string | null,
): Promise<void> {
  try {
    const ua = req.headers["user-agent"];
    await prisma.dudaSsoAudit.create({
      data: {
        staffUserId: req.user?.id ?? "unknown",
        staffEmail: req.user?.email ?? "unknown",
        siteName,
        dudaAccountName,
        outcome,
        ip: req.ip ?? null,
        userAgent: typeof ua === "string" ? ua.slice(0, 500) : null,
      },
    });
  } catch (err) {
    // Auditing must never break the request, but a silent failure would hide
    // security-relevant activity — so it's logged loudly instead.
    console.error("[websiteEditor] failed to write SSO audit row:", err);
  }
}

/**
 * GET /api/website/sites
 * The sites THIS user may edit, from their mapping, enriched with live Duda
 * metadata. Returns [] (not 403) when unmapped — the page renders a
 * "ask Kangaroo for access" empty state rather than an error.
 */
websiteEditorRouter.get("/website/sites", async (req, res, next) => {
  try {
    const account = await prisma.dudaEditorAccount.findUnique({
      where: { staffUserId: req.user!.id },
      include: { siteAccess: { orderBy: { createdAt: "asc" } } },
    });

    if (!account) {
      res.json({ hasAccess: false, sites: [] });
      return;
    }

    const sites = await Promise.all(
      account.siteAccess.map(async (access) => {
        // Metadata is a nicety — a Duda hiccup shouldn't blank the page, so
        // fall back to just the id rather than failing the whole request.
        let domain: string | null = null;
        let publishStatus: string | null = null;
        let lastPublished: string | null = null;
        let thumbnailUrl: string | null = null;
        let siteUrl: string | null = null;
        try {
          const details = await dudaSso.getSiteDetails(access.siteName);
          domain = details.site_default_domain ?? null;
          publishStatus = details.publish_status ?? null;
          lastPublished = details.last_published_date ?? null;
          thumbnailUrl = details.thumbnail_url ?? null;
          siteUrl =
            details.canonical_url ?? (domain ? `https://${domain}` : null);
        } catch {
          /* leave metadata null */
        }
        return {
          siteName: access.siteName,
          domain,
          siteUrl,
          thumbnailUrl,
          publishStatus,
          lastPublished,
          grantedPermissions: access.grantedPermissions,
        };
      }),
    );

    // No caching: `thumbnailUrl` carries Duda's ?v=<timestamp> cache-buster,
    // which changes when Duda regenerates the homepage screenshot. Express's
    // default ETag would otherwise let a 304 serve a stale URL, pinning the
    // page to an old screenshot.
    res.setHeader("Cache-Control", "no-store");
    res.json({ hasAccess: true, dudaAccountName: account.dudaAccountName, sites });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/website/sso  body { siteName }
 *
 * POST rather than GET because this mints a credential: it keeps the request
 * out of browser history, prefetch and referrer headers.
 *
 * The client supplies ONLY siteName. The Duda account comes from the verified
 * JWT, and `target` is hardcoded EDITOR inside the service — the API also
 * accepts RESET_SITE / RESET_BASIC / SWITCH_TEMPLATE, so honouring a
 * client-supplied target would be a site-wipe vector.
 */
websiteEditorRouter.post("/website/sso", ssoLimiter, async (req, res) => {
  const parsed = ssoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const { siteName } = parsed.data;

  try {
    const account = await prisma.dudaEditorAccount.findUnique({
      where: { staffUserId: req.user!.id },
      include: { siteAccess: true },
    });

    if (!account) {
      await audit(req, siteName, "denied_no_mapping", null);
      res.status(403).json({ error: "no_editor_access" });
      return;
    }

    const granted = account.siteAccess.some((a) => a.siteName === siteName);
    if (!granted) {
      await audit(req, siteName, "denied_site_not_granted", account.dudaAccountName);
      res.status(403).json({ error: "site_not_granted" });
      return;
    }

    const url = await dudaSso.editorLink(account.dudaAccountName, siteName);
    await audit(req, siteName, "granted", account.dudaAccountName);

    // Returned once, in the body, over HTTPS. Not cached, not stored, not logged.
    res.setHeader("Cache-Control", "no-store");
    res.json({ url });
  } catch (err) {
    // Handled locally and NEVER passed to next(): the shared error handler in
    // index.ts echoes DudaApiError.body (up to 500 chars) to the caller and
    // console.errors the whole object — and a Duda SSO response body contains
    // a live one-time login token. Log only the status, never the body.
    if (err instanceof DudaApiError) {
      console.error(`[websiteEditor] Duda SSO failed with status ${err.status}`);
    } else {
      console.error("[websiteEditor] SSO minting failed:", err instanceof Error ? err.message : "unknown");
    }
    await audit(req, siteName, "duda_error", null);
    res.status(502).json({ error: "sso_failed" });
  }
});

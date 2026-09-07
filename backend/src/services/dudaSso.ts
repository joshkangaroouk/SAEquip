import { z } from "zod";
import { DudaApiError, dudaRequest } from "./duda.js";

/**
 * Duda ACCOUNT-scoped client: customer accounts, per-site permissions, and
 * editor SSO links.
 *
 * Separate from services/duda.ts because that file is entirely site-scoped
 * (`/sites/multiscreen/{site}/ecommerce/...`); these paths hang off
 * `/accounts/...` instead. It reuses `dudaRequest` from there so there is
 * still exactly one place that builds the Basic-auth header.
 *
 * SECURITY: an SSO link is a bearer credential — whoever holds the URL becomes
 * that Duda account. Never log it, never persist it, never echo a failure body
 * to a client (see DudaApiError handling in the route).
 */

/** Every account-scoped path in one place, so a wrong guess is one edit to fix. */
const PATHS = {
  createAccount: () => `/accounts/create`,
  account: (accountName: string) => `/accounts/${encodeURIComponent(accountName)}`,
  // Grant (POST), replace (PUT), read (GET) and REVOKE (DELETE) all hang off
  // this one path. There is no `/accounts/{name}/sites/{site}` resource —
  // it 404s with RESTEASY003210 (verified by `npm run duda:probe-sso`), which
  // is how a wrong revoke path once masqueraded as "already revoked".
  sitePermissions: (accountName: string, site: string) =>
    `/accounts/${encodeURIComponent(accountName)}/sites/${encodeURIComponent(site)}/permissions`,
  ssoLink: (accountName: string) =>
    `/accounts/sso/${encodeURIComponent(accountName)}/link`,
  site: (site: string) => `/sites/multiscreen/${encodeURIComponent(site)}`,
} as const;

/**
 * The permission set granted to SAEquip staff. Least privilege — see CLAUDE.md
 * for the full rationale per withheld permission. In short, deliberately absent:
 *
 *   E_COMMERCE  product editing stays in the Hub (no second source of truth,
 *               and the Hub has no optimistic-concurrency check)
 *   DEV_MODE    arbitrary JS injection into a live page; also how the widget
 *               embeds are managed, so Kangaroo keeps it
 *   RESET       wipes the site
 *   CUSTOM_DOMAIN / BACKUPS / USE_APP / CLIENT_MANAGE_FREE_APPS /
 *   MANAGE_CONNECTED_DATA / EDIT_CONNECTED_DATA /
 *   CONTENT_LIBRARY_EXTERNAL_DATA_SYNC / INSITE / AI_ASSISTANT
 *
 * NOTE: Duda requires PUBLISH to be accompanied by REPUBLISH and
 * LIMITED_EDITING in the same request.
 */
export const EDITOR_PERMISSIONS = [
  "EDIT",
  "ADD_FLEX",
  "LIMITED_EDITING",
  "PUBLISH",
  "REPUBLISH",
  "BLOG",
  "SEO",
  "SEO_OVERVIEW",
  "STATS_TAB",
  "SITE_COMMENTS",
  "CONTENT_LIBRARY",
] as const;

/** Bounded wait — a hung Duda call must not hang a user's request. */
const SSO_TIMEOUT_MS = 10_000;
const ADMIN_TIMEOUT_MS = 15_000;

/**
 * Duda returns the one-time login URL in the response body. Validated rather
 * than cast, because `dudaRequest` casts unvalidated and can even resolve
 * `undefined` on an empty body — and this value gets handed to a browser.
 */
const ssoResponseSchema = z
  .object({ url: z.string().url() })
  .passthrough();

export interface DudaSitePermissionEntry {
  site_name: string;
  permissions: string[];
}

export interface DudaAccountCreate {
  account_name: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  lang?: string;
}

export const dudaSso = {
  /**
   * Mint a short-lived, single-use SSO URL that logs `accountName` straight
   * into the site editor.
   *
   * `target` is hardcoded to EDITOR on purpose: the API also accepts
   * RESET_SITE, RESET_BASIC, SWITCH_TEMPLATE and SWITCH_TEMPLATE_WITH_AI, so
   * letting a caller choose it would turn this into a site-wipe vector.
   */
  async editorLink(accountName: string, siteName: string): Promise<string> {
    const qs = new URLSearchParams({ target: "EDITOR", site_name: siteName });
    const raw = await dudaRequest<unknown>(
      "GET",
      `${PATHS.ssoLink(accountName)}?${qs.toString()}`,
      undefined,
      { timeoutMs: SSO_TIMEOUT_MS },
    );
    const parsed = ssoResponseSchema.safeParse(raw);
    if (!parsed.success) {
      // Deliberately does not include `raw` — it may contain a live token.
      throw new Error("Duda SSO response did not contain a usable url");
    }
    return parsed.data.url;
  },

  // --- Provisioning (used only by the CLI script, never by an HTTP route) ---

  createAccount(payload: DudaAccountCreate): Promise<unknown> {
    return dudaRequest("POST", PATHS.createAccount(), payload, {
      timeoutMs: ADMIN_TIMEOUT_MS,
    });
  },

  getAccount(accountName: string): Promise<unknown> {
    return dudaRequest("GET", PATHS.account(accountName), undefined, {
      timeoutMs: ADMIN_TIMEOUT_MS,
    });
  },

  grantSiteAccess(
    accountName: string,
    siteName: string,
    permissions: readonly string[],
  ): Promise<unknown> {
    return dudaRequest(
      "POST",
      PATHS.sitePermissions(accountName, siteName),
      { permissions },
      { timeoutMs: ADMIN_TIMEOUT_MS },
    );
  },

  /** Full replacement — Duda has no partial permission update. */
  updateSitePermissions(
    accountName: string,
    siteName: string,
    permissions: readonly string[],
  ): Promise<unknown> {
    return dudaRequest(
      "PUT",
      PATHS.sitePermissions(accountName, siteName),
      { permissions },
      { timeoutMs: ADMIN_TIMEOUT_MS },
    );
  },

  /**
   * Permissions this account holds on ONE site.
   *
   * Deliberately per-site rather than "list all sites for this account":
   * `/accounts/{name}/sites` 404s with RESTEASY003210 (verified by
   * `npm run duda:probe-sso`), whereas this path resolves. It's also the more
   * precise question — we only ever ask about sites already in the DB allowlist.
   */
  getSitePermissions(accountName: string, siteName: string): Promise<unknown> {
    return dudaRequest("GET", PATHS.sitePermissions(accountName, siteName), undefined, {
      timeoutMs: ADMIN_TIMEOUT_MS,
    });
  },

  revokeSiteAccess(accountName: string, siteName: string): Promise<unknown> {
    return dudaRequest("DELETE", PATHS.sitePermissions(accountName, siteName), undefined, {
      timeoutMs: ADMIN_TIMEOUT_MS,
    });
  },

  /**
   * Site metadata for the Website Editor page.
   *
   * `thumbnail_url` is the homepage screenshot Duda renders in its own site
   * list; it's served from Duda's public CDN (irp.cdn-website.com) so the
   * browser can load it directly with no proxying.
   */
  getSiteDetails(siteName: string): Promise<{
    site_name: string;
    site_default_domain?: string;
    publish_status?: string;
    last_published_date?: string;
    thumbnail_url?: string;
    canonical_url?: string;
  }> {
    return dudaRequest("GET", PATHS.site(siteName), undefined, {
      timeoutMs: ADMIN_TIMEOUT_MS,
    });
  },
};

/** Exposed for the path-probe script. */
export const DUDA_SSO_PATHS = PATHS;
export { DudaApiError };

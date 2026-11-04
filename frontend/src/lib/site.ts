/**
 * The public website, for "View on website" links.
 *
 * ⚠️ Launch checklist: switch to https://saequip.com when the custom domain is
 * connected (CLAUDE.md "Launch checklist"), with the widget shims and the
 * basket's ENDPOINT.
 */
export const LIVE_SITE_ORIGIN = "https://saequip.multiscreensite.com";

/**
 * A product's live page, or null when it has none: a hidden product is not on
 * the website, and one without a slug has no address.
 */
export function productPageUrl(p: { slug: string | null; status: string }): string | null {
  if (!p.slug || p.status !== "ACTIVE") return null;
  return `${LIVE_SITE_ORIGIN}/product/${encodeURIComponent(p.slug)}`;
}

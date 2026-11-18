/**
 * The order products appear in on the website's listing (`/public/catalogue`,
 * which the listing widget shows as it comes), set by dragging rows on the
 * Hub's Products page under "Website order" (Josh, 2026-11-18).
 *
 * Placed products first, by `HubProduct.sortOrder`; then the never-placed
 * ones (null: every product until the first drag, and any added since) by
 * name, as the listing was ordered before. The name comparison uses the
 * page's language on a translated page, English otherwise.
 *
 * ⚠️ The Hub's Products page applies the SAME rule in the browser
 * (frontend/src/lib/productOrder.ts), with the English collator below, so the
 * order it shows is the order the English listing shows. Change both together.
 */
export const UNPLACED = Number.MAX_SAFE_INTEGER;

export function compareListingOrder(
  a: { sortOrder: number | null; name: string },
  b: { sortOrder: number | null; name: string },
  collator: Intl.Collator,
): number {
  return (a.sortOrder ?? UNPLACED) - (b.sortOrder ?? UNPLACED) || collator.compare(a.name, b.name);
}

/**
 * The website's listing order, as the Products page shows it under "Website
 * order" (Josh, 2026-11-18).
 *
 * ⚠️ The same rule as backend/src/services/productOrder.ts, which orders
 * `/public/catalogue`: placed products by `sort_order`, then the never-placed
 * ones A–Z with the same English collator. Change both together, or the Hub
 * shows one order and the website another.
 */
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const UNPLACED = Number.MAX_SAFE_INTEGER;

export function compareWebsiteOrder(
  a: { sort_order: number | null; name: string | null },
  b: { sort_order: number | null; name: string | null },
): number {
  return (a.sort_order ?? UNPLACED) - (b.sort_order ?? UNPLACED) || collator.compare(a.name ?? "", b.name ?? "");
}

/**
 * Move `id` within the full order so it sits next to its new neighbour in the
 * VIEW it was dragged in: right after `prev` (the row now above it), or, at
 * the top of the view, right before `next`. Only the dragged product moves, so
 * with a filter on nothing else changes places, on any page of the website.
 */
export function placeNextTo(order: string[], id: string, prev: string | null, next: string | null): string[] {
  const rest = order.filter((x) => x !== id);
  if (prev !== null) {
    const i = rest.indexOf(prev);
    if (i >= 0) return [...rest.slice(0, i + 1), id, ...rest.slice(i + 1)];
  }
  if (next !== null) {
    const i = rest.indexOf(next);
    if (i >= 0) return [...rest.slice(0, i), id, ...rest.slice(i)];
  }
  return order;
}

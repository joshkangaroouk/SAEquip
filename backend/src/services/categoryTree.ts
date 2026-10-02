import { CATEGORY_ROOT, type DudaCategorySummary } from "./duda.js";

/**
 * Expand a set of category ids to include every ancestor.
 *
 * ⚠️ A product must never sit in a child without also sitting in its parent —
 * the rule the editor's picker enforces while you tick boxes. Enforcing it
 * HERE as well is what makes it true of the data rather than of one screen:
 * there are now two ways in (the product editor and the category page), plus
 * a stale tab replaying an old set, and a client-side-only rule holds for
 * none of them.
 *
 * Unknown ids pass through untouched — validating them is the caller's job,
 * and silently dropping one here would hide a real error.
 */
export function withAncestors(ids: string[], flat: DudaCategorySummary[]): string[] {
  const parentOf = new Map(flat.map((c) => [c.id, c.parent_id || CATEGORY_ROOT]));
  const out = new Set(ids);
  for (const id of ids) {
    let p = parentOf.get(id);
    // `has` also terminates the walk at ROOT and at a parent deleted upstream,
    // and guards against a cycle Duda should never produce but might.
    while (p && p !== CATEGORY_ROOT && parentOf.has(p) && !out.has(p)) {
      out.add(p);
      p = parentOf.get(p);
    }
  }
  return [...out];
}

/**
 * Top-level order before anyone has dragged: Products, the branch people
 * assign from most, first. Duda has no `sortOrder` on a category and its own
 * list order is creation order, newest first, which put Products last.
 * Unlisted titles keep Duda's order after these, so renaming a parent demotes
 * it rather than breaking the list.
 */
export const TOP_LEVEL_ORDER = ["products", "site challenges", "industries"];

/**
 * THE ordering rule for categories, shared by the dashboard's tree and every
 * public listing — so the order staff set by dragging is the order visitors
 * see. ⚠️ It used to live only in the dashboard: the public catalogue sorted
 * by Duda's creation order, so dragging the Site Challenges into a new order
 * changed the admin screen and nothing on the website.
 *
 * Most specific first, within one parent:
 *   1. a Hub position someone set by dragging (CategoryOrder),
 *   2. TOP_LEVEL_ORDER, for top-level categories nobody has dragged,
 *   3. Duda's own list order (`fallback`).
 * Returned as a sort KEY rather than a comparator so the order is total even
 * across different parents — a flat list sorted by it keeps every sibling
 * group in the right order, which `Array.sort` needs to be well defined.
 */
export function categorySortKey(
  c: { id: string; title: string; parentId: string },
  order: Map<string, number>,
  fallback: Map<string, number>,
): [number, number, number, number] {
  const dragged = order.get(c.id);
  const top = TOP_LEVEL_ORDER.indexOf(c.title.trim().toLowerCase());
  const rank = c.parentId === CATEGORY_ROOT && top !== -1 ? top : TOP_LEVEL_ORDER.length;
  return [dragged == null ? 1 : 0, dragged ?? 0, rank, fallback.get(c.id) ?? Number.MAX_SAFE_INTEGER];
}

export function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

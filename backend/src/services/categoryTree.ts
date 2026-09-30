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

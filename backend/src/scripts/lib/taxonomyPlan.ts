/**
 * Plan the product ↔ category writes for SA Equip's master sheet (Phase 2 of
 * docs/sa-equip-phase0/CURSOR_BRIEF.md). Pure: no network, no database, so the
 * rules are tested by script-guards:test and the dry run and the apply cannot
 * disagree about what they mean.
 *
 * For each product given:
 *   - Site Challenges and Industries: the sheet's list REPLACES the product's
 *     children of that parent, and the parent link is held exactly when at
 *     least one child is (a product is never in a child without its parent);
 *   - Category: the product type under "Products". A product whose type
 *     differs is changed ONLY if it is in `approvedCategoryChange`; every other
 *     difference is reported as a flag and left as it is. `null` = leave alone.
 * Only links inside those three branches are ever touched, and only for the
 * products given: anything else a product is in, and every product not given
 * (HOLD, not in the sheet), is left exactly as it is.
 *
 * An unknown title, a missing parent or a product given twice throws before
 * anything is planned — a guessed category on a live listing is worse than none.
 */
export const CATEGORY_ROOT = "ROOT";
export const SITE_CHALLENGES = "Site Challenges";
export const INDUSTRIES = "Industries";
export const PRODUCTS = "Products";

export type Cat = { id: string; title: string; parentId: string };
export type Link = { hubProductId: string; dudaCategoryId: string };
export type Wanted = {
  hubProductId: string;
  dudaProductId: string;
  name: string;
  category: string | null;
  siteChallenges: string[] | null;
  industries: string[] | null;
};
export type Field = "Site Challenges" | "Industries" | "Category";
export type Change = { dudaProductId: string; name: string; field: Field; from: string[]; to: string[] };
export type Plan = {
  changes: Change[];
  flags: (Change & { reason: string })[];
  adds: Link[];
  removals: Link[];
};

export function planAssignments(input: {
  wanted: Wanted[];
  links: Link[];
  cats: Cat[];
  approvedCategoryChange: Set<string>;
}): Plan {
  const { wanted, links, cats, approvedCategoryChange } = input;
  const byId = new Map(cats.map((c) => [c.id, c]));
  const topLevel = (title: string) => {
    const hits = cats.filter((c) => (c.parentId || CATEGORY_ROOT) === CATEGORY_ROOT && c.title === title);
    if (hits.length !== 1) throw new Error(`expected exactly one top-level "${title}", found ${hits.length}`);
    return hits[0];
  };
  const branch = (parent: Cat) => {
    const children = cats.filter((c) => c.parentId === parent.id);
    const byTitle = new Map(children.map((c) => [c.title, c]));
    if (byTitle.size !== children.length) throw new Error(`"${parent.title}" has two children with the same title`);
    return { parent, ids: new Set(children.map((c) => c.id)), byTitle };
  };
  const sc = branch(topLevel(SITE_CHALLENGES));
  const ind = branch(topLevel(INDUSTRIES));
  const prod = branch(topLevel(PRODUCTS));

  const seen = new Set<string>();
  for (const w of wanted) {
    if (seen.has(w.hubProductId)) throw new Error(`${w.name} (${w.dudaProductId}) is given twice`);
    seen.add(w.hubProductId);
  }

  const current = new Map<string, Set<string>>();
  for (const l of links) {
    if (!current.has(l.hubProductId)) current.set(l.hubProductId, new Set());
    current.get(l.hubProductId)!.add(l.dudaCategoryId);
  }
  const title = (id: string) => byId.get(id)?.title ?? `(unknown ${id})`;
  const resolve = (b: ReturnType<typeof branch>, titles: string[], w: Wanted) =>
    titles.map((t) => {
      const c = b.byTitle.get(t);
      if (!c) throw new Error(`${w.name} (${w.dudaProductId}): "${t}" is not a category under "${b.parent.title}"`);
      return c.id;
    });
  const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

  const plan: Plan = { changes: [], flags: [], adds: [], removals: [] };
  const add = (hubProductId: string, dudaCategoryId: string) => plan.adds.push({ hubProductId, dudaCategoryId });
  const remove = (hubProductId: string, dudaCategoryId: string) => plan.removals.push({ hubProductId, dudaCategoryId });

  for (const w of wanted) {
    const have = current.get(w.hubProductId) ?? new Set<string>();
    const listBranch = (b: ReturnType<typeof branch>, field: Field, titles: string[] | null) => {
      if (titles == null) return; // null = unknown: leave alone
      const want = new Set(resolve(b, titles, w));
      const cur = new Set([...have].filter((id) => b.ids.has(id)));
      if (!same(cur, want)) {
        plan.changes.push({ dudaProductId: w.dudaProductId, name: w.name, field, from: [...cur].map(title).sort(), to: titles });
        for (const id of cur) if (!want.has(id)) remove(w.hubProductId, id);
        for (const id of want) if (!cur.has(id)) add(w.hubProductId, id);
      }
      const hasParent = have.has(b.parent.id);
      if (want.size && !hasParent) add(w.hubProductId, b.parent.id);
      if (!want.size && hasParent) remove(w.hubProductId, b.parent.id);
    };
    listBranch(sc, "Site Challenges", w.siteChallenges);
    listBranch(ind, "Industries", w.industries);

    if (w.category != null) {
      const wantId = resolve(prod, [w.category], w)[0];
      const cur = new Set([...have].filter((id) => prod.ids.has(id)));
      if (!same(cur, new Set([wantId]))) {
        const change: Change = { dudaProductId: w.dudaProductId, name: w.name, field: "Category", from: [...cur].map(title).sort(), to: [w.category] };
        if (approvedCategoryChange.has(w.dudaProductId)) {
          plan.changes.push(change);
          for (const id of cur) if (id !== wantId) remove(w.hubProductId, id);
          if (!cur.has(wantId)) add(w.hubProductId, wantId);
        } else {
          plan.flags.push({ ...change, reason: "category differs from the sheet; the brief says flag it, not change it" });
        }
      }
      if (!have.has(prod.parent.id)) add(w.hubProductId, prod.parent.id);
    }
  }
  return plan;
}

/** The link set after a plan: current − removals + adds. */
export function applyPlan(links: Link[], plan: Plan): Link[] {
  const key = (l: Link) => `${l.hubProductId}|${l.dudaCategoryId}`;
  const gone = new Set(plan.removals.map(key));
  const out = new Map(links.filter((l) => !gone.has(key(l))).map((l) => [key(l), l]));
  for (const a of plan.adds) out.set(key(a), a);
  return [...out.values()];
}

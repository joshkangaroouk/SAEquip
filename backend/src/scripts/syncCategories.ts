/**
 * Push the Hub's product↔category assignments into Duda.
 *
 * Dry run (default — prints the diff, writes nothing):
 *   npm run duda:sync-categories --workspace=backend
 *
 * Apply:
 *   npm run duda:sync-categories --workspace=backend -- --confirm
 *
 * ⚠️ ONE-WAY, Hub → Duda. Duda's copy is overwritten wholesale on every run, so
 * an assignment made in Duda's own admin is lost at the next sync. The Hub's
 * product editor is the place to change these.
 *
 * ⚠️ Writes go category-by-category, not product-by-product, because
 * `PATCH /categories/{id}` takes the category's WHOLE product list and
 * `PATCH /products/{id}` with `categories` silently does nothing. That is also
 * why this is a batch script rather than part of the product save: the
 * full-replacement shape means two concurrent editors would clobber each
 * other, and Duda has no optimistic concurrency to catch it.
 *
 * One call per category (~23), not one per product.
 *
 * It also refreshes CategoryMirror — the local copy of Duda's tree that
 * `/public/catalogue` reads instead of calling Duda on the request path. The
 * per-category GET this already makes is the only place a category's SLUG is
 * available (`listAllCategories()` omits it), so the mirror is filled from a
 * round trip that was happening anyway.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { duda } from "../services/duda.js";

const prisma = new PrismaClient();

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gentle pacing — services/duda.ts has no rate-limit handling of its own. */
const DELAY_MS = 300;

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && new Set(a).size === new Set([...a, ...b]).size;

async function main() {
  const confirm = flag("confirm");

  const [categories, links] = await Promise.all([
    duda.listAllCategories(),
    // One indexed query for every assignment, rather than a query per category
    // — @@index([dudaCategoryId]) covers it. The same reasoning as usageIndex()
    // in routes/media.ts: a per-row query in a loop is a bug waiting for the
    // catalogue to grow.
    prisma.productCategory.findMany({
      select: { dudaCategoryId: true, hubProduct: { select: { dudaProductId: true, name: true } } },
    }),
  ]);

  const wanted = new Map<string, { id: string; name: string }[]>();
  for (const l of links) {
    if (!wanted.has(l.dudaCategoryId)) wanted.set(l.dudaCategoryId, []);
    wanted.get(l.dudaCategoryId)!.push({ id: l.hubProduct.dudaProductId, name: l.hubProduct.name ?? "" });
  }

  /*
   * A category deleted in Duda leaves ProductCategory rows pointing at nothing
   * — there is no foreign key, deliberately, because categories live in Duda.
   * Those rows can never be synced, so name them rather than failing on them.
   */
  const live = new Set(categories.map((c) => c.id));
  const stale = [...wanted.keys()].filter((id) => !live.has(id));

  console.log(`\n${confirm ? "Syncing" : "Dry run —"} product↔category assignments (Hub → Duda)\n`);
  console.log(`  categories in Duda    : ${categories.length}`);
  console.log(`  assignments in the Hub: ${links.length}`);

  let changed = 0;
  let alreadyRight = 0;
  const failures: string[] = [];
  /** Duda's own `seo.url` per category, read below. Never derived. */
  const slugOf = new Map<string, string>();

  for (const c of categories) {
    const want = (wanted.get(c.id) ?? []).map((p) => p.id);

    /*
     * Every category is read, even when both sides are empty. The summary
     * carries no slug, and the mirror needs one for every category or the
     * listing page cannot resolve that category from its URL.
     */
    let have: string[] = [];
    try {
      const full = (await duda.getCategory(c.id)) as unknown as {
        products?: { id: string }[];
        seo?: { url?: string };
      };
      have = (full.products ?? []).map((p) => p.id);
      if (full.seo?.url) slugOf.set(c.id, full.seo.url);
    } catch (err) {
      failures.push(`${c.title}: could not read — ${err instanceof Error ? err.message.slice(0, 120) : err}`);
      continue;
    }

    if (sameSet(have, want)) {
      alreadyRight++;
      console.log(`  ⊘ ${c.title.padEnd(44)} already correct (${want.length})`);
      continue;
    }

    const delta = `${have.length} → ${want.length}`;
    if (!confirm) {
      changed++;
      console.log(`  → ${c.title.padEnd(44)} ${delta}`);
      continue;
    }

    try {
      await duda.updateCategory(c.id, { products: want.map((id) => ({ id })) });
      changed++;
      console.log(`  ✓ ${c.title.padEnd(44)} ${delta}`);
      await sleep(DELAY_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 140) : String(err);
      failures.push(`${c.title}: ${msg}`);
      console.log(`  ✗ ${c.title.padEnd(44)} ${msg}`);
    }
  }

  /*
   * Refresh the mirror from what we just read. Done AFTER the writes so the
   * stored `products_count` reflects the sync rather than the state before it,
   * and unconditionally on a dry run too — the mirror is a read-through copy,
   * not a change to Duda, so keeping it fresh costs nothing and a stale mirror
   * is the one thing that makes /public/catalogue lie.
   */
  const seen = new Set<string>();
  for (const [i, c] of categories.entries()) {
    seen.add(c.id);
    const slug = slugOf.get(c.id);
    if (!slug) continue; // never guessed — see the model comment
    await prisma.categoryMirror.upsert({
      where: { dudaCategoryId: c.id },
      update: { title: c.title, slug, parentId: c.parent_id || "ROOT", position: i },
      create: { dudaCategoryId: c.id, title: c.title, slug, parentId: c.parent_id || "ROOT", position: i },
    });
  }
  // A category deleted in Duda must leave the mirror, or the listing offers a
  // filter that matches nothing and links to a 404.
  const dropped = await prisma.categoryMirror.deleteMany({
    where: { dudaCategoryId: { notIn: [...seen] } },
  });

  console.log(`\n=== CATEGORY SYNC ===`);
  console.log(`  mirror rows        : ${seen.size}${dropped.count ? `  (${dropped.count} removed)` : ""}`);
  console.log(`  categories updated : ${changed}${confirm ? "" : " (would be)"}`);
  console.log(`  already correct    : ${alreadyRight}`);
  console.log(`  failed             : ${failures.length}`);
  for (const f of failures) console.log(`     ${f}`);

  if (stale.length) {
    console.log(`\n  ⚠ ${stale.length} Hub assignment group(s) point at a category that no longer exists in Duda:`);
    for (const id of stale) console.log(`     ${id}  (${wanted.get(id)!.length} product(s))`);
    console.log(`    Nothing can be synced for these — re-assign those products in the Hub.`);
  }

  if (!links.length) {
    console.log(`\n  ⚠ No assignments in the Hub yet, so there is nothing to push.`);
    console.log(`    Tick categories on products in the Hub editor first.`);
  }

  console.log(confirm ? "" : `\n  Re-run with --confirm to apply.\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

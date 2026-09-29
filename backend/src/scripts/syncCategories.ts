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

  for (const c of categories) {
    const want = (wanted.get(c.id) ?? []).map((p) => p.id);

    // Duda's summary gives a count but not the ids, so a category that already
    // holds the right NUMBER still needs reading to know it holds the right
    // ONES. Skip that read only when both sides are empty.
    if (want.length === 0 && c.products_count === 0) {
      alreadyRight++;
      continue;
    }

    let have: string[] = [];
    try {
      const full = (await duda.getCategory(c.id)) as unknown as { products?: { id: string }[] };
      have = (full.products ?? []).map((p) => p.id);
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

  console.log(`\n=== CATEGORY SYNC ===`);
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

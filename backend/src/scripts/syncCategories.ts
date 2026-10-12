/**
 * Push the Hub's product↔category assignments into Duda.
 *
 * Dry run (default — prints the diff and writes nothing to DUDA; it does
 * refresh the local CategoryMirror, see below):
 *   npm run duda:sync-categories --workspace=backend
 *
 * Apply:
 *   npm run duda:sync-categories --workspace=backend -- --confirm
 *
 * ⚠️ Refuses to apply when the Hub holds NO assignments, and when it would
 * take more than a quarter of Duda's links away (--allow-removals overrides
 * the second). After the 2026-09-29 wipe Duda's copy was the one that
 * survived; an empty or wrong DATABASE_URL used to empty every category in
 * Duda and only then say "nothing to push". Every category is read before
 * anything is written, so the totals are known first.
 *
 * Print the live tree and each category's product count:
 *   npm run duda:sync-categories --workspace=backend -- --verify
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
import { syncRefusal } from "./lib/syncGuard.js";

const prisma = new PrismaClient();

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gentle pacing — services/duda.ts has no rate-limit handling of its own. */
const DELAY_MS = 300;

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && new Set(a).size === new Set([...a, ...b]).size;

/** Print the live tree, depth-first, with each category's Duda product count. */
async function verify(): Promise<void> {
  const cats = await duda.listAllCategories();
  const byParent = new Map<string, typeof cats>();
  for (const c of cats) {
    const k = c.parent_id || "ROOT";
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  console.log(`\n${cats.length} categories:\n`);
  const walk = (p: string, d: number) => {
    for (const c of byParent.get(p) ?? []) {
      console.log(`  ${"  ".repeat(d)}${d === 0 ? "" : "└ "}${c.title}  [${c.products_count}]`);
      walk(c.id, d + 1);
    }
  };
  walk("ROOT", 0);
  // A parent deleted in Duda strands its children at the root: reachable, but
  // misplaced, and the megamenu would quietly lose a column.
  const orphans = cats.filter(
    (c) => (c.parent_id || "ROOT") !== "ROOT" && !cats.some((x) => x.id === c.parent_id),
  );
  console.log(`\n  orphans (parent missing): ${orphans.length}`);
  for (const o of orphans) console.log(`     ${o.title}`);
  console.log();
}

async function main() {
  const confirm = flag("confirm");

  if (flag("verify")) {
    await verify();
    return;
  }

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

  if (!categories.length) {
    // listAllCategories() falls back to [] — and an empty list would delete
    // every mirror row below, emptying every listing page on the site.
    console.error("\n✗ Duda returned no categories. Refusing to touch Duda or the mirror.\n");
    process.exitCode = 1;
    return;
  }

  let changed = 0;
  let alreadyRight = 0;
  const failures: string[] = [];
  /** Duda's own `seo.url` per category, read below. Never derived. */
  const slugOf = new Map<string, string>();
  /** Duda's re-hosted image URL, so the dashboard list needs no per-row call. */
  const imageOf = new Map<string, string>();

  // Pass 1: read every category, so the plan is known before anything moves.
  const plans: { c: (typeof categories)[number]; have: string[]; want: string[] }[] = [];
  for (const c of categories) {
    const want = (wanted.get(c.id) ?? []).map((p) => p.id);

    /*
     * Every category is read, even when both sides are empty. The summary
     * carries no slug, and the mirror needs one for every category or the
     * listing page cannot resolve that category from its URL.
     */
    try {
      const full = (await duda.getCategory(c.id)) as unknown as {
        products?: { id: string }[];
        seo?: { url?: string };
        image?: { url?: string } | null;
      };
      if (full.seo?.url) slugOf.set(c.id, full.seo.url);
      if (full.image?.url) imageOf.set(c.id, full.image.url);
      plans.push({ c, have: (full.products ?? []).map((p) => p.id), want });
    } catch (err) {
      failures.push(`${c.title}: could not read — ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    }
  }

  const linkedInDuda = plans.reduce((n, p) => n + p.have.length, 0);
  const removals = plans.reduce((n, p) => n + p.have.filter((id) => !p.want.includes(id)).length, 0);
  console.log(`  links in Duda now     : ${linkedInDuda}`);
  console.log(`  links this would drop : ${removals}\n`);

  const refuse = syncRefusal({
    confirm,
    hubLinks: links.length,
    linkedInDuda,
    removals,
    allowRemovals: flag("allow-removals"),
  });

  // Pass 2: write (or, on a dry run or a refusal, only report).
  for (const { c, have, want } of plans) {
    if (sameSet(have, want)) {
      alreadyRight++;
      console.log(`  ⊘ ${c.title.padEnd(44)} already correct (${want.length})`);
      continue;
    }

    const delta = `${have.length} → ${want.length}`;
    if (!confirm || refuse) {
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

  if (refuse) {
    console.error(`\n✗ Refusing to apply: ${refuse}\n  Nothing was written to Duda.\n`);
    process.exitCode = 1;
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
    const imageUrl = imageOf.get(c.id) ?? null;
    await prisma.categoryMirror.upsert({
      where: { dudaCategoryId: c.id },
      update: { title: c.title, slug, parentId: c.parent_id || "ROOT", position: i, imageUrl },
      create: {
        dudaCategoryId: c.id,
        title: c.title,
        slug,
        parentId: c.parent_id || "ROOT",
        position: i,
        imageUrl,
      },
    });
  }
  // A category deleted in Duda must leave the mirror, or the listing offers a
  // filter that matches nothing and links to a 404.
  const dropped = await prisma.categoryMirror.deleteMany({
    where: { dudaCategoryId: { notIn: [...seen] } },
  });

  console.log(`\n=== CATEGORY SYNC ===`);
  console.log(`  mirror rows        : ${seen.size}${dropped.count ? `  (${dropped.count} removed)` : ""}`);
  console.log(`  categories updated : ${changed}${confirm && !refuse ? "" : " (would be)"}`);
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

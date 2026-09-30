/**
 * Fill every category's `seo.title` with its own name.
 *
 * Dry run (default — prints what would change, writes nothing):
 *   npm run duda:category-seo --workspace=backend
 *
 * Apply:
 *   npm run duda:category-seo --workspace=backend -- --confirm
 *
 * Overwrite titles a human already set:
 *   npm run duda:category-seo --workspace=backend -- --confirm --force
 *
 * ⚠️ A category's `seo` is FULL REPLACEMENT on PATCH — unlike a product's,
 * which was probed and found to merge. Sending `{title}` alone here blanks
 * `url` and Duda rejects the write outright with "Category page url cannot be
 * blank". So the current `seo` is read and merged, never assumed.
 *
 * ⚠️ `seo` only comes back from the SINGLE-category GET; `listAllCategories()`
 * omits it entirely. One read per category is therefore unavoidable, not an
 * N+1 that could be batched away.
 */
import "dotenv/config";
import { duda } from "../services/duda.js";

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gentle pacing — services/duda.ts has no rate-limit handling of its own. */
const DELAY_MS = 250;

async function main() {
  const confirm = flag("confirm");
  const force = flag("force");

  const cats = await duda.listAllCategories();
  console.log(`\n${confirm ? "Writing" : "Dry run —"} SEO titles for ${cats.length} categories\n`);

  let changed = 0;
  let already = 0;
  let kept = 0;
  const failures: string[] = [];

  for (const c of cats) {
    let current: { url?: string; title?: string; description?: string } | undefined;
    try {
      current = ((await duda.getCategory(c.id)) as unknown as { seo?: typeof current }).seo;
    } catch (err) {
      failures.push(`${c.title}: could not read — ${err instanceof Error ? err.message.slice(0, 100) : err}`);
      continue;
    }

    const want = c.title.trim();
    if ((current?.title ?? "") === want) {
      already++;
      console.log(`  ⊘ ${c.title.padEnd(46)} already "${want}"`);
      continue;
    }
    // Anything a human wrote beats anything generated.
    if (current?.title && !force) {
      kept++;
      console.log(`  ⊘ ${c.title.padEnd(46)} keeping "${current.title}" (--force to replace)`);
      continue;
    }

    if (!confirm) {
      changed++;
      console.log(`  → ${c.title.padEnd(46)} "${current?.title ?? ""}" → "${want}"`);
      continue;
    }

    try {
      // Merged, not replaced — `url` is the live page URL and dropping it is
      // both rejected and, if it were not, a 404 on a public page.
      await duda.updateCategory(c.id, { seo: { ...current, title: want } });
      changed++;
      console.log(`  ✓ ${c.title.padEnd(46)} "${want}"`);
      await sleep(DELAY_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 140) : String(err);
      failures.push(`${c.title}: ${msg}`);
      console.log(`  ✗ ${c.title.padEnd(46)} ${msg}`);
    }
  }

  console.log(`\n=== CATEGORY SEO ===`);
  console.log(`  written        : ${changed}${confirm ? "" : " (would be)"}`);
  console.log(`  already correct: ${already}`);
  console.log(`  human-set, kept: ${kept}`);
  console.log(`  failed         : ${failures.length}`);
  for (const f of failures) console.log(`     ${f}`);
  console.log(confirm ? "" : `\n  Re-run with --confirm to apply.\n`);
}

main().catch((err) => {
  console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});

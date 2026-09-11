import "dotenv/config";
import { duda } from "../services/duda.js";
import { syncHubProduct } from "../services/hubProduct.js";
import { prisma } from "../prisma.js";

/**
 * Convert SHOUTED product names to sentence case, in Duda.
 *
 *   npm run duda:fix-casing --workspace=backend            # preview, writes nothing
 *   npm run duda:fix-casing --workspace=backend -- --confirm
 *
 * ⚠️ Verified before writing anything: a case-only rename does NOT change
 * Duda's auto-generated `seo.product_url`. Probed on a throwaway product —
 * created "ZZ AUDIT SLUG PROBE WIDGET" (slug zz-audit-slug-probe-widget),
 * renamed it to "ZZ Audit Slug Probe Widget", slug unchanged, deleted it. Had
 * the slug followed the name, this script would have silently changed 20
 * public URLs and 404'd every existing link to them.
 *
 * ⚠️ Only names that are ENTIRELY upper case are touched. 76 of the 96 are
 * already styled correctly, and running a title-caser over them would
 * capitalise words like "with" and "for" that are deliberately lower.
 */

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);

const shouting = (n: string) => n === n.toUpperCase() && /[A-Z]{2,}/.test(n);

/**
 * Tokens to leave upper-case, learned from the catalogue rather than guessed.
 *
 * Two sources, because neither alone is enough:
 *  - all-caps tokens inside names that are ALREADY correctly styled — this is
 *    the house style stating itself (EX, LED, LEV, PU, PVC, KVA…);
 *  - every SKU, because a product code inside a name is a code, not a word.
 *    "COMPACT FILTRATION UNIT (SAECFU)" carries its SKU to clear a
 *    duplicate-title collision, and SAECFU appears in no styled name, so the
 *    first source alone produced "Saecfu".
 */
function learnAcronyms(styledNames: string[], skus: (string | null)[]): Set<string> {
  const set = new Set<string>();
  for (const n of styledNames) {
    for (const tok of n.split(/[\s/()\-]+/)) {
      const letters = tok.replace(/[^A-Za-z]/g, "");
      if (letters.length >= 2 && letters === letters.toUpperCase()) set.add(letters.toUpperCase());
    }
  }
  for (const sku of skus) {
    const letters = (sku ?? "").replace(/[^A-Za-z]/g, "");
    if (letters.length >= 2) set.add(letters.toUpperCase());
  }
  return set;
}

function titleCaseName(name: string, acronyms: Set<string>): string {
  const t = name.trim();
  if (!t || !shouting(t)) return t;
  return t
    .split(/(\s+)/)
    .map((tok) => {
      if (/^\s+$/.test(tok) || !tok) return tok;
      // A token with a digit is a measurement or a code — 3.8KVA, 400VA, 100.
      // Its casing cannot be inferred, and guessing wrong is worse than loud.
      if (/\d/.test(tok)) return tok;
      return tok.replace(/[A-Za-z]+/g, (run) =>
        acronyms.has(run.toUpperCase())
          ? run.toUpperCase()
          : run.charAt(0).toUpperCase() + run.slice(1).toLowerCase(),
      );
    })
    .join("");
}

async function main() {
  const hub = await prisma.hubProduct.findMany({
    select: { dudaProductId: true, name: true, sku: true, slug: true },
  });
  const named = hub.filter((p): p is typeof p & { name: string } => !!p.name);

  const acronyms = learnAcronyms(
    named.filter((p) => !shouting(p.name)).map((p) => p.name),
    named.map((p) => p.sku),
  );

  const work = named
    .filter((p) => shouting(p.name))
    .map((p) => ({ ...p, next: titleCaseName(p.name, acronyms) }))
    .filter((p) => p.next !== p.name);

  console.log(`\n${named.length} products, ${work.length} shouting\n`);
  for (const p of work) console.log(`  ${p.name}\n    → ${p.next}`);

  if (!work.length) return;
  if (!flag("confirm")) {
    console.log("\n(preview only — add --confirm to write these to Duda)\n");
    return;
  }

  console.log("\nWriting to Duda…\n");
  let ok = 0;
  const problems: string[] = [];
  for (const p of work) {
    try {
      const updated = await duda.updateProduct(p.dudaProductId, { name: p.next });
      // The slug should be untouched; say so loudly if Duda disagrees, because
      // a changed slug is a broken public URL.
      const slug = updated.seo?.product_url ?? null;
      if (p.slug && slug && slug !== p.slug) {
        problems.push(`${p.next}: slug CHANGED ${p.slug} → ${slug}`);
      }
      await syncHubProduct(updated);
      ok++;
      console.log(`  ✓ ${p.next}`);
    } catch (err) {
      problems.push(`${p.name}: ${err instanceof Error ? err.message.slice(0, 140) : "?"}`);
    }
  }

  console.log(`\n=== ${ok}/${work.length} renamed ===`);
  for (const pr of problems) console.log(`  ⚠ ${pr}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

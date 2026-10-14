/**
 * Make the category tree match the master lists (SA Equip product assignment,
 * Phase 1 Step 2 — see docs/sa-equip-phase0/CURSOR_BRIEF.md).
 *
 *   npm run taxonomy:setup --workspace=backend -- --master ../docs/sa-equip-phase0/sa-equip-products.json
 *   npm run taxonomy:setup --workspace=backend -- --master <file> --confirm
 *
 * Dry run by default: prints what it would create and order, writes nothing.
 *
 * For each of the three parents ("Site Challenges", "Industries", "Products"):
 *   - a master entry that already exists (EXACT title, under that parent) is
 *     reused, never duplicated;
 *   - a missing one is created under that parent, with a clean slug and an
 *     SEO title of its own name (a new category otherwise has none — the
 *     one-off duda:category-seo only covered the original 23);
 *   - a child that is NOT in the master list is reported, never deleted;
 *   - the Hub's order for the parent's children is set to the master order
 *     (CategoryOrder — the Hub's listings and filters only; Duda's own menus
 *     are arranged in Duda).
 *
 * ⚠️ Assigns NO products. And a category's `seo` is FULL REPLACEMENT on PATCH
 * (an incomplete one blanks the page URL), so any SEO write sends url + title.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../prisma.js";
import { duda } from "../services/duda.js";
import { slugFor } from "./lib/slug.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ROOT = "ROOT";


async function main() {
  const masterPath = arg("master");
  if (!masterPath) throw new Error("pass --master <path to sa-equip-products.json>");
  const meta = JSON.parse(readFileSync(masterPath, "utf8")).meta as {
    site_challenge_menu: Record<string, string[]>;
    industries: string[];
    top_level_categories: string[];
  };
  const plan: { parent: string; children: string[] }[] = [
    { parent: "Site Challenges", children: Object.values(meta.site_challenge_menu).flat() },
    { parent: "Industries", children: meta.industries },
    { parent: "Products", children: meta.top_level_categories },
  ];

  const flat = await duda.listAllCategories();
  const usedSlugs = new Set<string>();
  for (const c of flat) {
    const full = (await duda.getCategory(c.id)) as unknown as { seo?: { url?: string } };
    if (full.seo?.url) usedSlugs.add(full.seo.url);
    await sleep(120);
  }

  console.log(`\n${confirm ? "Applying" : "Dry run —"} taxonomy setup against ${flat.length} Duda categories\n`);
  let created = 0;
  let ordered = 0;

  for (const { parent, children } of plan) {
    const parentRow = flat.filter((c) => (c.parent_id || ROOT) === ROOT && c.title === parent);
    if (parentRow.length !== 1) throw new Error(`expected exactly one top-level "${parent}", found ${parentRow.length}`);
    const parentId = parentRow[0].id;
    const existing = flat.filter((c) => c.parent_id === parentId);
    const byTitle = new Map(existing.map((c) => [c.title, c]));
    if (byTitle.size !== existing.length) throw new Error(`"${parent}" has two children with the same title — resolve by hand first`);

    console.log(`${parent}  (${parentId})`);
    const ids: string[] = [];
    for (const title of children) {
      const hit = byTitle.get(title);
      if (hit) {
        console.log(`  ✓ exists   ${title}`);
        ids.push(hit.id);
        continue;
      }
      const slug = slugFor(title);
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`bad slug for "${title}": ${slug}`);
      if (usedSlugs.has(slug)) throw new Error(`slug "${slug}" for "${title}" is already used by another category`);
      if (!confirm) {
        console.log(`  + create   ${title}   → /category/${slug}   SEO title "${title}"`);
        ids.push(`(new: ${title})`);
        continue;
      }
      const made = await duda.createCategory({ title, parent_id: parentId, seo: { url: slug, title } });
      // Duda may ignore seo on create; read back and set it whole if so.
      let full = (await duda.getCategory(made.id)) as unknown as { seo?: { url?: string; title?: string } };
      if (full.seo?.url !== slug || full.seo?.title !== title) {
        await duda.updateCategory(made.id, { seo: { ...(full.seo ?? {}), url: slug, title } });
        full = (await duda.getCategory(made.id)) as unknown as { seo?: { url?: string; title?: string } };
      }
      if (full.seo?.url !== slug) throw new Error(`"${title}" was created (${made.id}) but its slug is ${full.seo?.url}, not ${slug}`);
      await prisma.categoryMirror.upsert({
        where: { dudaCategoryId: made.id },
        update: { title, slug, parentId },
        create: { dudaCategoryId: made.id, title, slug, parentId, position: 0 },
      });
      usedSlugs.add(slug);
      created++;
      ids.push(made.id);
      console.log(`  + created  ${title}   ${made.id}   /category/${slug}`);
      await sleep(300);
    }
    for (const c of existing) if (!children.includes(c.title)) console.log(`  ! extra    ${c.title}   (not in the master list — left alone)`);

    if (confirm) {
      // Exactly this parent's children, master entries first in master order,
      // anything extra after them — the reorder route's own rule.
      const extras = existing.filter((c) => !children.includes(c.title)).map((c) => c.id);
      const all = [...ids, ...extras];
      await prisma.$transaction(
        all.map((id, i) =>
          prisma.categoryOrder.upsert({ where: { dudaCategoryId: id }, update: { sortOrder: i }, create: { dudaCategoryId: id, sortOrder: i } }),
        ),
      );
      ordered += all.length;
    }
    console.log(`  order      ${confirm ? "set to" : "would be"} the master order (${children.length})\n`);
  }

  console.log(confirm ? `✓ ${created} created, ${ordered} ordered. No products assigned.` : "Re-run with --confirm to apply.");
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

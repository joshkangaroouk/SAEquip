/**
 * Add ONE Site Challenge, place it in the Hub's order, and assign it to named
 * products (Josh, 14 Oct 2026: "Temporary Lighting" for the 4 SA ENDURE lights).
 *
 *   npm run catalogue:add-challenge --workspace=backend -- --title "Temporary Lighting" \
 *     --after "Shutdown and Turnaround Packages" --products <dudaId,dudaId,…> [--confirm]
 *
 * - Reuses a challenge that already exists with that exact title; otherwise
 *   creates it under "Site Challenges" with a clean slug and an SEO title of
 *   its own name, reads it back, and mirrors it (the same steps as
 *   taxonomy:setup).
 * - CategoryOrder: inserted straight after `--after`; the challenges below it
 *   move down one. Duda's own menus are arranged by hand in Duda.
 * - Each product gets the challenge ADDED (with the Site Challenges parent);
 *   nothing else it is in is touched. Its display order puts the new challenge
 *   after any challenge the product already has.
 * Dry run by default; then `duda:sync-categories`.
 */
import "dotenv/config";
import { prisma } from "../prisma.js";
import { CATEGORY_ROOT, duda } from "../services/duda.js";
import { slugFor } from "./lib/slug.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const title = arg("title"), after = arg("after"), productArg = arg("products");
  if (!title || !after || !productArg) throw new Error('pass --title "…" --after "…" --products <dudaId,…>');
  const productIds = productArg.split(",").map((s) => s.trim()).filter(Boolean);
  const slug = slugFor(title);

  const flat = await duda.listAllCategories();
  const parent = flat.filter((c) => (c.parent_id || CATEGORY_ROOT) === CATEGORY_ROOT && c.title === "Site Challenges");
  if (parent.length !== 1) throw new Error(`expected one top-level "Site Challenges", found ${parent.length}`);
  const sc = parent[0];
  const kids = flat.filter((c) => c.parent_id === sc.id);
  const existing = kids.find((c) => c.title === title);
  const anchor = kids.find((c) => c.title === after);
  if (!anchor) throw new Error(`no challenge "${after}" to place it after`);
  if (!existing) {
    // The slug must be free across ALL categories (one read each; the list omits seo).
    for (const c of flat) {
      const full = (await duda.getCategory(c.id)) as unknown as { seo?: { url?: string } };
      if (full.seo?.url === slug) throw new Error(`slug "${slug}" is already used by "${c.title}"`);
      await sleep(100);
    }
  }

  const hub = await prisma.hubProduct.findMany({ where: { dudaProductId: { in: productIds } }, select: { id: true, dudaProductId: true, name: true, status: true } });
  if (hub.length !== productIds.length) throw new Error(`no Hub row for ${productIds.filter((id) => !hub.some((h) => h.dudaProductId === id)).join(", ")}`);
  const order = await prisma.categoryOrder.findMany({ where: { dudaCategoryId: { in: kids.map((k) => k.id) } } });
  const pos = new Map(order.map((o) => [o.dudaCategoryId, o.sortOrder]));
  if (pos.size !== kids.length) throw new Error("not every Site Challenge has a Hub position — run taxonomy:setup first");
  const at = pos.get(anchor.id)! + 1;
  const toShift = kids.filter((k) => k.id !== existing?.id && pos.get(k.id)! >= at);

  console.log(`\n${confirm ? "Applying" : "Dry run —"} Site Challenge "${title}"`);
  console.log(`  ${existing ? `exists (${existing.id})` : `create under Site Challenges: /category/${slug}, SEO title "${title}"`}`);
  console.log(`  order: position ${at}, after "${after}"; ${toShift.length} challenge(s) below move down one (${toShift.map((k) => k.title).join(", ")})`);
  for (const h of hub) console.log(`  assign: ${h.name} (${h.status})`);
  if (!confirm) { console.log("\nNothing written.\n"); return; }

  let id = existing?.id;
  if (!id) {
    const made = await duda.createCategory({ title, parent_id: sc.id, seo: { url: slug, title } });
    let full = (await duda.getCategory(made.id)) as unknown as { seo?: { url?: string; title?: string } };
    if (full.seo?.url !== slug || full.seo?.title !== title) {
      await duda.updateCategory(made.id, { seo: { ...(full.seo ?? {}), url: slug, title } });
      full = (await duda.getCategory(made.id)) as unknown as { seo?: { url?: string; title?: string } };
    }
    if (full.seo?.url !== slug) throw new Error(`created ${made.id} but its slug is ${full.seo?.url}`);
    id = made.id;
    console.log(`  ✓ created ${title} (${id}) /category/${slug}`);
  }
  await prisma.categoryMirror.upsert({
    where: { dudaCategoryId: id },
    update: { title, slug, parentId: sc.id },
    create: { dudaCategoryId: id, title, slug, parentId: sc.id, position: 0 },
  });
  await prisma.$transaction([
    ...toShift.map((k) => prisma.categoryOrder.update({ where: { dudaCategoryId: k.id }, data: { sortOrder: pos.get(k.id)! + 1 } })),
    prisma.categoryOrder.upsert({ where: { dudaCategoryId: id }, update: { sortOrder: at }, create: { dudaCategoryId: id, sortOrder: at } }),
  ]);
  for (const h of hub) {
    const mine = await prisma.productCategory.findMany({ where: { hubProductId: h.id, dudaCategoryId: { in: kids.map((k) => k.id) } } });
    const next = mine.reduce((m, l) => Math.max(m, (l.sortOrder ?? -1) + 1), 0);
    await prisma.productCategory.createMany({
      data: [
        { hubProductId: h.id, dudaCategoryId: sc.id },
        { hubProductId: h.id, dudaCategoryId: id, sortOrder: next },
      ],
      skipDuplicates: true,
    });
  }
  const linked = await prisma.productCategory.count({ where: { dudaCategoryId: id } });
  console.log(`  ✓ order set; ${linked} product(s) linked to ${title}`);
  console.log(`\n✓ Applied. Next: npm run duda:sync-categories --workspace=backend (dry run), then -- --confirm.\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

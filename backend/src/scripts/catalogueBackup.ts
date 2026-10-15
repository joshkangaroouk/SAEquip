/**
 * Export everything a catalogue/taxonomy change can touch, BEFORE touching it.
 * Read-only: Duda GETs and database reads; it writes only JSON files.
 *
 *   npm run catalogue:backup --workspace=backend -- --out ../migration/backups/<dir>
 *
 * ⚠️ There are no database backups on this Supabase tier, so these files are
 * the restore point for any taxonomy, category-link or logo change. Each run
 * writes a fresh, timestamped manifest with the counts it found — check them
 * against what you expect before writing anything.
 *
 * Writes (all JSON):
 *   hub-product-categories   every ProductCategory row (product's Duda id → category id)
 *   hub-category-mirror      CategoryMirror (the Hub's copy of Duda's tree)
 *   hub-category-order       CategoryOrder (the Hub's drag order)
 *   hub-logos                the Logo catalogue (label, alt, kind, file)
 *   hub-product-logos        every ProductLogo row (the logo toggles)
 *   hub-products             each HubProduct's ids, name, SKU, slug, status, accessory flag
 *   hub-translations-logo    Translation rows of kind LOGO_TEXT
 *   hub-duda-translations    DudaTranslation rows for categories
 *   duda-categories          every Duda category, from its single-category GET
 *                            (title, parent, seo, image and its product list)
 *   duda-products            every Duda product (name, SKU, status, categories,
 *                            and its attached options and variations)
 *   duda-options             the store's option catalogue (options are store-level)
 *   manifest                 counts and when
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { duda } from "../services/duda.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const out = arg("out");
  if (!out) throw new Error("pass --out <directory>");
  const dir = path.resolve(process.cwd(), out);
  mkdirSync(dir, { recursive: true });
  const save = (name: string, data: unknown) => writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2) + "\n");

  const [links, mirror, order, logos, productLogos, products, logoText, dudaNames] = await Promise.all([
    prisma.productCategory.findMany({
      select: { dudaCategoryId: true, sortOrder: true, hubProduct: { select: { dudaProductId: true, name: true } } },
      orderBy: [{ dudaCategoryId: "asc" }],
    }),
    prisma.categoryMirror.findMany(),
    prisma.categoryOrder.findMany(),
    prisma.logo.findMany({ include: { mediaAsset: { select: { id: true, filename: true } } }, orderBy: { sortOrder: "asc" } }),
    prisma.productLogo.findMany({ select: { logoId: true, hubProduct: { select: { dudaProductId: true, name: true } } } }),
    prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true, sku: true, slug: true, status: true, isAccessory: true } }),
    prisma.translation.findMany({ where: { kind: "LOGO_TEXT" } }),
    prisma.dudaTranslation.findMany({ where: { entity: "CATEGORY" } }),
  ]);
  save("hub-product-categories", links.map((l) => ({ dudaCategoryId: l.dudaCategoryId, sortOrder: l.sortOrder, dudaProductId: l.hubProduct.dudaProductId, product: l.hubProduct.name })));
  save("hub-category-mirror", mirror);
  save("hub-category-order", order);
  save("hub-logos", logos);
  save("hub-product-logos", productLogos.map((p) => ({ logoId: p.logoId, dudaProductId: p.hubProduct.dudaProductId, product: p.hubProduct.name })));
  save("hub-products", products);
  save("hub-translations-logo", logoText);
  save("hub-duda-translations", dudaNames);

  const list = await duda.listAllCategories();
  const categories = [];
  for (const c of list) {
    categories.push(await duda.getCategory(c.id));
    await sleep(150); // services/duda.ts has no rate-limit handling of its own
  }
  save("duda-categories", categories);

  const dudaProducts = (await duda.listAllProducts()).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    status: p.status,
    categories: (p as unknown as { categories?: unknown[] }).categories ?? [],
    // Changing a product's options regenerates its variations and blanks their
    // SKUs and prices, so both are kept for a restore.
    options: p.options ?? [],
    variations: p.variations ?? [],
  }));
  save("duda-products", dudaProducts);
  save("duda-options", (await duda.listOptions()).results ?? []);

  const counts = {
    productCategories: links.length,
    categoryMirror: mirror.length,
    categoryOrder: order.length,
    logos: logos.length,
    productLogos: productLogos.length,
    hubProducts: products.length,
    logoTextTranslations: logoText.length,
    dudaCategoryTranslations: dudaNames.length,
    dudaCategories: categories.length,
    dudaProducts: dudaProducts.length,
  };
  save("manifest", { at: new Date().toISOString(), site: process.env.DUDA_SITE_NAME ?? "(default)", counts });
  console.log(`Backed up to ${dir}`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(26)} ${v}`);
}

main()
  .catch((err) => {
    console.error("\n✗ Backup failed:", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

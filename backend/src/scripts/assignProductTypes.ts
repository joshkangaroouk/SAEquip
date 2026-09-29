/**
 * Assign each product to one of the three PRODUCT-TYPE categories, derived
 * from the WooCommerce export.
 *
 * Dry run (default — prints the mapping, writes nothing):
 *   npm run duda:assign-product-types --workspace=backend
 *
 * Apply (writes ProductCategory rows; run duda:sync-categories afterwards):
 *   npm run duda:assign-product-types --workspace=backend -- --confirm
 *
 * ⚠️ PRODUCT TYPES ONLY. Industries and Site Challenges are new taxonomy with
 * no equivalent in the export — "Welding Fume Control" appears nowhere in the
 * source data — so those stay manual. Guessing them from loosely related
 * WooCommerce terms would produce a wrong-but-plausible result that nobody
 * would question, which is exactly how `Cross-sells` nearly became the
 * compatible-products list.
 *
 * ⚠️ Additive: existing assignments to OTHER categories are left alone. Only
 * the three product-type categories are rewritten, so running this cannot
 * clear an Industry someone has already ticked by hand.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";
import { duda } from "../services/duda.js";

const prisma = new PrismaClient();

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const CSV = "../migration/wc-export-2026-09-07.csv";

/**
 * WooCommerce category → the product-type category it belongs to.
 *
 * The Rental variants fold into the same type: "Portable EX Lighting Rental"
 * is the same kind of product, hired rather than sold, and the hire/purchase
 * distinction is not what this axis is for.
 */
const TYPE_OF: Record<string, string> = {
  "portable ex ventilation": "Fume, Dust, LEV and Vapour Control",
  "portable ex ventilation rental": "Fume, Dust, LEV and Vapour Control",
  "portable ex lighting": "Lighting and Power",
  "portable ex lighting rental": "Lighting and Power",
  "portable ex power distribution": "Lighting and Power",
  "portable ex power rental": "Lighting and Power",
  "portable lighting & power": "Lighting and Power",
  "portable ex heating": "Climate Control and Heating",
  "portable ex heating rental": "Climate Control and Heating",
  "portable ex climate control": "Climate Control and Heating",
};

async function main() {
  const confirm = flag("confirm");

  const rows = parse(readFileSync(CSV), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  const published = rows.filter((r) => r["Type"] !== "variation" && r["Published"] === "1");

  const cats = await duda.listAllCategories();
  const idOf = new Map(cats.map((c) => [c.title.toLowerCase(), c.id]));
  const typeIds = [...new Set(Object.values(TYPE_OF))].map((title) => {
    const id = idOf.get(title.toLowerCase());
    if (!id) fail(`No category titled “${title}” — run duda:seed-category-tree first.`);
    return id!;
  });

  const hubBySku = new Map(
    (await prisma.hubProduct.findMany({ select: { id: true, sku: true, name: true } }))
      .filter((h) => h.sku)
      .map((h) => [h.sku!.toLowerCase(), h]),
  );

  let assigned = 0;
  const unmatched: string[] = [];
  const noHub: string[] = [];
  const perType = new Map<string, number>();
  const writes: { hubProductId: string; dudaCategoryId: string }[] = [];

  for (const r of published) {
    const sku = String(r["SKU"] ?? "").trim();
    const name = String(r["Name"] ?? "").trim();
    const wooCats = String(r["Categories"] ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const titles = [...new Set(wooCats.map((c) => TYPE_OF[c]).filter(Boolean))];
    if (!titles.length) {
      unmatched.push(`${sku || "(no sku)"} ${name}`);
      continue;
    }

    const hub = sku ? hubBySku.get(sku.toLowerCase()) : undefined;
    if (!hub) {
      noHub.push(`${sku || "(no sku)"} ${name}`);
      continue;
    }

    for (const t of titles) {
      writes.push({ hubProductId: hub.id, dudaCategoryId: idOf.get(t.toLowerCase())! });
      perType.set(t, (perType.get(t) ?? 0) + 1);
    }
    assigned++;
  }

  console.log(`\n${confirm ? "Assigning" : "Dry run —"} product types for ${published.length} published product(s)\n`);
  for (const [title, n] of [...perType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${title}`);
  }
  console.log(`\n  products matched  : ${assigned}`);
  console.log(`  links to write    : ${writes.length}`);
  console.log(`  no type in the CSV: ${unmatched.length}`);
  console.log(`  no Hub row by SKU : ${noHub.length}`);

  if (unmatched.length) {
    console.log(`\n  ⚠ no product type could be derived for these — assign by hand:`);
    for (const u of unmatched) console.log(`     ${u}`);
  }
  if (noHub.length) {
    console.log(`\n  ⚠ in the CSV but no Hub product with that SKU:`);
    for (const n of noHub) console.log(`     ${n}`);
  }

  if (!confirm) {
    console.log(`\n  Re-run with --confirm to write, then: npm run duda:sync-categories -- --confirm\n`);
    return;
  }

  // Replace only the THREE product-type links per product; anything else the
  // product is in (an Industry, a Site Challenge) is untouched.
  await prisma.$transaction(async (tx) => {
    await tx.productCategory.deleteMany({ where: { dudaCategoryId: { in: typeIds } } });
    await tx.productCategory.createMany({ data: writes, skipDuplicates: true });
  });
  console.log(`\n  ✓ ${writes.length} link(s) written. Next: npm run duda:sync-categories --workspace=backend -- --confirm\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

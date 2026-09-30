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
import { PrismaClient } from "@prisma/client";
import { duda } from "../services/duda.js";
import { parsePublishedProducts, productCategories, saRangeLogos } from "../services/wooImport.js";

const prisma = new PrismaClient();

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const CSV = "../migration/wc-export-2026-09-07.csv";
const LEDGER = "../migration/ledger.json";

/**
 * The top-level parent. Every product is linked to it as well as to its type,
 * so Duda's own `products_count` and storefront see the full catalogue under
 * Products rather than 0.
 *
 * ⚠️ The listing widget does NOT need this — it already scopes a parent page
 * to the parent plus its children, so /category/products showed all 96 before
 * these links existed. This is for Duda's side of the tree.
 */
const PARENT = "Products";

const FUME = "Fume, Dust, LEV and Vapour Control";
const LIGHT = "Lighting and Power";
const CLIMATE = "Climate Control and Heating";

/**
 * WooCommerce category → product type. Covers 68 of the 96.
 *
 * The Rental variants fold into the same type: "Portable EX Lighting Rental"
 * is the same kind of product, hired rather than sold, and the hire/purchase
 * distinction is not what this axis is for.
 */
const TYPE_OF: Record<string, string> = {
  "portable ex ventilation": FUME,
  "portable ex ventilation rental": FUME,
  "portable ex lighting": LIGHT,
  "portable ex lighting rental": LIGHT,
  "portable ex power distribution": LIGHT,
  "portable ex power rental": LIGHT,
  "portable lighting & power": LIGHT,
  "portable ex heating": CLIMATE,
  "portable ex heating rental": CLIMATE,
  "portable ex climate control": CLIMATE,
};

/**
 * SA product range → product type, the fallback for the 28 products whose
 * WooCommerce categories carry only industry sectors.
 *
 * ⚠️ These are the SAME ranges `saRangeLogos()` already derives for the logo
 * import, reused rather than re-derived — including its two Tasklight
 * overrides, which is how the 2 SKU-less products get a type at all. A second
 * copy of the category→range matching would be a second thing to keep in step.
 *
 * `Rental` is deliberately absent: it is orthogonal to the ranges (a product
 * is both `SA Cyclone` and `Rental`) and says nothing about what the product
 * IS. `Endure` is absent because it spans two types — see below.
 */
const TYPE_OF_RANGE: Record<string, string> = {
  Lumin: LIGHT,
  Powernet: LIGHT,
  Cyclone: FUME,
  Flexiheat: CLIMATE,
};

/**
 * ⚠️ SA ENDURE is the one range that is NOT a product type. It is the
 * non-EX/general-industrial line and spans both lighting and extraction, so
 * each of its products needs an explicit decision. Keyed on WordPress id,
 * like `SA_RANGE_OVERRIDES`, because that is the migration's only reliable
 * identity — 3 products have no SKU and 4 SKUs are shared by 9 products.
 *
 * An ENDURE product missing from this map is a HARD FAILURE rather than a
 * guess: a new one added to the range later must be classified deliberately,
 * not filed wherever a keyword match happens to land it.
 */
const ENDURE_TYPE: Record<string, string> = {
  "9049": LIGHT, // SAWL — LED Worklamp
  "9305": LIGHT, // ST100 — LED Tubelight
  "9346": LIGHT, // STE100 — LED Emergency Tubelight
  "12626": FUME, // SEF35 — AIR MOVER
  "15464": FUME, // SEF35HP — HIGH POWER AIR MOVER
  "15476": FUME, // SAECFU — COMPACT FILTRATION UNIT
  "28972": FUME, // SAELFU — LIGHTWEIGHT FILTRATION UNIT
  "29036": FUME, // SAEWFS — MOBILE LEV SYSTEM
  "29166": FUME, // SAEWFP — PORTABLE LEV SYSTEM
  "29812": FUME, // SEFD — PVC FLEXIBLE DUCT SYSTEM
  "30437": FUME, // SAEWFC — CONTAINER LEV SYSTEM
};

interface LedgerEntry {
  dudaProductId: string;
}

async function main() {
  const confirm = flag("confirm");

  const products = parsePublishedProducts(readFileSync(CSV, "utf8"));

  /*
   * ⚠️ The Hub row is found through the LEDGER (wpId → dudaProductId), never
   * by SKU. SKU cannot identify a product here: 3 of the 96 have none and 4
   * SKUs are shared by 9 products, so a SKU-keyed map silently collapses each
   * pair onto one row — assigning one twin twice and the other never, with
   * nothing in the output to show it happened.
   */
  const ledger = JSON.parse(readFileSync(LEDGER, "utf8")) as Record<string, LedgerEntry>;

  const cats = await duda.listAllCategories();
  const idOf = new Map(cats.map((c) => [c.title.toLowerCase(), c.id]));
  // Every category this script OWNS — the three types plus their parent. The
  // delete-then-recreate below is scoped to exactly these, so an Industry or a
  // Site Challenge ticked by hand is never touched.
  const ownedIds = [FUME, LIGHT, CLIMATE, PARENT].map((title) => {
    const id = idOf.get(title.toLowerCase());
    if (!id) fail(`No category titled “${title}” — run duda:seed-category-tree first.`);
    return id!;
  });
  const parentId = idOf.get(PARENT.toLowerCase())!;

  const hubByDudaId = new Map(
    (await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true } })).map(
      (h) => [h.dudaProductId, h],
    ),
  );

  let assigned = 0;
  const unmatched: string[] = [];
  const noHub: string[] = [];
  const perType = new Map<string, number>();
  const bySource = new Map<string, number>();
  const writes: { hubProductId: string; dudaCategoryId: string }[] = [];

  for (const p of products) {
    const label = `${p.sku || "(no sku)"} ${p.name}`;

    // 1. The WooCommerce product category, where there is one.
    // ⚠️ Distinct titles, not the first match: none of the 96 sits in two
    // product-type categories today (checked), but picking arbitrarily from a
    // future one that does would file it wrongly without saying so.
    const wooCats = productCategories(p.raw).map((c) => c.toLowerCase());
    const wooTypes = [...new Set(wooCats.map((c) => TYPE_OF[c]).filter(Boolean))];
    if (wooTypes.length > 1) {
      fail(`wp#${p.wpId} ${label} is in ${wooTypes.length} product-type categories: ${wooTypes.join(", ")}`);
    }
    let title = wooTypes[0];
    let source = "woo category";

    // 2. Otherwise the SA range, which every remaining product carries.
    if (!title) {
      const ranges = saRangeLogos(p).filter((r) => r !== "Rental");
      if (ranges.includes("Endure")) {
        title = ENDURE_TYPE[p.wpId];
        source = "ENDURE (explicit)";
        if (!title) {
          fail(
            `SA ENDURE product with no explicit type: wp#${p.wpId} ${label}.\n` +
              `  ENDURE spans lighting AND extraction, so add it to ENDURE_TYPE by hand.`,
          );
        }
      } else {
        const mapped = [...new Set(ranges.map((r) => TYPE_OF_RANGE[r]).filter(Boolean))];
        // Two ranges disagreeing is a content question, not something to pick.
        if (mapped.length > 1) fail(`wp#${p.wpId} ${label} maps to ${mapped.length} types: ${mapped.join(", ")}`);
        title = mapped[0];
        source = "SA range";
      }
    }

    if (!title) {
      unmatched.push(label);
      continue;
    }

    const dudaId = ledger[p.wpId]?.dudaProductId;
    const hub = dudaId ? hubByDudaId.get(dudaId) : undefined;
    if (!hub) {
      noHub.push(`${label}${dudaId ? "" : "  (not in the ledger)"}`);
      continue;
    }

    writes.push({ hubProductId: hub.id, dudaCategoryId: idOf.get(title.toLowerCase())! });
    writes.push({ hubProductId: hub.id, dudaCategoryId: parentId });
    perType.set(title, (perType.get(title) ?? 0) + 1);
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    assigned++;
  }

  console.log(`\n${confirm ? "Assigning" : "Dry run —"} product types for ${products.length} published product(s)\n`);
  for (const [title, n] of [...perType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${title}`);
  }
  console.log(`  ${String(assigned).padStart(3)}  ${PARENT}  (the parent — every product also sits here)`);
  console.log(`\n  derived from:`);
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${src}`);
  }
  console.log(`\n  products matched  : ${assigned} of ${products.length}`);
  console.log(`  links to write    : ${writes.length}  (one type + one parent each)`);
  console.log(`  no type derivable : ${unmatched.length}`);
  console.log(`  no Hub row        : ${noHub.length}`);

  if (unmatched.length) {
    console.log(`\n  ⚠ no product type could be derived for these — assign by hand:`);
    for (const u of unmatched) console.log(`     ${u}`);
  }
  if (noHub.length) {
    console.log(`\n  ⚠ in the CSV but no Hub product:`);
    for (const n of noHub) console.log(`     ${n}`);
  }

  if (!confirm) {
    console.log(`\n  Re-run with --confirm to write, then: npm run duda:sync-categories -- --confirm\n`);
    return;
  }

  // Replace only the links this script owns; anything else the product is in
  // (an Industry, a Site Challenge) is untouched.
  await prisma.$transaction(async (tx) => {
    await tx.productCategory.deleteMany({ where: { dudaCategoryId: { in: ownedIds } } });
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

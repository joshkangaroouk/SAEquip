/**
 * Set HubProduct.isAccessory from SA Equip's sheet (its Accessory column,
 * `internal_reference.accessory`), matched by Duda id (Josh, 14 Oct 2026).
 *
 *   npm run catalogue:accessories --workspace=backend -- --master ../docs/sa-equip-phase0/sa-equip-products.json [--confirm]
 *
 * Only products the sheet names with a true/false value are written; anything
 * else (the new SA ENDURE LED Max Light, the hidden rentals) keeps its current
 * value, which defaults to false. Staff change it afterwards with the switch
 * in the product editor. Dry run by default.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../prisma.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");

type Row = { duda_product_id: string | null; duda_name: string | null; internal_reference?: { accessory?: unknown } };

async function main() {
  const master = arg("master");
  if (!master) throw new Error("pass --master <path to sa-equip-products.json>");
  const sheet = JSON.parse(readFileSync(master, "utf8")) as { products: Row[] };
  const want = new Map<string, boolean>();
  for (const r of sheet.products) {
    const v = r.internal_reference?.accessory;
    if (!r.duda_product_id || typeof v !== "boolean") continue;
    if (want.has(r.duda_product_id) && want.get(r.duda_product_id) !== v) throw new Error(`${r.duda_name}: the sheet says both accessory and not`);
    want.set(r.duda_product_id, v);
  }
  const hub = await prisma.hubProduct.findMany({ select: { dudaProductId: true, name: true, status: true, isAccessory: true } });
  const changes = hub.filter((h) => want.has(h.dudaProductId) && want.get(h.dudaProductId) !== h.isAccessory);
  const visibleAccessories = hub.filter((h) => h.status !== "HIDDEN" && (want.has(h.dudaProductId) ? want.get(h.dudaProductId) : h.isAccessory));
  const unmatched = hub.filter((h) => !want.has(h.dudaProductId)).map((h) => `${h.name} (${h.status})`);
  console.log(`\n${confirm ? "Applying" : "Dry run —"} accessory flags from the sheet`);
  console.log(`  sheet: ${[...want.values()].filter(Boolean).length} accessories, ${[...want.values()].filter((v) => !v).length} not`);
  console.log(`  changes: ${changes.length} (${changes.filter((c) => want.get(c.dudaProductId)).length} → accessory)`);
  console.log(`  visible accessories after: ${visibleAccessories.length}`);
  console.log(`  not in the sheet (left as they are): ${unmatched.join(", ") || "none"}`);
  if (!confirm) { console.log("\nNothing written.\n"); return; }
  await prisma.$transaction(changes.map((c) => prisma.hubProduct.update({ where: { dudaProductId: c.dudaProductId }, data: { isAccessory: want.get(c.dudaProductId)! } })));
  const now = await prisma.hubProduct.count({ where: { isAccessory: true, status: { not: "HIDDEN" } } });
  console.log(`  ✓ ${changes.length} updated; visible accessories: ${now}\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

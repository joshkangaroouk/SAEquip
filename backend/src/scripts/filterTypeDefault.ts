/**
 * Make "Not sure – please advise" the FIRST Filter Type choice on the three
 * filtration units (Josh, 14 Oct 2026). Duda pre-selects a product's first
 * choice, so a visitor who never picks a filter is quoted "Not sure – please
 * advise" instead of silently "Dust".
 *
 *   npm run catalogue:filter-default --workspace=backend            (dry run)
 *   npm run catalogue:filter-default --workspace=backend -- --confirm
 *
 * Adds the choice to the store's "Filter Type" option if it is missing, then
 * re-attaches each product's choices with it first, through
 * updateOptionsPreservingVariations(). Idempotent: a product already in that
 * order is left alone.
 */
import "dotenv/config";
import { prisma } from "../prisma.js";
import { duda } from "../services/duda.js";
import { updateOptionsPreservingVariations } from "../services/productOptions.js";

const confirm = process.argv.includes("--confirm");
const OPTION_NAME = "Filter Type";
const NOT_SURE = "Not sure – please advise";
const PRODUCTS = [
  { sku: "SAFU", name: "Filtration Unit" },
  { sku: "SACFU", name: "Compact Filtration Unit" },
  { sku: "SAELFU", name: "Lightweight Filtration Unit" },
];

async function main() {
  let option = ((await duda.listOptions()).results ?? []).find((o) => o.name === OPTION_NAME);
  if (!option) throw new Error(`no "${OPTION_NAME}" option in the store`);
  let notSure = option.choices.find((c) => c.value === NOT_SURE);
  console.log(`\n${confirm ? "Applying" : "Dry run —"} "${NOT_SURE}" first on ${OPTION_NAME}`);
  console.log(`  store option: ${option.choices.map((c) => c.value).join(", ")}${notSure ? "" : `  → add "${NOT_SURE}"`}`);

  const all = await duda.listAllProducts();
  const targets = PRODUCTS.map((t) => {
    const p = all.find((x) => x.sku === t.sku);
    if (!p || p.name !== t.name) throw new Error(`SKU ${t.sku} is "${p?.name}", not "${t.name}"`);
    const mine = (p.options ?? []).find((o) => o.id === option!.id);
    if (!mine) throw new Error(`${t.name} does not have the ${OPTION_NAME} option`);
    const others = (p.options ?? []).filter((o) => o.id !== option!.id);
    if (others.length) throw new Error(`${t.name} has other options too (${others.map((o) => o.name).join(", ")})`);
    const current = (mine.choices ?? []).map((c) => c.value);
    console.log(`  ${t.name}: ${current.join(", ")}`);
    return { ...t, id: p.id, current, currentIds: (mine.choices ?? []).map((c) => c.id) };
  });
  if (!confirm) { console.log("\nNothing written.\n"); return; }

  if (!notSure) {
    option = await duda.addOptionChoice(option.id, NOT_SURE);
    notSure = option.choices.find((c) => c.value === NOT_SURE);
    if (!notSure) throw new Error("Duda did not return the new choice");
    console.log(`  ✓ added "${NOT_SURE}" (${notSure.id}) to the store option`);
  }
  for (const t of targets) {
    if (t.currentIds[0] === notSure.id) { console.log(`  • ${t.name}: already first`); continue; }
    const wanted = [notSure.id, ...t.currentIds.filter((id) => id !== notSure!.id)];
    const report = await updateOptionsPreservingVariations(t.id, [{ id: option.id, choiceIds: wanted }]);
    const after = (report.product.options ?? []).find((o) => o.id === option!.id)?.choices.map((c) => c.value) ?? [];
    console.log(`  ✓ ${t.name}: ${after.join(", ")} | ${report.product.variations?.length ?? 0} variations; restored ${report.restored}, dropped ${report.dropped.length}, failed ${report.failed.length}`);
    if (after[0] !== NOT_SURE) console.log(`    ⚠️ Duda returned "${after[0]}" first, not "${NOT_SURE}"`);
    if (report.failed.length) throw new Error(`${t.name}: variation data failed to restore`);
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

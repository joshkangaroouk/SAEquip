/**
 * Phase 5c: Josh's decisions after SA Equip's answers (14 Oct 2026).
 *
 *   npm run catalogue:phase5c --workspace=backend -- --out ../migration/backups/<dir> [--confirm]
 *
 *   1. SA ENDURE LED Max Light: add the Lighting and Power category (it had
 *      none); its Site Challenges stay empty, like the other SA ENDURE lights.
 *   2. A "Filter Type" product option on the three filtration units, each with
 *      only its own filter types.
 *   3. PERMANENTLY delete seven hidden products, from Duda and the Hub.
 *
 * ⚠️ Deleting is irreversible. A product is deleted only if Duda reports it
 * HIDDEN right now, and each product's full Duda record and every Hub row
 * that belongs to it are written to --out BEFORE anything is deleted. The
 * three weekly rentals are deliberately NOT here: they stay hidden until the
 * rental discussion with SA Equip.
 *
 * Options go through updateOptionsPreservingVariations(), never
 * duda.updateProductOptions() directly. Dry run by default.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { CATEGORY_ROOT, duda, type DudaOption } from "../services/duda.js";
import { updateOptionsPreservingVariations } from "../services/productOptions.js";
import { planAssignments, type Cat, type Link } from "./lib/taxonomyPlan.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");

const OPTION_NAME = "Filter Type";
const OPTION_CHOICES = ["Dust", "Breathable Dust", "Vapour"];
const FILTER_PRODUCTS = [
  { sku: "SAFU", name: "Filtration Unit", choices: ["Dust", "Breathable Dust", "Vapour"] },
  { sku: "SACFU", name: "Compact Filtration Unit", choices: ["Dust", "Breathable Dust"] },
  { sku: "SAELFU", name: "Lightweight Filtration Unit", choices: ["Dust", "Breathable Dust"] },
];

const DELETE: { id?: string; ledger?: string; name: string }[] = [
  { id: "01M1XPSGR38B1RVS17TQQB1VTM", name: "SA LUMIN Tasklight Adjustable Floor Stand" },
  { id: "01M1XPWW6N9MSPJ9B809ZXSNNP", name: "Filters" },
  { id: "01M1XPPSMPR4M8TAJ9Z1MRDGJD", name: "Filter" },
  { id: "01M1XPSJP5M2T59873K9XFV3B1", name: "Filter - Purchase Only" },
  { id: "01M1XPSXXFV3HVVFFF1086HCVW", name: "Filters - PURCHASE ONLY" },
  { ledger: "E2", name: "SA ENDURE LEV Accessories" },
  { id: "01M1XPVWR8EGD4KDMBRN0H4669", name: "EX Vapour Extraction System" },
];
/** Kept HIDDEN, never deleted here (rental discussion pending). */
const NEVER_DELETE = ["01M1XPRNYFEYJ21QM1CCR7AN7M", "01M1XPRW2S2HRB8J6YPNC0MYKN", "01M1XPRTB1CVYPKYX46N9MZHNN"];

async function main() {
  const out = path.resolve(process.cwd(), arg("out") ?? "../migration/backups/phase5c");
  mkdirSync(out, { recursive: true });
  const ledger = JSON.parse(readFileSync(path.resolve(process.cwd(), "../migration/backups/2026-10-13-phase4/phase4-created.json"), "utf8")) as Record<string, string>;
  const idOf = (x: { id?: string; ledger?: string }) => x.id ?? ledger[x.ledger!];
  const problems: string[] = [];
  const log: string[] = [];

  const all = await duda.listAllProducts();
  const byId = new Map(all.map((p) => [p.id, p]));
  const hub = await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true } });
  const hubByDuda = new Map(hub.map((h) => [h.dudaProductId, h]));

  /* 1. Max Light → Lighting and Power, challenges still empty */
  const flat = await duda.listAllCategories();
  const cats: Cat[] = flat.map((c) => ({ id: c.id, title: c.title, parentId: c.parent_id || CATEGORY_ROOT }));
  const links: Link[] = await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true, sortOrder: true } });
  const maxId = ledger.E1;
  const maxHub = hubByDuda.get(maxId);
  const maxP = byId.get(maxId);
  if (!maxHub || maxP?.name !== "SA ENDURE LED Max Light") problems.push(`1: ${maxId} is not SA ENDURE LED Max Light`);
  const lighting = cats.find((c) => c.title === "Lighting and Power" && cats.find((p) => p.id === c.parentId)?.title === "Products");
  const maxPlan = maxHub
    ? planAssignments({
        wanted: [{ hubProductId: maxHub.id, dudaProductId: maxId, name: "SA ENDURE LED Max Light", category: "Lighting and Power", siteChallenges: [], industries: null }],
        links, cats, approvedCategoryChange: new Set([maxId]),
      })
    : { changes: [], flags: [], adds: [], removals: [], reorders: [] };
  log.push(`1. SA ENDURE LED Max Light (${maxP?.status}): category ${maxPlan.changes.filter((c) => c.field === "Category").map((c) => `${c.from.join(", ") || "none"} → ${c.to.join(", ")}`).join("") || "already Lighting and Power"}; links +${maxPlan.adds.length} −${maxPlan.removals.length}; challenges stay empty.`);
  if (!lighting) problems.push("1: no Products › Lighting and Power category");

  /* 2. Filter Type option */
  const options = (await duda.listOptions()).results ?? [];
  let option: DudaOption | undefined = options.find((o) => o.name.trim().toLowerCase() === OPTION_NAME.toLowerCase());
  if (option) {
    const missing = OPTION_CHOICES.filter((c) => !option!.choices.some((x) => x.value === c));
    if (missing.length) problems.push(`2: "${OPTION_NAME}" already exists without ${missing.join(", ")}`);
  }
  const store = await duda.getStore();
  if (!option && options.length >= (store.features?.max_options ?? 20)) problems.push(`2: the store already has ${options.length} options (the limit)`);
  const filterTargets = FILTER_PRODUCTS.map((f) => {
    const p = all.find((x) => x.sku === f.sku);
    if (!p || p.name !== f.name) { problems.push(`2: SKU ${f.sku} is "${p?.name}", not "${f.name}"`); return null; }
    const others = (p.options ?? []).filter((o) => o.id !== option?.id);
    if (others.length) problems.push(`2: ${f.name} already has options (${others.map((o) => o.name).join(", ")}) — attaching another would split its variations`);
    return { ...f, id: p.id, variations: p.variations?.length ?? 0, attached: (p.options ?? []).some((o) => o.id === option?.id) };
  });
  log.push(`2. Option "${OPTION_NAME}" (${OPTION_CHOICES.join(", ")}): ${option ? "already in the store" : `to create (store has ${options.length} of ${store.features?.max_options ?? 20} options)`}.`);
  for (const t of filterTargets) if (t) log.push(`   ${t.name} (${t.sku}): ${t.choices.join(", ")} — ${t.attached ? "already attached" : `attach; ${t.variations} variations today → ${t.choices.length}`}`);

  /* 3. Deletes: only HIDDEN products, never the rentals, snapshot first */
  for (const id of NEVER_DELETE) if (DELETE.some((d) => idOf(d) === id)) throw new Error(`refusing: ${id} must not be deleted`);
  const toDelete = [];
  for (const d of DELETE) {
    const id = idOf(d);
    const p = byId.get(id);
    if (!p) { log.push(`3. ${d.name}: already gone from Duda`); continue; }
    if (p.name !== d.name) { problems.push(`3: ${id} is "${p.name}", not "${d.name}"`); continue; }
    if (p.status !== "HIDDEN") { problems.push(`3: ${d.name} is ${p.status} — only a HIDDEN product is deleted`); continue; }
    const h = hubByDuda.get(id);
    const inbound = h ? await prisma.compatibleLink.findMany({ where: { relatedHubProductId: h.id }, select: { hubProduct: { select: { name: true } } } }) : [];
    const cats = h ? await prisma.productCategory.count({ where: { hubProductId: h.id } }) : 0;
    const leads = h ? await prisma.lead.count({ where: { download: { hubProductId: h.id } } }) : 0;
    toDelete.push({ d, id, p, h });
    log.push(`3. delete ${d.name} (${p.sku ?? "no SKU"}): HIDDEN, ${cats} category links, ${inbound.length} compatible-list mention(s)${inbound.length ? ` (${inbound.map((i) => i.hubProduct.name).join(", ")})` : ""}, ${leads} resource request(s)`);
  }
  for (const id of NEVER_DELETE) log.push(`   kept hidden: ${byId.get(id)?.name} (${byId.get(id)?.status})`);

  console.log(`\n${confirm ? "Applying" : "Dry run —"} Phase 5c\n  ${log.join("\n  ")}`);
  console.log(problems.length ? `  ✗ ${problems.length} problem(s):\n    ${problems.join("\n    ")}` : "  ✓ all checks pass");
  if (!confirm) { console.log("\nNothing written.\n"); return; }
  if (problems.length) throw new Error("refusing to apply while any check fails");

  /* apply 1 */
  await prisma.$transaction([
    ...maxPlan.removals.map((r) => prisma.productCategory.deleteMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId } })),
    prisma.productCategory.createMany({ data: maxPlan.adds.map((a) => ({ hubProductId: a.hubProductId, dudaCategoryId: a.dudaCategoryId, sortOrder: a.sortOrder ?? null })), skipDuplicates: true }),
  ]);
  console.log(`  ✓ 1. Max Light: +${maxPlan.adds.length} link(s)`);

  /* apply 2 */
  if (!option) {
    option = await duda.createOption({ name: OPTION_NAME, type: "TEXT", choices: OPTION_CHOICES });
    writeFileSync(path.join(out, "filter-type-option.json"), JSON.stringify(option, null, 2) + "\n"); // before anything else can fail
    console.log(`  ✓ 2. created option "${option.name}" (${option.id})`);
  }
  for (const t of filterTargets) {
    if (!t || t.attached) continue;
    const choiceIds = t.choices.map((c) => {
      const ch = option!.choices.find((x) => x.value === c);
      if (!ch) throw new Error(`option has no choice "${c}"`);
      return ch.id;
    });
    const report = await updateOptionsPreservingVariations(t.id, [{ id: option!.id, choiceIds }]);
    const vars = report.product.variations ?? [];
    console.log(`  ✓ 2. ${t.name}: attached (${t.choices.join(", ")}) → ${vars.length} variations; restored ${report.restored}, dropped ${report.dropped.length}, failed ${report.failed.length}`);
    if (vars.length !== t.choices.length || report.failed.length) throw new Error(`${t.name}: expected ${t.choices.length} variations and no failures`);
  }

  /* apply 3: snapshot every product first, then delete */
  const snapshot = [];
  for (const x of toDelete) {
    const full = await duda.getProduct(x.id);
    const hubFull = x.h
      ? await prisma.hubProduct.findUnique({
          where: { id: x.h.id },
          include: { specRows: true, textItems: true, logos: true, downloads: true, categories: true, compatible: true, compatibleFor: true },
        })
      : null;
    snapshot.push({ duda: full, hub: hubFull });
  }
  const snapPath = path.join(out, `deleted-products-${Date.now()}.json`);
  writeFileSync(snapPath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`  ✓ 3. snapshot of ${snapshot.length} product(s): ${snapPath}`);
  for (const x of toDelete) {
    await duda.deleteProduct(x.id);
    if (x.h) await prisma.hubProduct.delete({ where: { id: x.h.id } });
    console.log(`  ✓ 3. deleted ${x.d.name}`);
  }
  console.log(`\n✓ Applied. Next: npm run duda:sync-categories --workspace=backend (dry run), then -- --confirm.\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

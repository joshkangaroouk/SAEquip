/**
 * Phase 5a of SA Equip's product assignment: Site Challenges and Industries
 * for every remaining product, plus hiding the three duplicate filter
 * products (docs/sa-equip-phase0/PHASE5A_INSTRUCTIONS.md, Josh's own calls).
 *
 *   npm run catalogue:phase5a --workspace=backend -- --master ../docs/sa-equip-phase0/sa-equip-products.json \
 *     --report ../docs/sa-equip-phase0/PHASE5A_APPLY.md --out ../migration/backups/<dir> [--confirm]
 *
 * ⚠️ Scope: challenges (in the given order, stored as the card order) and
 * industries only, plus the three hides. No logo, certification, category,
 * SKU or name changes: `category: null` leaves every product type alone.
 * Then `duda:sync-categories` pushes the links. Dry run by default.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { CATEGORY_ROOT, duda } from "../services/duda.js";
import { syncHubProduct } from "../services/hubProduct.js";
import { applyPlan, planAssignments, type Cat, type Link } from "./lib/taxonomyPlan.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");

/** "The same 7": the SA ENDURE safe-area industries. */
const SAME7 = [
  "Construction & Major Projects", "Aviation & Aerospace", "Rail & Transport Engineering", "Pharmaceuticals",
  "Distilleries & Breweries", "Defence & Naval Shipbuilding", "Marine & Commercial Ship Repair",
];
const CONFINED = "Confined-Space Ventilation";
const SHUTDOWN = "Shutdown and Turnaround Packages";
const DUST = "Dust Extraction, Filtration and Containment";
const TANK = "Tank and Vessel Entry";
const TOXIC = "Toxic Fume and Vapour Extraction";

type Source = { same7: true } | { sheet: true } | { copyFrom: string };
type Item = { ref: string; id?: string; ledger?: string; name: string; challenges?: string[]; industries: Source };
const ITEMS: Item[] = [
  // 1. SA ENDURE safe-area products (Hazardous-Area Lighting deliberately not used for non-EX lights)
  { ref: "1", id: "01M1XPRZJQ8HZJT1R2KYWNK7SM", name: "Air Mover", challenges: [CONFINED], industries: { same7: true } },
  { ref: "1", id: "01M1XPTTF35NZANG1VP31N3Q1A", name: "High Power Air Mover", challenges: [CONFINED], industries: { same7: true } },
  { ref: "1", id: "01M1XPRFPJSJJ8AMMNEX9YHX3H", name: "LED Tubelight", challenges: [SHUTDOWN], industries: { same7: true } },
  { ref: "1", id: "01M1XPR96H6VSR07H5YY4GY9SS", name: "LED Worklamp", challenges: [SHUTDOWN], industries: { same7: true } },
  { ref: "1", id: "01M1XPRK9QPQ5BR0NJB9EXMEY7", name: "LED Emergency Tubelight", challenges: [SHUTDOWN], industries: { same7: true } },
  { ref: "1", ledger: "E1", name: "SA ENDURE LED Max Light", challenges: [SHUTDOWN], industries: { same7: true } },
  { ref: "1", ledger: "E2", name: "SA ENDURE LEV Accessories", challenges: ["Welding Fume Control", DUST], industries: { same7: true } },
  // 2. The 7 CYCLONE-labelled SAE/SE products: the sheet's challenges minus Paint and Coating Drying and Hydrogen
  { ref: "2", id: "01M1XPV10E0EVHJ5Q2VPE8E9Y0", name: "Compact Dust Extraction System", challenges: [DUST, SHUTDOWN], industries: { sheet: true } },
  { ref: "2", id: "01M1XPV4B7FQ0KTM5NGZYR0JJZ", name: "Dust Filter Bundle - 12 Panel Filters & 24 Compact Bag Filters", challenges: [DUST], industries: { sheet: true } },
  { ref: "2", id: "01M1XPVFEABW7DD0C7ZVFJJEXD", name: "High Volume Dust Extraction System", challenges: [DUST, SHUTDOWN], industries: { sheet: true } },
  { ref: "2", id: "01M1XPVM28SMQ4KTSN9KNX86C1", name: "Lightweight Dust Extraction System", challenges: [DUST, SHUTDOWN], industries: { sheet: true } },
  { ref: "2", id: "01M1XPW0XA8HC8JQ747Y7AS8ZN", name: "Lightweight Filtration Unit", challenges: [CONFINED, TANK, SHUTDOWN], industries: { sheet: true } },
  { ref: "2", id: "01M1XPX3AE4734TP9Y98SQNNB2", name: "PVC Flexible Duct System", challenges: [CONFINED, TANK, TOXIC], industries: { sheet: true } },
  { ref: "2", id: "01M1XPVQ4N6FYRYK69WYA8P99Q", name: "Vapour Extraction System", challenges: [TOXIC, "Paint Spray Fume Control", SHUTDOWN], industries: { sheet: true } },
  // 4. Weekly rentals copy their sale product's challenges (same order) and industries, as in the Hub now
  { ref: "4", id: "01M1XPRNYFEYJ21QM1CCR7AN7M", name: "Weekly Rental of SA CYCLONE Ducting 30cm", industries: { copyFrom: "01M1XPPWJPY6SMV9MMYX0P8705" } },
  { ref: "4", id: "01M1XPRW2S2HRB8J6YPNC0MYKN", name: "Weekly Rental of SA POWERNET Adaptor Lead 110V Stahl-CEAG", industries: { copyFrom: "01M1XPRQMEASAAQ00ZN1ZHMMTB" } },
  { ref: "4", id: "01M1XPRTB1CVYPKYX46N9MZHNN", name: "Weekly Rental of SA POWERNET Adaptor Lead 110V ATX-CEAG", industries: { copyFrom: "01M1XPRQMEASAAQ00ZN1ZHMMTB" } },
];

/** 3. Hide the three duplicate replacement-filter products; keep "Filters" (SAFU/) exactly as it is. */
const HIDE = [
  { id: "01M1XPPSMPR4M8TAJ9Z1MRDGJD", name: "Filter" },
  { id: "01M1XPSJP5M2T59873K9XFV3B1", name: "Filter - Purchase Only" },
  { id: "01M1XPSXXFV3HVVFFF1086HCVW", name: "Filters - PURCHASE ONLY" },
];
const KEEP = { id: "01M1XPWW6N9MSPJ9B809ZXSNNP", name: "Filters" };

/** The file's expected counts, visible products only. */
const EXPECTED: Record<string, number> = {
  [CONFINED]: 22, [TANK]: 55, [SHUTDOWN]: 39, [DUST]: 14, [TOXIC]: 19,
  "Paint Spray Fume Control": 2, "Hydrogen and Hazardous-Gas Ventilation": 30, "Temporary Power Distribution": 9,
};

type SheetProduct = { duda_product_id: string | null; brand: string; sheet_sku: string; industries: string[] };
const md = (s: string) => s.replace(/\|/g, "\\|");

async function main() {
  const masterPath = arg("master");
  if (!masterPath) throw new Error("pass --master <path to sa-equip-products.json>");
  const out = path.resolve(process.cwd(), arg("out") ?? "../migration/backups/phase5a");
  const reportPath = arg("report");
  mkdirSync(out, { recursive: true });
  const sheet = JSON.parse(readFileSync(masterPath, "utf8")) as { products: SheetProduct[] };
  const ledger = JSON.parse(readFileSync(path.resolve(process.cwd(), "../migration/backups/2026-10-13-phase4/phase4-created.json"), "utf8")) as Record<string, string>;
  const problems: string[] = [];

  const all = await duda.listAllProducts();
  const byId = new Map(all.map((p) => [p.id, p]));
  const hub = await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true, status: true, slug: true } });
  const hubByDuda = new Map(hub.map((h) => [h.dudaProductId, h]));
  const flat = await duda.listAllCategories();
  const cats: Cat[] = flat.map((c) => ({ id: c.id, title: c.title, parentId: c.parent_id || CATEGORY_ROOT }));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const top = (t: string) => cats.find((c) => c.parentId === CATEGORY_ROOT && c.title === t)!;
  const SC = top("Site Challenges"), IND = top("Industries");
  const links: Link[] = await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true, sortOrder: true } });
  const title = (id: string) => catById.get(id)?.title ?? id;

  /* 3. hides */
  const hideIds = new Set(HIDE.map((h) => h.id));
  if (hideIds.has(KEEP.id)) throw new Error("the product to keep is in the hide list");
  const keep = byId.get(KEEP.id);
  if (!keep || keep.name !== KEEP.name) problems.push(`keep: ${KEEP.id} is "${keep?.name}", not "${KEEP.name}"`);
  const hideRemovals: Link[] = [];
  const hideRows: string[] = [];
  const references: string[] = [];
  for (const h of HIDE) {
    const p = byId.get(h.id);
    if (!p || p.name !== h.name || p.sku !== "SAFU/RF") { problems.push(`3: ${h.id} is "${p?.name}" (${p?.sku}), not "${h.name}" (SAFU/RF)`); continue; }
    const hp = hubByDuda.get(h.id);
    const mine = hp ? links.filter((l) => l.hubProductId === hp.id) : [];
    hideRemovals.push(...mine);
    hideRows.push(`| ${md(p.name ?? "")} | ${p.status} → HIDDEN | ${mine.length ? mine.map((l) => title(l.dudaCategoryId)).join("; ") : "none"} |`);
    if (hp) {
      // Anything that points at it: compatible lists, links in descriptions, its own downloads.
      const inbound = await prisma.compatibleLink.findMany({ where: { relatedHubProductId: hp.id }, select: { hubProduct: { select: { name: true } } } });
      for (const i of inbound) references.push(`${p.name}: listed under Compatible Products on **${i.hubProduct.name}**`);
      if (hp.slug) {
        const inDesc = await prisma.hubProduct.findMany({ where: { descriptionHtml: { contains: `/product/${hp.slug}` } }, select: { name: true } });
        for (const d of inDesc) references.push(`${p.name}: linked from the description of **${d.name}**`);
      }
      const dl = await prisma.download.count({ where: { hubProductId: hp.id } });
      if (dl) references.push(`${p.name}: has ${dl} download(s) of its own, which leave the resources pages once it is hidden`);
    }
  }

  /* 1, 2, 4. challenges and industries */
  const wanted = [];
  const rows: string[] = [];
  for (const it of ITEMS) {
    const dudaId = it.id ?? ledger[it.ledger!];
    const p = byId.get(dudaId);
    const h = hubByDuda.get(dudaId);
    if (!p || !h) { problems.push(`${it.name}: no Duda product or Hub row for ${dudaId}`); continue; }
    if (p.name !== it.name) problems.push(`${it.name}: ${dudaId} is "${p.name}"`);
    let challenges = it.challenges ?? [];
    let industries: string[] = [];
    const src = it.industries;
    if ("same7" in src) {
      industries = SAME7;
      // The sheet's own list, where it has one, must be the same 7 (LED Emergency Tubelight's is blank).
      const s = sheet.products.filter((x) => x.duda_product_id === dudaId || (it.ledger && x.duda_product_id == null && x.sheet_sku === p.sku));
      const own = s.find((x) => x.brand === "ENDURE") ?? s[0];
      if (own?.industries?.length && (own.industries.length !== 7 || !SAME7.every((i) => own.industries.includes(i))))
        problems.push(`${it.name}: the sheet's industries are not the same 7 (${own.industries.join("; ")})`);
    } else if ("sheet" in src) {
      industries = sheet.products.find((x) => x.duda_product_id === dudaId)?.industries ?? [];
      if (industries.length !== 12) problems.push(`${it.name}: the sheet has ${industries.length} industries, expected 12`);
    } else {
      const from = hubByDuda.get(src.copyFrom);
      if (!from) { problems.push(`${it.name}: no Hub row for its sale product ${src.copyFrom}`); continue; }
      const mine = links.filter((l) => l.hubProductId === from.id);
      challenges = mine.filter((l) => catById.get(l.dudaCategoryId)?.parentId === SC.id)
        .sort((a, b) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9)).map((l) => title(l.dudaCategoryId));
      industries = mine.filter((l) => catById.get(l.dudaCategoryId)?.parentId === IND.id).map((l) => title(l.dudaCategoryId));
      if (!challenges.length || !industries.length) problems.push(`${it.name}: its sale product ${from.name} has ${challenges.length} challenges and ${industries.length} industries`);
    }
    wanted.push({ hubProductId: h.id, dudaProductId: dudaId, name: p.name ?? it.name, category: null, siteChallenges: challenges, siteChallengesOrder: challenges, industries });
    const from = "copyFrom" in src ? ` (from ${hubByDuda.get(src.copyFrom)?.name})` : "";
    rows.push(`| ${it.ref} | ${md(p.name ?? "")}${p.status === "HIDDEN" ? " (hidden)" : ""} | ${md(challenges.join(" > "))}${from} | ${industries.length}: ${md(industries.join("; "))} |`);
  }

  const gone = new Set(hideRemovals.map((l) => `${l.hubProductId}|${l.dudaCategoryId}`));
  const afterHide = links.filter((l) => !gone.has(`${l.hubProductId}|${l.dudaCategoryId}`));
  const plan = planAssignments({ wanted, links: afterHide, cats, approvedCategoryChange: new Set() });
  const after = applyPlan(afterHide, plan);

  // Visible = what the site lists: Hub status not HIDDEN (the hides become HIDDEN here).
  const hidden = new Set(hub.filter((h) => h.status === "HIDDEN" || hideIds.has(h.dudaProductId)).map((h) => h.id));
  const visible = hub.filter((h) => !hidden.has(h.id));
  const countVisible = (set: Link[], id: string) => set.filter((l) => l.dudaCategoryId === id && !hidden.has(l.hubProductId)).length;
  const hiddenNow = new Set(hub.filter((h) => h.status === "HIDDEN").map((h) => h.id));
  const countBefore = (id: string) => links.filter((l) => l.dudaCategoryId === id && !hiddenNow.has(l.hubProductId)).length;
  const table: string[] = [];
  for (const parent of ["Site Challenges", "Industries", "Products"]) {
    const P = top(parent);
    for (const c of cats.filter((x) => x.parentId === P.id)) {
      const before = countBefore(c.id), aft = countVisible(after, c.id), all = after.filter((l) => l.dudaCategoryId === c.id).length;
      const exp = parent === "Site Challenges" ? EXPECTED[c.title] ?? before : parent === "Products" && c.title === "Fume, Dust, LEV and Vapour Control" ? 35 : null;
      const mark = exp == null ? "" : aft === exp ? "✓" : "✗ differs";
      if (mark === "✗ differs") problems.push(`${c.title}: the file expects ${exp}, would be ${aft}`);
      table.push(`| ${md(`${parent} › ${c.title}`)} | ${before} | ${aft} | ${exp ?? "—"} | ${mark} | ${all} |`);
    }
  }
  // Goal: every visible product has at least one challenge and one industry.
  const has = (hid: string, parentId: string) => after.some((l) => l.hubProductId === hid && catById.get(l.dudaCategoryId)?.parentId === parentId);
  const missing = visible.filter((h) => !has(h.id, SC.id) || !has(h.id, IND.id)).map((h) => `${h.name} (${!has(h.id, SC.id) ? "no challenge" : ""}${!has(h.id, SC.id) && !has(h.id, IND.id) ? ", " : ""}${!has(h.id, IND.id) ? "no industry" : ""})`);

  const lines = [
    `# Phase 5a: site challenges and industries`, ``,
    `**Generated:** ${new Date().toISOString()} by \`npm run catalogue:phase5a\` (${confirm ? "APPLY" : "dry run"}).`,
    `**Scope:** \`PHASE5A_INSTRUCTIONS.md\`. Challenges (in the given order) and industries, plus hiding 3 filter products. No logo, certification, category, SKU or name changes.`, ``,
    `## Challenges and industries (${wanted.length} products)`, ``, `| § | Product | Site Challenges (card order) | Industries |`, `|---|---|---|---|`, ...rows, ``,
    `Links: +${plan.adds.length} −${plan.removals.length}; category (product type) flags: ${plan.flags.length}.`, ``,
    `## 3. Filters: keep one, hide three`, ``, `Kept as it is: **${keep?.name}** (${keep?.sku}).`, ``,
    `| Product | Duda status | Category links removed |`, `|---|---|---|`, ...hideRows, ``,
    `What still points at them:`, ``, ...(references.length ? references.map((r) => `- ${r}`) : [`- Nothing: no Compatible Products list, product description or download refers to them.`]), ``,
    `## Counts (visible products)`, ``, `| Category | Before | After | Expected | | All products incl. hidden |`, `|---|---|---|---|---|---|`, ...table, ``,
    `## Every visible product has a challenge and an industry`, ``,
    missing.length ? missing.map((m) => `- ✗ ${m}`).join("\n") : `- ✓ all ${visible.length} visible products have at least one Site Challenge and one Industry.`, ``,
    `## Checks`, ``, problems.length ? problems.map((p) => `- ✗ ${p}`).join("\n") : `- ✓ every product found and named as expected, sheet industries agree, categories untouched, expected counts met.`, ``,
  ];
  writeFileSync(path.join(out, "phase5a-plan.json"), JSON.stringify({ at: new Date().toISOString(), confirm, hideRemovals, plan, missing, references, problems }, null, 2) + "\n");
  if (reportPath) writeFileSync(path.resolve(process.cwd(), reportPath), lines.join("\n"));

  console.log(`\n${confirm ? "Applying" : "Dry run —"} Phase 5a`);
  console.log(`  challenges/industries: ${wanted.length} products, links +${plan.adds.length} −${plan.removals.length}, flags ${plan.flags.length}`);
  console.log(`  hide: ${HIDE.length}, remove ${hideRemovals.length} link(s); references: ${references.length}`);
  console.log(`  visible products missing a challenge or industry: ${missing.length}`);
  console.log(problems.length ? `  ✗ ${problems.length} problem(s):\n    ${problems.join("\n    ")}` : "  ✓ all checks pass");
  if (!confirm) { console.log("\nNothing written.\n"); return; }
  if (problems.length) throw new Error("refusing to apply while any check fails");

  writeFileSync(path.join(out, `hub-before-apply-${Date.now()}.json`), JSON.stringify({ productCategories: links }, null, 2) + "\n");
  for (const h of HIDE) {
    const p = await duda.updateProduct(h.id, { status: "HIDDEN" });
    await syncHubProduct(p, prisma);
    if (p.status !== "HIDDEN") throw new Error(`${h.name}: Duda reports ${p.status}`);
    console.log(`  ✓ ${h.name} → HIDDEN`);
  }
  await prisma.$transaction([
    ...hideRemovals.map((r) => prisma.productCategory.deleteMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId } })),
    ...plan.removals.map((r) => prisma.productCategory.deleteMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId } })),
    prisma.productCategory.createMany({ data: plan.adds.map((a) => ({ hubProductId: a.hubProductId, dudaCategoryId: a.dudaCategoryId, sortOrder: a.sortOrder ?? null })), skipDuplicates: true }),
    ...plan.reorders.map((r) => prisma.productCategory.updateMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId }, data: { sortOrder: r.sortOrder ?? null } })),
  ]);
  const again = planAssignments({ wanted, links: await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true, sortOrder: true } }), cats, approvedCategoryChange: new Set() });
  if (again.adds.length || again.removals.length || again.reorders.length) throw new Error("applied, but a re-plan still finds differences — investigate before syncing");
  console.log(`  ✓ ${hideRemovals.length} filter link(s) removed; challenges/industries +${plan.adds.length} −${plan.removals.length}`);
  console.log(`\n✓ Applied. Next: npm run duda:sync-categories --workspace=backend (dry run), then -- --confirm.\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

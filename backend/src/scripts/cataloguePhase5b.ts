/**
 * Phase 5b: SA Equip's answers (Gill, 14 Oct 2026), sections 1 to 4 of
 * docs/sa-equip-phase0/PHASE5B_INSTRUCTIONS.md.
 *
 *   npm run catalogue:phase5b --workspace=backend -- --master ../docs/sa-equip-phase0/sa-equip-products.json \
 *     --report ../docs/sa-equip-phase0/PHASE5B_APPLY.md --out ../migration/backups/<dir> [--confirm]
 *
 * ⚠️ SECTION 1 IS SAFETY-CRITICAL: SA ENDURE is industrial only, never for
 * hazardous areas. Every listed ENDURE product gets SA Endure ON, SA Cyclone
 * OFF, every hazardous-area certification logo OFF (UKCA and Made in Britain
 * untouched), exactly the 7 industrial industries and exactly the listed
 * challenges. After applying, the script re-reads the Hub and FAILS if any
 * ENDURE product still carries a hazardous logo, industry or challenge.
 *
 * This is the first phase that switches logos OFF, so it uses
 * planLogoToggles() (explicit ON and OFF lists) and lists every switch-off;
 * planLogos() stays ON-only. Dry run by default; `duda:sync-categories` after.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { CATEGORY_ROOT, duda } from "../services/duda.js";
import { syncHubProduct } from "../services/hubProduct.js";
import { applyPlan, planAssignments, type Cat, type Link } from "./lib/taxonomyPlan.js";
import { planLogoToggles, type LogoLink } from "./lib/logoPlan.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");

const LOGO_FILES: Record<string, { kind: "SA_LOGO" | "CERT_LOGO"; file: string; label: string }> = {
  endure: { kind: "SA_LOGO", file: "endure.jpg", label: "SA Endure" },
  cyclone: { kind: "SA_LOGO", file: "cyclone.jpg", label: "SA Cyclone" },
  ex_logo: { kind: "CERT_LOGO", file: "ex-logo.png", label: "Ex" },
  iecex: { kind: "CERT_LOGO", file: "IECEx_Logo.png", label: "IECEx" },
  inmetro: { kind: "CERT_LOGO", file: "Inmetro.png", label: "Inmetro" },
  ukca: { kind: "CERT_LOGO", file: "ukca.png", label: "UKCA" },
  zone_0: { kind: "CERT_LOGO", file: "zone-0.png", label: "Zone 0" },
  zone_1_2: { kind: "CERT_LOGO", file: "zone-1-2.png", label: "Zone 1-2" },
  zone_20: { kind: "CERT_LOGO", file: "zone-20.png", label: "Zone 20" },
  zone_21_22: { kind: "CERT_LOGO", file: "zone-21-22.png", label: "Zone 21-22" },
};
const HAZARD_CERTS = ["ex_logo", "iecex", "inmetro", "zone_0", "zone_1_2", "zone_20", "zone_21_22"];
const INDUSTRIAL_7 = [
  "Construction & Major Projects", "Aviation & Aerospace", "Rail & Transport Engineering", "Pharmaceuticals",
  "Distilleries & Breweries", "Defence & Naval Shipbuilding", "Marine & Commercial Ship Repair",
];
const HAZARD_INDUSTRIES = ["Oil & Gas", "Petrochemical & Chemical Processing", "Nuclear", "Utilities", "Renewables & Hydrogen"];
const HAZARD_CHALLENGES = [
  "Hydrogen and Hazardous-Gas Ventilation", "Paint and Coating Drying", "Tank and Vessel Entry",
  "Shutdown and Turnaround Packages", "Hazardous-Area Lighting", "Hazardous-Area Cooling",
];
const DUST = "Dust Extraction, Filtration and Containment";
const CONFINED = "Confined-Space Ventilation";
const TOXIC = "Toxic Fume and Vapour Extraction";
const LEV = ["Welding Fume Control", DUST, TOXIC];

/** 1. The SA ENDURE products and their challenges, exactly as given. */
const ENDURE: { id?: string; ledger?: string; name: string; challenges: string[] }[] = [
  { id: "01M1XPV10E0EVHJ5Q2VPE8E9Y0", name: "Compact Dust Extraction System", challenges: [DUST] },
  { id: "01M1XPV4B7FQ0KTM5NGZYR0JJZ", name: "Dust Filter Bundle - 12 Panel Filters & 24 Compact Bag Filters", challenges: [DUST] },
  { id: "01M1XPVFEABW7DD0C7ZVFJJEXD", name: "High Volume Dust Extraction System", challenges: [DUST] },
  { id: "01M1XPVM28SMQ4KTSN9KNX86C1", name: "Lightweight Dust Extraction System", challenges: [DUST] },
  { id: "01M1XPW0XA8HC8JQ747Y7AS8ZN", name: "Lightweight Filtration Unit", challenges: [CONFINED] },
  { id: "01M1XPX3AE4734TP9Y98SQNNB2", name: "PVC Flexible Duct System", challenges: [CONFINED, TOXIC] },
  { id: "01M1XPVQ4N6FYRYK69WYA8P99Q", name: "Vapour Extraction System", challenges: [TOXIC, "Paint Spray Fume Control"] },
  { id: "01M1XPYYP79FXTPEN8S6Y7QHGN", name: "Compact Filtration Unit (SAECFU)", challenges: [DUST, CONFINED] },
  { id: "01M1XPRZJQ8HZJT1R2KYWNK7SM", name: "Air Mover", challenges: [CONFINED] },
  { id: "01M1XPTTF35NZANG1VP31N3Q1A", name: "High Power Air Mover", challenges: [CONFINED] },
  { id: "01M1XPXAPZHT3A3DFJSA0T9H5S", name: "Container LEV System", challenges: LEV },
  { id: "01M1XPW3A15CA51720DG3A798G", name: "Mobile LEV System", challenges: LEV },
  { id: "01M1XPWJX7X6BKXZX2TB81VDAF", name: "Portable LEV System", challenges: LEV },
  // The 4 ENDURE lights: NO challenge, deliberately (found through Lighting and Power).
  { id: "01M1XPRFPJSJJ8AMMNEX9YHX3H", name: "LED Tubelight", challenges: [] },
  { id: "01M1XPR96H6VSR07H5YY4GY9SS", name: "LED Worklamp", challenges: [] },
  { id: "01M1XPRK9QPQ5BR0NJB9EXMEY7", name: "LED Emergency Tubelight", challenges: [] },
  { ledger: "E1", name: "SA ENDURE LED Max Light", challenges: [] },
];

/** 2. Certifications confirmed by SA Equip. */
const INMETRO_OFF = [
  { id: "01M1XPV6RHWS4CNJSZNBB69KBW", name: "Lightweight Extraction System" },
  { id: "01M1XPP4PQJAK6WM0MBXNMA9VJ", name: "EX LED Area Light" },
  { id: "01M1XPP7N5MVZ61653M04HNX2V", name: "EX LED Tower Light" },
  { id: "01M1XPPD1331H1W8M6AN5JT1DZ", name: "EX LED Vessel Entry Kit" },
  { id: "01M1XPQPN6HXHM1V5NY2SA3RFW", name: "EX 3.8KVA Transformer" },
  { id: "01M1XPQJ63RZ780TM7Q83HZM3K", name: "EX Mains Distribution Unit" },
  { id: "01M1XPQYGXGXJEH33SG8F0XAK9", name: "EX Splitter Unit" },
];
const TRANSFORMER_400 = {
  id: "01M1XPQTR5A31K13F5W5PZ9BPS", name: "EX 400VA Transformer",
  on: ["ex_logo", "iecex", "ukca", "zone_1_2", "zone_21_22"], off: ["inmetro"],
  challenges: ["Temporary Power Distribution", "Hydrogen and Hazardous-Gas Ventilation", "Shutdown and Turnaround Packages"],
};

/** 3. Hide and remove all category links (delete later). */
const HIDE = [
  { id: "01M1XPSGR38B1RVS17TQQB1VTM", name: "SA LUMIN Tasklight Adjustable Floor Stand", why: "Old product, delete" },
  { id: "01M1XPWW6N9MSPJ9B809ZXSNNP", name: "Filters", why: "Filters are options on the filtration units, not a product" },
  { id: "01M1XPRNYFEYJ21QM1CCR7AN7M", name: "Weekly Rental of SA CYCLONE Ducting 30cm", why: "Rental to be handled differently" },
  { id: "01M1XPRW2S2HRB8J6YPNC0MYKN", name: "Weekly Rental of SA POWERNET Adaptor Lead 110V Stahl-CEAG", why: "Rental to be handled differently" },
  { id: "01M1XPRTB1CVYPKYX46N9MZHNN", name: "Weekly Rental of SA POWERNET Adaptor Lead 110V ATX-CEAG", why: "Rental to be handled differently" },
  { ledger: "E2", name: "SA ENDURE LEV Accessories", why: "Sold with the LEV systems; already hidden; flagged for deletion" },
] as { id?: string; ledger?: string; name: string; why: string }[];

/** 4. SKU. */
const SKU = { id: "01M1XPSEZ4N8AVNXQT684ZZFAG", name: "SA LUMIN Tasklight Base Unit", to: "SATL/BU" };

const md = (s: string) => s.replace(/\|/g, "\\|");

async function main() {
  const out = path.resolve(process.cwd(), arg("out") ?? "../migration/backups/phase5b");
  const reportPath = arg("report");
  mkdirSync(out, { recursive: true });
  const ledger = JSON.parse(readFileSync(path.resolve(process.cwd(), "../migration/backups/2026-10-13-phase4/phase4-created.json"), "utf8")) as Record<string, string>;
  const idOf = (x: { id?: string; ledger?: string }) => x.id ?? ledger[x.ledger!];
  const problems: string[] = [];

  const all = await duda.listAllProducts();
  const byId = new Map(all.map((p) => [p.id, p]));
  const hub = await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true, status: true } });
  const hubByDuda = new Map(hub.map((h) => [h.dudaProductId, h]));
  const flat = await duda.listAllCategories();
  const cats: Cat[] = flat.map((c) => ({ id: c.id, title: c.title, parentId: c.parent_id || CATEGORY_ROOT }));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const top = (t: string) => cats.find((c) => c.parentId === CATEGORY_ROOT && c.title === t)!;
  const SC = top("Site Challenges"), IND = top("Industries");
  const title = (id: string) => catById.get(id)?.title ?? id;
  const links: Link[] = await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true, sortOrder: true } });
  const logos = await prisma.logo.findMany({ include: { mediaAsset: { select: { filename: true } } } });
  const logoIdFor = new Map(Object.entries(LOGO_FILES).map(([k, v]) => {
    const hits = logos.filter((l) => l.kind === v.kind && l.mediaAsset?.filename === v.file);
    if (hits.length !== 1) throw new Error(`logo "${k}" matches ${hits.length} catalogue logos`);
    return [k, hits[0].id];
  }));
  const productLogos: LogoLink[] = await prisma.productLogo.findMany({ select: { hubProductId: true, logoId: true } });

  const check = (x: { id?: string; ledger?: string; name: string }, label: string) => {
    const id = idOf(x);
    const p = byId.get(id);
    const h = hubByDuda.get(id);
    if (!p || !h) { problems.push(`${label} ${x.name}: no Duda product or Hub row for ${id}`); return null; }
    if (p.name !== x.name) problems.push(`${label}: ${id} is "${p.name}", not "${x.name}"`);
    return { id, p, h };
  };

  /* 3. hides first: their links are removed outright */
  const hideRemovals: Link[] = [];
  const hideRows: string[] = [];
  for (const x of HIDE) {
    const r = check(x, "3"); if (!r) continue;
    const mine = links.filter((l) => l.hubProductId === r.h.id);
    hideRemovals.push(...mine);
    hideRows.push(`| ${md(r.p.name ?? "")} | ${r.p.status} → HIDDEN | ${mine.length} | ${x.why} |`);
  }
  const hiddenIds = new Set(HIDE.map((x) => idOf(x)));
  const afterHide = links.filter((l) => !hideRemovals.some((r) => r.hubProductId === l.hubProductId && r.dudaCategoryId === l.dudaCategoryId));

  /* 1 + 2. challenges, industries and logos */
  const wanted = [];
  const toggles = [];
  for (const x of ENDURE) {
    const r = check(x, "1"); if (!r) continue;
    wanted.push({ hubProductId: r.h.id, dudaProductId: r.id, name: r.p.name ?? x.name, category: null, siteChallenges: x.challenges, siteChallengesOrder: x.challenges, industries: INDUSTRIAL_7 });
    toggles.push({ hubProductId: r.h.id, dudaProductId: r.id, name: r.p.name ?? x.name, on: ["endure"], off: ["cyclone", ...HAZARD_CERTS] });
  }
  for (const x of INMETRO_OFF) {
    const r = check(x, "2"); if (!r) continue;
    toggles.push({ hubProductId: r.h.id, dudaProductId: r.id, name: r.p.name ?? x.name, on: [], off: ["inmetro"] });
  }
  {
    const r = check(TRANSFORMER_400, "2");
    if (r) {
      wanted.push({ hubProductId: r.h.id, dudaProductId: r.id, name: r.p.name ?? "", category: null, siteChallenges: TRANSFORMER_400.challenges, siteChallengesOrder: TRANSFORMER_400.challenges, industries: null });
      toggles.push({ hubProductId: r.h.id, dudaProductId: r.id, name: r.p.name ?? "", on: TRANSFORMER_400.on, off: TRANSFORMER_400.off });
    }
  }
  const plan = planAssignments({ wanted, links: afterHide, cats, approvedCategoryChange: new Set() });
  const after = applyPlan(afterHide, plan);
  const logoPlan = planLogoToggles({ wanted: toggles, links: productLogos, logoIdFor });

  /* 4. SKU */
  const skuRow = check(SKU, "4");
  const skuClash = all.filter((p) => p.id !== SKU.id && p.sku === SKU.to).map((p) => p.name);
  if (skuClash.length) problems.push(`4: SKU ${SKU.to} is already on ${skuClash.join(", ")}`);

  /* Other SA ENDURE / SAE / SE products not in the table (listed, not changed) */
  const endureLogo = logoIdFor.get("endure")!;
  const tableIds = new Set(ENDURE.map((x) => idOf(x)));
  const others = all
    .filter((p) => !tableIds.has(p.id))
    .filter((p) => {
      const h = hubByDuda.get(p.id);
      const hasEndure = h ? productLogos.some((l) => l.hubProductId === h.id && l.logoId === endureLogo) : false;
      return hasEndure || /^(SAE|SE)/i.test(p.sku ?? "");
    })
    .map((p) => `${p.name} (${p.sku ?? "no SKU"}, ${p.status})${hiddenIds.has(p.id) ? " — hidden in section 3" : ""}`);

  /* Safety check on the planned state: no ENDURE product keeps a hazardous anything */
  const removedLogo = new Set(logoPlan.removes.map((r) => `${r.hubProductId}|${r.logoId}`));
  const logosAfter = [...productLogos.filter((l) => !removedLogo.has(`${l.hubProductId}|${l.logoId}`)), ...logoPlan.adds.map((a) => ({ hubProductId: a.hubProductId, logoId: a.logoId }))];
  const safety = (catLinks: Link[], logoLinks: LogoLink[]) => {
    const bad: string[] = [];
    const hazLogo = new Set(["cyclone", ...HAZARD_CERTS].map((k) => logoIdFor.get(k)!));
    for (const x of ENDURE) {
      const h = hubByDuda.get(idOf(x)); if (!h) continue;
      const mine = catLinks.filter((l) => l.hubProductId === h.id).map((l) => catById.get(l.dudaCategoryId)!);
      const hazInd = mine.filter((c) => c?.parentId === IND.id && HAZARD_INDUSTRIES.includes(c.title)).map((c) => c.title);
      const hazCh = mine.filter((c) => c?.parentId === SC.id && HAZARD_CHALLENGES.includes(c.title)).map((c) => c.title);
      const hazLg = logoLinks.filter((l) => l.hubProductId === h.id && hazLogo.has(l.logoId)).map((l) => Object.entries(LOGO_FILES).find(([k]) => logoIdFor.get(k) === l.logoId)?.[1].label);
      const ind = mine.filter((c) => c?.parentId === IND.id).map((c) => c.title).sort();
      const endureOn = logoLinks.some((l) => l.hubProductId === h.id && l.logoId === endureLogo);
      if (hazInd.length || hazCh.length || hazLg.length || ind.join("|") !== [...INDUSTRIAL_7].sort().join("|") || !endureOn)
        bad.push(`${x.name}: ${[hazLg.length && `logos ${hazLg.join(", ")}`, hazInd.length && `industries ${hazInd.join(", ")}`, hazCh.length && `challenges ${hazCh.join(", ")}`, !endureOn && "SA Endure off", ind.length !== 7 && `${ind.length} industries`].filter(Boolean).join("; ")}`);
    }
    return bad;
  };
  const unsafePlanned = safety(after, logosAfter);
  for (const u of unsafePlanned) problems.push(`SAFETY (planned): ${u}`);

  // Visible challenge counts after (Hub status, with this phase's hides).
  const hidden = new Set(hub.filter((h) => h.status === "HIDDEN" || hiddenIds.has(h.dudaProductId)).map((h) => h.id));
  const hiddenNow = new Set(hub.filter((h) => h.status === "HIDDEN").map((h) => h.id));
  const counts = cats.filter((c) => c.parentId === SC.id || c.parentId === IND.id || catById.get(c.parentId)?.title === "Products")
    .map((c) => ({ c, before: links.filter((l) => l.dudaCategoryId === c.id && !hiddenNow.has(l.hubProductId)).length, after: after.filter((l) => l.dudaCategoryId === c.id && !hidden.has(l.hubProductId)).length }));
  const visible = hub.filter((h) => !hidden.has(h.id));
  const noChallenge = visible.filter((h) => !after.some((l) => l.hubProductId === h.id && catById.get(l.dudaCategoryId)?.parentId === SC.id)).map((h) => h.name);
  const noIndustry = visible.filter((h) => !after.some((l) => l.hubProductId === h.id && catById.get(l.dudaCategoryId)?.parentId === IND.id)).map((h) => h.name);

  const label = (k: string) => LOGO_FILES[k].label;
  const lines = [
    `# Phase 5b: SA Equip's answers`, ``,
    `**Generated:** ${new Date().toISOString()} by \`npm run catalogue:phase5b\` (${confirm ? "APPLY" : "dry run"}). Sections 1 to 4 of \`PHASE5B_INSTRUCTIONS.md\`.`, ``,
    `## Every logo switched OFF (${logoPlan.removes.length})`, ``, `| Product | Logo |`, `|---|---|`,
    ...logoPlan.removes.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key)).map((r) => `| ${md(r.name)} | ${label(r.key)} |`), ``,
    `## Every logo switched ON (${logoPlan.adds.length})`, ``, `| Product | Logo |`, `|---|---|`,
    ...logoPlan.adds.sort((a, b) => a.name.localeCompare(b.name)).map((r) => `| ${md(r.name)} | ${label(r.key)} |`), ``,
    `## Challenges and industries`, ``, `| Product | Field | Now | After |`, `|---|---|---|---|`,
    ...plan.changes.map((c) => `| ${md(c.name)} | ${c.field} | ${md(c.from.join("; ") || "—")} | ${md(c.to.join("; ") || "— (none)")} |`), ``,
    `Links: +${plan.adds.length} −${plan.removals.length}, reordered ${plan.reorders.length}. Categories (product types) untouched: flags ${plan.flags.length}.`, ``,
    `## Hidden (category links removed)`, ``, `| Product | Duda status | Links removed | Why |`, `|---|---|---|---|`, ...hideRows, ``,
    `## SKU`, ``, `| Product | Now | After |`, `|---|---|---|`, `| ${SKU.name} | ${skuRow?.p.sku ?? "(blank)"} | ${SKU.to} |`, ``,
    `## Other SA ENDURE / SAE / SE products not in the table (not changed)`, ``, ...(others.length ? others.map((o) => `- ${md(o)}`) : ["- None."]), ``,
    `## Safety check: SA ENDURE products`, ``, unsafePlanned.length ? unsafePlanned.map((u) => `- ✗ ${u}`).join("\n") : `- ✓ all ${ENDURE.length} SA ENDURE products: SA Endure on; SA Cyclone and every hazardous-area certification off; exactly the 7 industrial industries; no hazardous challenge.`, ``,
    `## Visible counts, before → after`, ``, `| Category | Before | After |`, `|---|---|---|`,
    ...counts.filter((x) => x.before !== x.after || catById.get(x.c.parentId)?.title === "Site Challenges").map((x) => `| ${md(`${catById.get(x.c.parentId)?.title} › ${x.c.title}`)} | ${x.before} | ${x.after} |`), ``,
    `## Visible products without a challenge or an industry`, ``,
    `- No challenge (${noChallenge.length}): ${noChallenge.join(", ") || "none"}`, `- No industry (${noIndustry.length}): ${noIndustry.join(", ") || "none"}`, ``,
    `## Checks`, ``, problems.length ? problems.map((p) => `- ✗ ${p}`).join("\n") : "- ✓ every product found and named as expected, no SKU clash, safety rule met.", ``,
  ];
  writeFileSync(path.join(out, "phase5b-plan.json"), JSON.stringify({ at: new Date().toISOString(), confirm, plan, logoPlan, hideRemovals, others, problems }, null, 2) + "\n");
  if (reportPath) writeFileSync(path.resolve(process.cwd(), reportPath), lines.join("\n"));

  console.log(`\n${confirm ? "Applying" : "Dry run —"} Phase 5b`);
  console.log(`  logos: OFF ${logoPlan.removes.length}, ON ${logoPlan.adds.length}`);
  console.log(`  challenges/industries: changes ${plan.changes.length}, links +${plan.adds.length} −${plan.removals.length}`);
  console.log(`  hide: ${HIDE.length}, links removed ${hideRemovals.length}; SKU: ${SKU.name} → ${SKU.to}`);
  console.log(`  other ENDURE/SAE/SE not in the table: ${others.length}`);
  console.log(`  visible without a challenge: ${noChallenge.length}; without an industry: ${noIndustry.length}`);
  console.log(problems.length ? `  ✗ ${problems.length} problem(s):\n    ${problems.join("\n    ")}` : "  ✓ all checks pass, including the safety rule");
  if (!confirm) { console.log("\nNothing written.\n"); return; }
  if (problems.length) throw new Error("refusing to apply while any check fails");

  writeFileSync(path.join(out, `hub-before-apply-${Date.now()}.json`), JSON.stringify({ productCategories: links, productLogos }, null, 2) + "\n");
  for (const x of HIDE) {
    const id = idOf(x);
    if (byId.get(id)?.status !== "HIDDEN") {
      const p = await duda.updateProduct(id, { status: "HIDDEN" });
      await syncHubProduct(p, prisma);
      if (p.status !== "HIDDEN") throw new Error(`${x.name}: Duda reports ${p.status}`);
    }
    console.log(`  ✓ hidden: ${x.name}`);
  }
  if (skuRow && skuRow.p.sku !== SKU.to) {
    const p = await duda.updateProduct(SKU.id, { sku: SKU.to });
    await syncHubProduct(p, prisma);
    if (p.sku !== SKU.to) throw new Error(`${SKU.name}: Duda reports SKU ${p.sku}`);
    console.log(`  ✓ SKU: ${SKU.name} → ${p.sku}`);
  }
  await prisma.$transaction([
    ...hideRemovals.map((r) => prisma.productCategory.deleteMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId } })),
    ...plan.removals.map((r) => prisma.productCategory.deleteMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId } })),
    prisma.productCategory.createMany({ data: plan.adds.map((a) => ({ hubProductId: a.hubProductId, dudaCategoryId: a.dudaCategoryId, sortOrder: a.sortOrder ?? null })), skipDuplicates: true }),
    ...plan.reorders.map((r) => prisma.productCategory.updateMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId }, data: { sortOrder: r.sortOrder ?? null } })),
    ...logoPlan.removes.map((r) => prisma.productLogo.deleteMany({ where: { hubProductId: r.hubProductId, logoId: r.logoId } })),
    prisma.productLogo.createMany({ data: logoPlan.adds.map((a) => ({ hubProductId: a.hubProductId, logoId: a.logoId })), skipDuplicates: true }),
  ]);
  // Re-read and re-check: the safety rule must hold on what is STORED, not on the plan.
  const storedLinks: Link[] = await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true, sortOrder: true } });
  const storedLogos: LogoLink[] = await prisma.productLogo.findMany({ select: { hubProductId: true, logoId: true } });
  const unsafe = safety(storedLinks, storedLogos);
  if (unsafe.length) throw new Error(`SAFETY CHECK FAILED after applying:\n    ${unsafe.join("\n    ")}`);
  const again = planAssignments({ wanted, links: storedLinks, cats, approvedCategoryChange: new Set() });
  const againLogos = planLogoToggles({ wanted: toggles, links: storedLogos, logoIdFor });
  if (again.adds.length || again.removals.length || again.reorders.length || againLogos.adds.length || againLogos.removes.length)
    throw new Error("applied, but a re-plan still finds differences — investigate before syncing");
  console.log(`  ✓ links +${plan.adds.length} −${plan.removals.length + hideRemovals.length}; logos OFF ${logoPlan.removes.length}, ON ${logoPlan.adds.length}`);
  console.log(`  ✓ safety re-checked on the stored data: all ${ENDURE.length} SA ENDURE products clean`);
  console.log(`\n✓ Applied. Next: npm run duda:sync-categories --workspace=backend (dry run), then -- --confirm.\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

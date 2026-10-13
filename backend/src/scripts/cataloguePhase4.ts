/**
 * Phase 4 of SA Equip's product assignment: everything that needs no answer
 * from SA Equip (docs/sa-equip-phase0/PHASE4_INSTRUCTIONS.md, steps B to E).
 *
 *   npm run catalogue:phase4 --workspace=backend -- --master ../docs/sa-equip-phase0/sa-equip-products.json \
 *     --report ../docs/sa-equip-phase0/PHASE4_DRY_RUN.md --out ../migration/backups/<dir>
 *   … --confirm      apply (after Josh approves the dry run)
 *
 *   B. hide the confirmed duplicate in Duda and remove its category links;
 *   C. two SKU updates in Duda;
 *   D. partial assignments for five HOLD products (challenges in the given
 *      order, industries from the sheet, category confirmed unchanged, SA logo
 *      switched ON only);
 *   E. two new products, created HIDDEN, with SA Equip's copy.
 *
 * Product data only: no pages, menus, SEO or publishing. Dry run by default.
 * Every Duda field it would change is read first and must still hold the value
 * the plan expects, so a change made by hand since the dry run stops the run
 * instead of being overwritten. --confirm writes Duda AND the Hub (the Hub is
 * live at once); `duda:sync-categories` then pushes the category links.
 *
 * ⚠️ POST /ecommerce/products is not idempotent: E checks for an existing
 * product with the same name or SKU first and records each created id in
 * `--out` immediately, so a re-run never creates a product twice.
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { CATEGORY_ROOT, duda, type DudaProduct } from "../services/duda.js";
import { stripAnchors } from "../services/anchors.js";
import { syncHubProduct } from "../services/hubProduct.js";
import { applyPlan, planAssignments, type Cat, type Link } from "./lib/taxonomyPlan.js";
import { planLogos } from "./lib/logoPlan.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");

/* ------------------------------------------------------------- the plan -- */

const HIDE = [{ id: "01M1XPVWR8EGD4KDMBRN0H4669", name: "EX Vapour Extraction System", sku: "SAPVES" }];

const SKUS = [
  { id: "01M1XPS4YM9H6KWZZJ01TNYBTT", name: "Portable Trolley", from: null as string | null, to: "SAAF/TR01" },
  { id: "01M1XPQTR5A31K13F5W5PZ9BPS", name: "EX 400VA Transformer", from: "SPTR" as string | null, to: "SPTR400" },
];

const FUME = "Fume, Dust, LEV and Vapour Control";
const LEV_CHALLENGES = ["Welding Fume Control", "Dust Extraction, Filtration and Containment", "Toxic Fume and Vapour Extraction"];
/** Industries come from the sheet; challenges, their order, the category and the SA logo from the instructions. */
const PARTIAL = [
  { ref: "D1", id: "01M1XPQTR5A31K13F5W5PZ9BPS", challenges: ["Temporary Power Distribution", "Shutdown and Turnaround Packages"], category: "Lighting and Power", logosOn: ["powernet"] },
  { ref: "D2", id: "01M1XPYYP79FXTPEN8S6Y7QHGN", challenges: ["Dust Extraction, Filtration and Containment", "Confined-Space Ventilation", "Shutdown and Turnaround Packages"], category: FUME, logosOn: ["endure"] },
  { ref: "D3", id: "01M1XPXAPZHT3A3DFJSA0T9H5S", challenges: LEV_CHALLENGES, category: FUME, logosOn: ["endure"] },
  { ref: "D4", id: "01M1XPW3A15CA51720DG3A798G", challenges: LEV_CHALLENGES, category: FUME, logosOn: ["endure"] },
  { ref: "D5", id: "01M1XPWJX7X6BKXZX2TB81VDAF", challenges: LEV_CHALLENGES, category: FUME, logosOn: ["endure"] },
];
const LOGO_FILES: Record<string, string> = { powernet: "powernet.jpg", endure: "endure.jpg" };

/**
 * SA Equip's copy, verbatim apart from two presentation choices: spec labels
 * in the catalogue's Title Case (which also reuses the translations those
 * labels already have), and E2's order codes as a list, because the
 * description renderer allows no tables.
 */
const NEW_PRODUCTS = [
  {
    ref: "E1",
    name: "SA ENDURE LED Max Light",
    sku: "SAML",
    descriptionHtml:
      "<p>The SA ENDURE Max Light is an exceptionally durable freestanding floodlight designed to deliver an even light output of almost 4,000 lumens over a wide area. Built for rigorous industrial environments such as aircraft maintenance facilities, shipyards, and heavy industry sites, it features a stable, robust design that keeps it secure even on rough surfaces. Linkable options allow multiple units to be connected from a single power supply.</p>",
    benefits: [
      "Powerful LED light spread (3,800 lumens, 180-degree beam).",
      "Suitable for use in all weather conditions.",
      "Low energy consumption with high light output.",
      "Freestanding stability on rough surfaces.",
      "Portable, lightweight, and switchable (on/off).",
      "Linkable variants enable multiple lights from one power supply.",
    ],
    specs: [
      ["Voltage Options", "12V, 24V, 42V, 48V, 110V, 230V"],
      ["Light Output", "3,800 lumens (180°)"],
      ["Light Source", "High-efficacy LEDs (50,000 hours lifespan)"],
      ["Operating Temperature", "-30°C to +50°C"],
      ["Ingress Protection", "IP54"],
      ["Plugs/Sockets", "IEC IP44, IEC IP67"],
      ["Cable Length", "5m (linkable) / 10m (non-linkable)"],
      ["Dimensions", "423mm (h) x 215mm (w) x 139mm (d)"],
      ["Weight", "1kg"],
    ],
  },
  {
    ref: "E2",
    name: "SA ENDURE LEV Accessories",
    sku: "SEHB/SEFD",
    descriptionHtml:
      "<p>The SA ENDURE range of LEV quick-release accessories has been developed in close collaboration with welding operatives to enhance the flexibility of SA LEV systems. The accessory range enables rapid installation, adjustment, and reconfiguration of ducting and extraction hoods right at the workface, even multiple times during a shift.</p>" +
      "<p><strong>Order codes</strong></p><ul>" +
      [
        ["SEHB/MB", "SA ENDURE Hood Swivel Bracket, Magnetic"],
        ["SEHB/SCS", "SA ENDURE Hood Swivel Bracket, Suction Cup"],
        ["SEHB/SB", "SA ENDURE Hood Swivel Bracket, Scaffold Clamp"],
        ["SEFD10/MB", "SA ENDURE 10cm Ducting Bracket, Magnetic"],
        ["SEFD10/SCS", "SA ENDURE 10cm Ducting Bracket, Suction Cup"],
        ["SEFD10/SB", "SA ENDURE 10cm Ducting Bracket, Scaffold Clamp"],
        ["SEFD10/FT", "SA ENDURE Fishtail LEV Hood with bracket keyway"],
        ["SEFD10/FL", "SA ENDURE Flared LEV Hood with bracket keyway"],
      ].map(([c, d]) => `<li><strong>${c}</strong>: ${d}</li>`).join("") +
      "</ul>",
    benefits: [
      "Complete range of mounting and connection options.",
      "Quick-release keyway connectivity for fast changes.",
      "Compatible with all SA Equip LEV systems.",
      "Enables fine adjustment to achieve compliance with HSE Guideline HSG258.",
      "Exceptionally robust and durable anodised aluminium construction.",
    ],
    specs: [] as string[][],
  },
];

/** The instructions' expected challenge counts after B to E (every product); everything else unchanged. */
const EXPECTED_CHALLENGES: Record<string, number> = {
  "Welding Fume Control": 3,
  "Toxic Fume and Vapour Extraction": 16,
  "Dust Extraction, Filtration and Containment": 10,
  "Temporary Power Distribution": 7,
  "Shutdown and Turnaround Packages": 29,
  "Confined-Space Ventilation": 17,
};

type SheetProduct = { status: string; duda_product_id: string; duda_name: string; site_challenges: string[]; site_challenges_display_order?: string[]; industries: string[] };
const md = (s: string) => s.replace(/\|/g, "\\|");
const list = (xs: string[]) => (xs.length ? xs.join("; ") : "—");

async function main() {
  const masterPath = arg("master");
  if (!masterPath) throw new Error("pass --master <path to sa-equip-products.json>");
  const out = path.resolve(process.cwd(), arg("out") ?? "../migration/backups/phase4");
  const reportPath = arg("report");
  mkdirSync(out, { recursive: true });
  const sheet = JSON.parse(readFileSync(masterPath, "utf8")) as { products: SheetProduct[] };

  const all = await duda.listAllProducts();
  const byId = new Map(all.map((p) => [p.id, p]));
  const need = (id: string, label: string): DudaProduct => {
    const p = byId.get(id);
    if (!p) throw new Error(`${label}: no Duda product ${id}`);
    return p;
  };
  const problems: string[] = [];
  const lines: string[] = [];
  lines.push(`# Phase 4 dry run: steps B to E`, ``);
  lines.push(`**Generated:** ${new Date().toISOString()} by \`npm run catalogue:phase4\` (${confirm ? "APPLY" : "dry run, nothing written"}).`);
  lines.push(`**Scope:** \`PHASE4_INSTRUCTIONS.md\` B to E. Product data only: no pages, menus, SEO or publishing.`, ``);

  /* B. hide the duplicate */
  const hub = await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true } });
  const hubByDuda = new Map(hub.map((h) => [h.dudaProductId, h]));
  const flat = await duda.listAllCategories();
  const cats: Cat[] = flat.map((c) => ({ id: c.id, title: c.title, parentId: c.parent_id || CATEGORY_ROOT }));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const title = (id: string) => {
    const c = catById.get(id);
    const p = c ? catById.get(c.parentId) : undefined;
    return c ? (p ? `${p.title} › ${c.title}` : c.title) : `(unknown ${id})`;
  };
  const links: Link[] = await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true, sortOrder: true } });

  lines.push(`## B. Hide the confirmed duplicate`, ``, `| Product | Duda status | Category links removed |`, `|---|---|---|`);
  const hideRemovals: Link[] = [];
  for (const h of HIDE) {
    const p = need(h.id, "B");
    if (p.name !== h.name || p.sku !== h.sku) problems.push(`B: ${h.id} is "${p.name}" (${p.sku}), not "${h.name}" (${h.sku})`);
    const hp = hubByDuda.get(h.id);
    const mine = hp ? links.filter((l) => l.hubProductId === hp.id) : [];
    hideRemovals.push(...mine);
    lines.push(`| ${md(p.name ?? "")} (${p.sku}) | ${p.status} → HIDDEN | ${mine.length ? mine.map((l) => title(l.dudaCategoryId)).join("; ") : "none"} |`);
    const inbound = hp ? await prisma.compatibleLink.count({ where: { relatedHubProductId: hp.id } }) : 0;
    lines.push(``, `Before deleting it later: ${inbound} other product(s) list it under Compatible Products. A hidden product is already left out of every public listing and carousel.`, ``);
  }

  /* C. SKU updates */
  lines.push(`## C. SKU updates`, ``, `| Product | Now | After |`, `|---|---|---|`);
  for (const s of SKUS) {
    const p = need(s.id, "C");
    const now = p.sku ?? null;
    if (p.name !== s.name) problems.push(`C: ${s.id} is "${p.name}", not "${s.name}"`);
    if ((now || null) !== (s.from || null) && now !== s.to) problems.push(`C: ${s.name} has SKU ${JSON.stringify(now)}, expected ${JSON.stringify(s.from)}`);
    const clash = all.filter((x) => x.id !== s.id && x.sku === s.to).map((x) => x.name);
    if (clash.length) problems.push(`C: SKU ${s.to} is already on ${clash.join(", ")}`);
    lines.push(`| ${md(s.name)} | ${now ?? "(blank)"} | ${now === s.to ? `${s.to} (already)` : s.to} |`);
  }
  lines.push(``, `The Tasklight Floor Stand and Base Unit SKUs are not touched. After this, \`SPTR\` is on the EX 3.8KVA Transformer only.`, ``);

  /* D. partial assignments */
  const logos = await prisma.logo.findMany({ include: { mediaAsset: { select: { filename: true } } } });
  const logoIdFor = new Map(
    Object.entries(LOGO_FILES).map(([k, f]) => {
      const hits = logos.filter((l) => l.kind === "SA_LOGO" && l.mediaAsset?.filename === f);
      if (hits.length !== 1) throw new Error(`logo "${k}" matches ${hits.length} catalogue logos`);
      return [k, hits[0].id];
    }),
  );
  const wanted = PARTIAL.map((d) => {
    const s = sheet.products.find((x) => x.duda_product_id === d.id);
    if (!s) throw new Error(`${d.ref}: ${d.id} is not in the sheet`);
    const h = hubByDuda.get(d.id);
    if (!h) throw new Error(`${d.ref}: no Hub row for ${s.duda_name}`);
    const notInSheet = d.challenges.filter((c) => !s.site_challenges.includes(c));
    if (notInSheet.length) problems.push(`${d.ref} ${s.duda_name}: ${notInSheet.join(", ")} is not among the sheet's challenges`);
    return { d, s, h };
  });
  const dPlan = planAssignments({
    wanted: wanted.map(({ d, s, h }) => ({
      hubProductId: h.id,
      dudaProductId: d.id,
      name: h.name ?? s.duda_name,
      category: d.category,
      siteChallenges: d.challenges,
      siteChallengesOrder: d.challenges,
      industries: s.industries,
    })),
    links,
    cats,
    approvedCategoryChange: new Set(), // "confirm it's what Duda has now, and don't change it"
  });
  for (const f of dPlan.flags) problems.push(`D ${f.name}: the category is ${list(f.from)}, not ${list(f.to)} — the instructions say it is unchanged`);
  const productLogos = await prisma.productLogo.findMany({ select: { hubProductId: true, logoId: true } });
  const lPlan = planLogos({
    wanted: wanted.map(({ d, s, h }) => ({ hubProductId: h.id, dudaProductId: d.id, name: h.name ?? s.duda_name, toggles: Object.fromEntries(d.logosOn.map((k) => [k, true])) })),
    links: productLogos,
    logoIdFor,
  });

  lines.push(`## D. Partial assignments for 5 held products`, ``);
  lines.push(`| Ref | Product | Site Challenges (card order) | Industries | Category | SA logo |`, `|---|---|---|---|---|---|`);
  for (const { d, s, h } of wanted) {
    const ch = dPlan.changes.find((c) => c.dudaProductId === d.id && c.field === "Site Challenges");
    const ind = dPlan.changes.find((c) => c.dudaProductId === d.id && c.field === "Industries");
    const flag = dPlan.flags.find((f) => f.dudaProductId === d.id);
    const on = lPlan.adds.filter((a) => a.dudaProductId === d.id).map((a) => a.key);
    lines.push(
      `| ${d.ref} | ${md(h.name ?? s.duda_name)} | ${ch ? `${list(ch.from)} → **${list(ch.to)}**` : `unchanged (${list(d.challenges)})`} | ${ind ? `${list(ind.from)} → ${ind.to.length} industries` : "unchanged"} | ${flag ? `✗ ${list(flag.from)}` : `${d.category} (unchanged)`} | ${d.logosOn.map((k) => (on.includes(k) ? `SA ${k[0].toUpperCase()}${k.slice(1)} → ON` : `SA ${k[0].toUpperCase()}${k.slice(1)} (already on)`)).join(", ")} |`,
    );
  }
  lines.push(``, `Industries, from the sheet:`, ``);
  for (const { d, s, h } of wanted) lines.push(`- **${d.ref} ${md(h.name ?? s.duda_name)}** (${s.industries.length}): ${s.industries.join("; ")}`);
  lines.push(``, `Left out, as instructed: Hydrogen and Hazardous-Gas Ventilation (D1), Paint and Coating Drying (D2). Certification and zone logos are not touched.`, ``);
  const orderDiffs = wanted.filter(({ d, s }) => {
    const sheetOrder = (s.site_challenges_display_order ?? []).filter((c) => d.challenges.includes(c));
    return sheetOrder.join("|") !== d.challenges.join("|");
  });
  if (orderDiffs.length) {
    lines.push(`⚠️ **Order differs from the sheet's \`site_challenges_display_order\`** (which decides the two labels a card shows). The plan follows the instructions:`, ``);
    for (const { d, s } of orderDiffs) lines.push(`- ${d.ref} ${md(s.duda_name)}: instructions **${d.challenges.join(" > ")}**; sheet **${(s.site_challenges_display_order ?? []).filter((c) => d.challenges.includes(c)).join(" > ")}**`);
    lines.push(``);
  }

  /* counts after B + D (every product: these are what the site shows) */
  const gone = new Set(hideRemovals.map((l) => `${l.hubProductId}|${l.dudaCategoryId}`));
  const afterB = links.filter((l) => !gone.has(`${l.hubProductId}|${l.dudaCategoryId}`));
  const afterD = applyPlan(afterB, planAssignments({
    wanted: wanted.map(({ d, s, h }) => ({ hubProductId: h.id, dudaProductId: d.id, name: h.name ?? s.duda_name, category: d.category, siteChallenges: d.challenges, siteChallengesOrder: d.challenges, industries: s.industries })),
    links: afterB, cats, approvedCategoryChange: new Set(),
  }));
  const count = (set: Link[], id: string) => set.filter((l) => l.dudaCategoryId === id).length;
  lines.push(`## Category counts after B and D (every product)`, ``, `| Category | Now | After | Expected | |`, `|---|---|---|---|---|`);
  for (const parent of ["Site Challenges", "Industries", "Products"]) {
    const P = cats.find((c) => c.parentId === CATEGORY_ROOT && c.title === parent)!;
    for (const c of cats.filter((x) => x.parentId === P.id)) {
      const now = count(links, c.id), after = count(afterD, c.id);
      const exp = parent === "Site Challenges" ? EXPECTED_CHALLENGES[c.title] ?? now : null;
      const ok = exp == null ? (after === now ? "" : "changes") : after === exp ? "✓" : "✗";
      if (ok === "✗") problems.push(`${c.title}: expected ${exp}, would be ${after}`);
      if (now !== after || exp != null) lines.push(`| ${md(`${parent} › ${c.title}`)} | ${now} | ${after} | ${exp ?? "—"} | ${ok} |`);
    }
  }
  lines.push(``, `Rows not listed do not change. Industries change only through D's five products.`, ``);

  /* E. new products */
  const ledgerPath = path.join(out, "phase4-created.json");
  const ledger: Record<string, string> = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : {};
  lines.push(`## E. Two new products, created HIDDEN`, ``);
  for (const n of NEW_PRODUCTS) {
    const existing = all.filter((p) => (p.name ?? "").toLowerCase() === n.name.toLowerCase() || p.sku === n.sku || p.id === ledger[n.ref]);
    if (existing.length && !ledger[n.ref]) problems.push(`E ${n.name}: a product with that name or SKU already exists (${existing.map((p) => p.id).join(", ")})`);
    lines.push(`### ${n.ref}. ${n.name}, SKU \`${n.sku}\``, ``);
    lines.push(`- **Duda:** ${existing.length ? `already exists (${existing[0].id}), not created again` : `create, status HIDDEN, type PHYSICAL, price 0.00 GBP (as 74 of 96 products are), web address /product/${n.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} (Duda's own)`}. Duda gets the description; it cannot take links, and there are none.`);
    lines.push(`- **Hub:** the same description for the Overview tab; ${n.benefits.length} key benefits; ${n.specs.length ? `${n.specs.length} spec rows` : "no spec rows (the order codes are in the description, as instructed)"}.`);
    lines.push(`- **Not added:** categories, challenges, industries, logos, images, SEO. The text is English only until the pre-launch translation pass.`, ``);
    lines.push(`Description:`, ``, "```html", n.descriptionHtml.replace(/<\/(p|ul|li)>/g, "</$1>\n").trim(), "```", ``);
    lines.push(`Key benefits:`, ``, ...n.benefits.map((b) => `- ${b}`), ``);
    if (n.specs.length) lines.push(`| Specification | Value |`, `|---|---|`, ...n.specs.map(([l, v]) => `| ${md(l)} | ${md(v)} |`), ``);
  }

  lines.push(`## Checks`, ``, problems.length ? problems.map((p) => `- ✗ ${p}`).join("\n") : `- ✓ every product found and named as expected, no SKU clash, no existing product with a new name or SKU, every category unchanged, every expected count met.`, ``);
  writeFileSync(path.join(out, "phase4-plan.json"), JSON.stringify({ at: new Date().toISOString(), confirm, hideRemovals, dPlan, lPlan: lPlan.adds, problems }, null, 2) + "\n");
  if (reportPath) writeFileSync(path.resolve(process.cwd(), reportPath), lines.join("\n"));

  console.log(`\n${confirm ? "Applying" : "Dry run —"} Phase 4 B–E`);
  console.log(`  B: hide ${HIDE.length}, remove ${hideRemovals.length} category link(s)`);
  console.log(`  C: ${SKUS.length} SKU update(s)`);
  console.log(`  D: challenges/industries changes ${dPlan.changes.length}, links +${dPlan.adds.length} −${dPlan.removals.length}, logos on ${lPlan.adds.length}, flags ${dPlan.flags.length}`);
  console.log(`  E: ${NEW_PRODUCTS.length} new product(s), HIDDEN`);
  console.log(problems.length ? `  ✗ ${problems.length} problem(s):\n    ${problems.join("\n    ")}` : "  ✓ all checks pass");
  if (reportPath) console.log(`  report: ${path.resolve(process.cwd(), reportPath)}`);
  if (!confirm) {
    console.log("\nNothing written. Re-run with --confirm to apply.\n");
    return;
  }
  if (problems.length) throw new Error("refusing to apply while any check fails");

  /* ------------------------------------------------------------ apply -- */
  writeFileSync(path.join(out, `hub-before-apply-${Date.now()}.json`), JSON.stringify({ productCategories: links, productLogos }, null, 2) + "\n");
  for (const h of HIDE) {
    const p = await duda.updateProduct(h.id, { status: "HIDDEN" });
    await syncHubProduct(p, prisma);
    console.log(`  ✓ B ${h.name} → ${p.status}`);
  }
  await prisma.$transaction(hideRemovals.map((r) => prisma.productCategory.deleteMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId } })));
  console.log(`  ✓ B ${hideRemovals.length} category link(s) removed`);
  for (const s of SKUS) {
    const p = await duda.updateProduct(s.id, { sku: s.to });
    await syncHubProduct(p, prisma);
    if (p.sku !== s.to) throw new Error(`C ${s.name}: Duda reports SKU ${p.sku}, not ${s.to}`);
    console.log(`  ✓ C ${s.name} → ${p.sku}`);
  }
  const fresh: Link[] = await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true, sortOrder: true } });
  const d2 = planAssignments({
    wanted: wanted.map(({ d, s, h }) => ({ hubProductId: h.id, dudaProductId: d.id, name: h.name ?? s.duda_name, category: d.category, siteChallenges: d.challenges, siteChallengesOrder: d.challenges, industries: s.industries })),
    links: fresh, cats, approvedCategoryChange: new Set(),
  });
  await prisma.$transaction([
    ...d2.removals.map((r) => prisma.productCategory.deleteMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId } })),
    prisma.productCategory.createMany({ data: d2.adds.map((a) => ({ hubProductId: a.hubProductId, dudaCategoryId: a.dudaCategoryId, sortOrder: a.sortOrder ?? null })), skipDuplicates: true }),
    ...d2.reorders.map((r) => prisma.productCategory.updateMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId }, data: { sortOrder: r.sortOrder ?? null } })),
    prisma.productLogo.createMany({ data: lPlan.adds.map((a) => ({ hubProductId: a.hubProductId, logoId: a.logoId })), skipDuplicates: true }),
  ]);
  console.log(`  ✓ D links +${d2.adds.length} −${d2.removals.length}, logos on ${lPlan.adds.length}`);
  for (const n of NEW_PRODUCTS) {
    if (ledger[n.ref] || all.some((p) => p.sku === n.sku || (p.name ?? "").toLowerCase() === n.name.toLowerCase())) {
      console.log(`  • E ${n.name} already exists — not created again`);
      continue;
    }
    const created = await duda.createProduct({
      name: n.name,
      sku: n.sku,
      status: "HIDDEN",
      type: "PHYSICAL",
      description: stripAnchors(n.descriptionHtml),
      prices: [{ price: "0.0" }],
    });
    ledger[n.ref] = created.id;
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n"); // before anything else can fail
    const hp = await syncHubProduct(created, prisma, { descriptionHtml: n.descriptionHtml });
    await prisma.$transaction([
      prisma.specRow.createMany({ data: n.specs.map(([label, value], i) => ({ hubProductId: hp.id, label, value, sortOrder: i })) }),
      prisma.productTextItem.createMany({ data: n.benefits.map((text, i) => ({ hubProductId: hp.id, kind: "BENEFIT" as const, text, sortOrder: i })) }),
    ]);
    console.log(`  ✓ E ${n.name} created HIDDEN (${created.id}), ${n.specs.length} specs, ${n.benefits.length} benefits`);
  }
  console.log(`\n✓ Applied. Next: npm run duda:sync-categories --workspace=backend (dry run), then -- --confirm.\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

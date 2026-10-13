/**
 * Assign Site Challenges, Industries and the product type from SA Equip's
 * master sheet (Phase 2 of docs/sa-equip-phase0/CURSOR_BRIEF.md). READY
 * products only; HOLD, NEW_PRODUCT_HOLD and products not in the sheet are
 * never touched.
 *
 *   npm run taxonomy:assign --workspace=backend -- --master ../docs/sa-equip-phase0/sa-equip-products.json \
 *     --report ../docs/sa-equip-phase0/PHASE2_DRY_RUN.md --out ../migration/backups/<dir>
 *   … --confirm      apply to the Hub (after Josh approves the dry run)
 *
 * Dry run by default: plans every change (product, field, old → new), checks
 * the result against the brief's expected counts, and writes the report and a
 * JSON copy of the plan. Writes nothing to the database or to Duda.
 *
 * ⚠️ --confirm writes the HUB, and the Hub is what the live site's listing
 * pages, filters and carousels read, so it shows at once — no Duda publish is
 * involved. Duda's own copy changes only when `duda:sync-categories` is run
 * afterwards. Every ProductCategory row is snapshotted to --out first.
 *
 * The rules (replace per branch, parent link held exactly when a child is,
 * only approved type changes) live in lib/taxonomyPlan.ts.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { duda } from "../services/duda.js";
import { applyPlan, CATEGORY_ROOT, INDUSTRIES, planAssignments, PRODUCTS, SITE_CHALLENGES, type Cat, type Link } from "./lib/taxonomyPlan.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");

/**
 * The only two READY products whose type the brief says changes: Climate
 * Control and Heating → Lighting and Power. Any other difference is flagged.
 */
const APPROVED_CATEGORY_CHANGE = new Map([
  ["01M1XPSGR38B1RVS17TQQB1VTM", "SA LUMIN Tasklight Adjustable Floor Stand"],
  ["01M1XPSEZ4N8AVNXQT684ZZFAG", "SA LUMIN Tasklight Base Unit"],
]);

/** Expected counts after Phase 2, READY products only — the brief's tables, verbatim. */
const EXPECTED: Record<string, Record<string, number>> = {
  [SITE_CHALLENGES]: {
    "Welding Fume Control": 0,
    "Dust Extraction, Filtration and Containment": 6,
    "Toxic Fume and Vapour Extraction": 13,
    "Paint Spray Fume Control": 1,
    "Hydrogen and Hazardous-Gas Ventilation": 27,
    "Confined-Space Ventilation": 16,
    "Tank and Vessel Entry": 52,
    "Hazardous-Area Lighting": 36,
    "Temporary Power Distribution": 6,
    "Shutdown and Turnaround Packages": 27,
    "Paint and Coating Drying": 21,
    "Humidity and Condensation Control": 2,
    "Hazardous-Area Cooling": 1,
    "Temporary and Process Heating": 7,
    "Equipment and Material Protection": 9,
  },
  [INDUSTRIES]: {
    "Distilleries & Breweries": 70,
    Pharmaceuticals: 53,
    "Rail & Transport Engineering": 53,
    "Aviation & Aerospace": 53,
    "Renewables & Hydrogen": 69,
    "Petrochemical & Chemical Processing": 71,
    Utilities: 71,
    Nuclear: 69,
    "Marine & Commercial Ship Repair": 71,
    "Construction & Major Projects": 55,
    "Oil & Gas": 71,
    "Defence & Naval Shipbuilding": 69,
  },
  [PRODUCTS]: {
    "Lighting and Power": 42,
    "Fume, Dust, LEV and Vapour Control": 21,
    "Climate Control and Heating": 9,
  },
};

type SheetProduct = {
  status: string;
  duda_product_id: string;
  duda_name: string;
  category: string | null;
  site_challenges: string[] | null;
  industries: string[] | null;
};

const list = (xs: string[]) => (xs.length ? xs.join("; ") : "—");
const md = (s: string) => s.replace(/\|/g, "\\|");

async function main() {
  const masterPath = arg("master");
  if (!masterPath) throw new Error("pass --master <path to sa-equip-products.json>");
  const out = path.resolve(process.cwd(), arg("out") ?? "../migration/backups/phase2");
  const reportPath = arg("report");
  mkdirSync(out, { recursive: true });

  const sheet = JSON.parse(readFileSync(masterPath, "utf8")) as { products: SheetProduct[] };
  const ready = sheet.products.filter((p) => p.status === "READY");
  for (const [id, name] of APPROVED_CATEGORY_CHANGE) {
    const p = ready.find((r) => r.duda_product_id === id);
    if (!p || p.duda_name !== name) throw new Error(`approved category change ${id} is not the READY "${name}" in the sheet`);
  }

  const hub = await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true } });
  const hubByDuda = new Map(hub.map((h) => [h.dudaProductId, h]));
  const missing = ready.filter((p) => !hubByDuda.has(p.duda_product_id));
  if (missing.length) throw new Error(`no Hub row for: ${missing.map((p) => `${p.duda_name} (${p.duda_product_id})`).join(", ")}`);
  const nameDiffs = ready.filter((p) => hubByDuda.get(p.duda_product_id)!.name !== p.duda_name);

  // Duda's tree is authoritative for ids, titles and parents; the mirror is
  // what the public listings read, so the two must agree before we rely on it.
  const flat = await duda.listAllCategories();
  const cats: Cat[] = flat.map((c) => ({ id: c.id, title: c.title, parentId: c.parent_id || CATEGORY_ROOT }));
  const mirror = await prisma.categoryMirror.findMany();
  const mirrorById = new Map(mirror.map((m) => [m.dudaCategoryId, m]));
  const mirrorDrift = cats.filter((c) => {
    const m = mirrorById.get(c.id);
    return !m || m.title !== c.title || (m.parentId || CATEGORY_ROOT) !== c.parentId;
  });
  if (mirrorDrift.length) throw new Error(`the Hub mirror disagrees with Duda on: ${mirrorDrift.map((c) => c.title).join(", ")} — run duda:sync-categories (dry run) first`);

  const links: Link[] = await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true } });
  const wanted = ready.map((p) => ({
    hubProductId: hubByDuda.get(p.duda_product_id)!.id,
    dudaProductId: p.duda_product_id,
    name: hubByDuda.get(p.duda_product_id)!.name ?? p.duda_name,
    category: p.category,
    siteChallenges: p.site_challenges,
    industries: p.industries,
  }));
  const plan = planAssignments({ wanted, links, cats, approvedCategoryChange: new Set(APPROVED_CATEGORY_CHANGE.keys()) });
  const after = applyPlan(links, plan);

  // Counts per child category: READY products (the brief's tables) and all.
  const readyIds = new Set(wanted.map((w) => w.hubProductId));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const parentByTitle = new Map(cats.filter((c) => c.parentId === CATEGORY_ROOT).map((c) => [c.title, c]));
  const count = (set: Link[], catId: string, onlyReady: boolean) =>
    set.filter((l) => l.dudaCategoryId === catId && (!onlyReady || readyIds.has(l.hubProductId))).length;
  const tables = Object.entries(EXPECTED).map(([parentTitle, rows]) => {
    const parent = parentByTitle.get(parentTitle)!;
    const kids = cats.filter((c) => c.parentId === parent.id);
    const extra = kids.filter((k) => !(k.title in rows));
    if (extra.length) throw new Error(`"${parentTitle}" has children the brief does not list: ${extra.map((k) => k.title).join(", ")}`);
    return {
      parentTitle,
      rows: Object.entries(rows).map(([t, expected]) => {
        const c = kids.find((k) => k.title === t);
        if (!c) throw new Error(`"${t}" is not a category under "${parentTitle}"`);
        return { title: t, expected, now: count(links, c.id, true), after: count(after, c.id, true), allAfter: count(after, c.id, false) };
      }),
    };
  });
  const mismatches = tables.flatMap((t) => t.rows.filter((r) => r.after !== r.expected).map((r) => `${t.parentTitle} › ${r.title}: expected ${r.expected}, would be ${r.after}`));

  // What duda:sync-categories will push afterwards, per category.
  const perCat = new Map<string, { add: number; remove: number }>();
  const bump = (id: string, k: "add" | "remove") => {
    const e = perCat.get(id) ?? { add: 0, remove: 0 };
    e[k]++;
    perCat.set(id, e);
  };
  plan.adds.forEach((a) => bump(a.dudaCategoryId, "add"));
  plan.removals.forEach((r) => bump(r.dudaCategoryId, "remove"));
  const byField = (f: string) => plan.changes.filter((c) => c.field === f).length;

  const lines: string[] = [];
  lines.push(`# Phase 2 dry run: challenges, industries and categories`, ``);
  lines.push(`**Generated:** ${new Date().toISOString()} by \`npm run taxonomy:assign\` (dry run, nothing written).`);
  lines.push(`**Source:** \`sa-equip-products.json\`, READY products only (${ready.length}). HOLD, NEW_PRODUCT_HOLD and products not in the sheet are not touched.`, ``);
  lines.push(`## Summary`, ``, `| | Count |`, `|---|---|`);
  lines.push(`| Products whose Site Challenges change | ${byField("Site Challenges")} |`);
  lines.push(`| Products whose Industries change | ${byField("Industries")} |`);
  lines.push(`| Products whose category changes | ${byField("Category")} |`);
  lines.push(`| Category differences flagged, not changed | ${plan.flags.length} |`);
  lines.push(`| Category links to add | ${plan.adds.length} |`);
  lines.push(`| Category links to remove | ${plan.removals.length} |`);
  lines.push(`| Category links now → after (all products) | ${links.length} → ${after.length} |`, ``);
  if (plan.flags.length) {
    lines.push(`## Flagged, not changed`, ``, `| Product | Now | Sheet |`, `|---|---|---|`);
    plan.flags.forEach((f) => lines.push(`| ${md(f.name)} | ${md(list(f.from))} | ${md(list(f.to))} |`));
    lines.push(``);
  }
  if (nameDiffs.length) {
    lines.push(`## Names that differ between the Hub and the sheet's \`duda_name\` (matched by ID; nothing renamed)`, ``);
    nameDiffs.forEach((p) => lines.push(`- ${md(hubByDuda.get(p.duda_product_id)!.name ?? "(no name)")} ← sheet: ${md(p.duda_name)}`));
    lines.push(``);
  }
  lines.push(`## Expected vs after (READY products)`, ``);
  for (const t of tables) {
    lines.push(`### ${t.parentTitle === PRODUCTS ? "Category" : t.parentTitle}`, ``, `| ${t.parentTitle === PRODUCTS ? "Category" : "Name"} | Brief | Now | After | | All products after |`, `|---|---|---|---|---|---|`);
    t.rows.forEach((r) => lines.push(`| ${md(r.title)} | ${r.expected} | ${r.now} | ${r.after} | ${r.after === r.expected ? "✓" : "✗"} | ${r.allAfter} |`));
    lines.push(``);
  }
  lines.push(`## What \`duda:sync-categories\` would push to Duda afterwards`, ``, `| Category | Add | Remove |`, `|---|---|---|`);
  [...perCat.entries()]
    .map(([id, e]) => ({ c: catById.get(id)!, e }))
    .sort((a, b) => a.c.parentId.localeCompare(b.c.parentId) || a.c.title.localeCompare(b.c.title))
    .forEach(({ c, e }) => {
      const p = catById.get(c.parentId);
      lines.push(`| ${md(p ? `${p.title} › ${c.title}` : c.title)} | ${e.add} | ${e.remove} |`);
    });
  lines.push(``, `## Every change (product, field, now → after)`, ``, `| Product | Field | Now | After |`, `|---|---|---|---|`);
  const order = new Map(ready.map((p, i) => [p.duda_product_id, i]));
  [...plan.changes]
    .sort((a, b) => order.get(a.dudaProductId)! - order.get(b.dudaProductId)!)
    .forEach((c) => lines.push(`| ${md(c.name)} | ${c.field} | ${md(list(c.from))} | ${md(list(c.to))} |`));
  lines.push(``);

  writeFileSync(path.join(out, "phase2-plan.json"), JSON.stringify({ at: new Date().toISOString(), confirm, plan, tables }, null, 2) + "\n");
  if (reportPath) writeFileSync(path.resolve(process.cwd(), reportPath), lines.join("\n"));

  console.log(`\n${confirm ? "Applying" : "Dry run —"} ${ready.length} READY products`);
  console.log(`  changes: Site Challenges ${byField("Site Challenges")}, Industries ${byField("Industries")}, Category ${byField("Category")}; flagged ${plan.flags.length}`);
  console.log(`  links: +${plan.adds.length} −${plan.removals.length}  (${links.length} → ${after.length})`);
  console.log(mismatches.length ? `  ✗ ${mismatches.length} count(s) differ from the brief:\n    ${mismatches.join("\n    ")}` : "  ✓ every count matches the brief");
  if (nameDiffs.length) console.log(`  ${nameDiffs.length} name(s) differ from the sheet's duda_name (matched by id; nothing renamed)`);
  console.log(`  plan: ${path.join(out, "phase2-plan.json")}${reportPath ? `\n  report: ${path.resolve(process.cwd(), reportPath)}` : ""}`);

  if (!confirm) {
    console.log("\nNothing written. Re-run with --confirm to apply to the Hub.\n");
    return;
  }
  if (mismatches.length) throw new Error("refusing to apply: the counts above differ from the brief");

  const all = await prisma.productCategory.findMany();
  writeFileSync(path.join(out, `hub-product-categories-before-apply-${Date.now()}.json`), JSON.stringify(all, null, 2) + "\n");
  await prisma.$transaction([
    ...plan.removals.map((r) => prisma.productCategory.deleteMany({ where: { hubProductId: r.hubProductId, dudaCategoryId: r.dudaCategoryId } })),
    prisma.productCategory.createMany({ data: plan.adds, skipDuplicates: true }),
  ]);
  const reread: Link[] = await prisma.productCategory.findMany({ select: { hubProductId: true, dudaCategoryId: true } });
  const again = planAssignments({ wanted, links: reread, cats, approvedCategoryChange: new Set(APPROVED_CATEGORY_CHANGE.keys()) });
  if (again.changes.length || again.adds.length || again.removals.length) throw new Error(`applied, but a re-plan still finds ${again.changes.length} change(s) — investigate before syncing`);
  console.log(`\n✓ Applied: ${reread.length} links in the Hub. Next: npm run duda:sync-categories --workspace=backend (dry run), then -- --confirm.\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

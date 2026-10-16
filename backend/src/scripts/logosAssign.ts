/**
 * Switch logo toggles ON from SA Equip's master sheet (Phase 3 of
 * docs/sa-equip-phase0/CURSOR_BRIEF.md). READY products only.
 *
 *   npm run logos:assign --workspace=backend -- --master ../docs/sa-equip-phase0/sa-equip-products.json \
 *     --report ../docs/sa-equip-phase0/PHASE3_DRY_RUN.md --out ../migration/backups/<dir>
 *   … --confirm      apply to the Hub (after Josh approves the dry run)
 *
 * Dry run by default. ⚠️ ON ONLY: nothing here can switch a logo off (see
 * lib/logoPlan.ts). A sheet `false` on a logo that is currently ON is listed for
 * SA Equip to confirm and left on; `null` is never touched.
 *
 * ⚠️ --confirm writes the HUB, which the live product pages and listing cards
 * read directly, so the logos show at once; no Duda publish is involved. Every
 * ProductLogo row is snapshotted to --out first.
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { planLogos, type LogoChange, type LogoLink } from "./lib/logoPlan.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const confirm = process.argv.includes("--confirm");

type Group = "SA range logos" | "Certification logos" | "Zone logos";
/**
 * Sheet key → catalogue logo, resolved by kind + media FILE exactly as the
 * WordPress import resolves its tokens (CERT_LOGO_FILES / SA_LOGO_FILES): labels
 * get renamed and once had typos, files do not.
 */
const KEYS: Record<string, { kind: "SA_LOGO" | "CERT_LOGO"; file: string; label: string; group: Group }> = {
  cyclone: { kind: "SA_LOGO", file: "cyclone.jpg", label: "SA Cyclone", group: "SA range logos" },
  endure: { kind: "SA_LOGO", file: "endure.jpg", label: "SA Endure", group: "SA range logos" },
  flexiheat: { kind: "SA_LOGO", file: "flexiheat.jpg", label: "SA Flexiheat", group: "SA range logos" },
  lumin: { kind: "SA_LOGO", file: "lumin.jpg", label: "SA Lumin", group: "SA range logos" },
  powernet: { kind: "SA_LOGO", file: "powernet.jpg", label: "SA Powernet", group: "SA range logos" },
  rental: { kind: "SA_LOGO", file: "rental.jpg", label: "SA Rental", group: "SA range logos" },
  ex_logo: { kind: "CERT_LOGO", file: "ex-logo.png", label: "Ex", group: "Certification logos" },
  iecex: { kind: "CERT_LOGO", file: "IECEx_Logo.png", label: "IECEx", group: "Certification logos" },
  inmetro: { kind: "CERT_LOGO", file: "Inmetro.png", label: "Inmetro", group: "Certification logos" },
  ukca: { kind: "CERT_LOGO", file: "ukca.png", label: "UKCA", group: "Certification logos" },
  made_in_britain: { kind: "CERT_LOGO", file: "made-in-britain-flag.png", label: "Made in Britain", group: "Certification logos" },
  zone_0: { kind: "CERT_LOGO", file: "zone-0.png", label: "Zone 0", group: "Zone logos" },
  zone_1_2: { kind: "CERT_LOGO", file: "zone-1-2.png", label: "Zone 1-2", group: "Zone logos" },
  zone_20: { kind: "CERT_LOGO", file: "zone-20.png", label: "Zone 20", group: "Zone logos" },
  zone_21_22: { kind: "CERT_LOGO", file: "zone-21-22.png", label: "Zone 21-22", group: "Zone logos" },
};
const GROUPS: Group[] = ["SA range logos", "Certification logos", "Zone logos"];

/** Expected "on" counts after Phase 3, READY products — the brief's list, verbatim. */
const EXPECTED_ON: Record<string, number> = {
  cyclone: 23, endure: 0, flexiheat: 7, lumin: 36, powernet: 6,
  ex_logo: 44, iecex: 43, inmetro: 19, zone_0: 3, zone_1_2: 44, zone_20: 1, zone_21_22: 37,
};

type SheetProduct = {
  status: string;
  duda_product_id: string;
  duda_name: string;
  sa_range_logos: Record<string, boolean | null>;
  cert_logos: Record<string, boolean | null>;
};
const md = (s: string) => s.replace(/\|/g, "\\|");

async function main() {
  const masterPath = arg("master");
  if (!masterPath) throw new Error("pass --master <path to sa-equip-products.json>");
  const out = path.resolve(process.cwd(), arg("out") ?? "../migration/backups/phase3");
  const reportPath = arg("report");
  mkdirSync(out, { recursive: true });

  const sheet = JSON.parse(readFileSync(masterPath, "utf8")) as { products: SheetProduct[] };
  const ready = sheet.products.filter((p) => p.status === "READY");

  // Resolve every key to exactly one catalogue logo, or stop before planning.
  const logos = await prisma.logo.findMany({ include: { mediaAsset: { select: { filename: true } } } });
  const logoIdFor = new Map<string, string>();
  for (const [key, k] of Object.entries(KEYS)) {
    const hits = logos.filter((l) => l.kind === k.kind && l.mediaAsset?.filename === k.file);
    if (hits.length !== 1) throw new Error(`sheet key "${key}" matches ${hits.length} catalogue logos (file ${k.file}) — resolve by hand first`);
    logoIdFor.set(key, hits[0].id);
  }

  const hub = await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true } });
  const hubByDuda = new Map(hub.map((h) => [h.dudaProductId, h]));
  const missing = ready.filter((p) => !hubByDuda.has(p.duda_product_id));
  if (missing.length) throw new Error(`no Hub row for: ${missing.map((p) => `${p.duda_name} (${p.duda_product_id})`).join(", ")}`);

  const links: LogoLink[] = await prisma.productLogo.findMany({ select: { hubProductId: true, logoId: true } });
  const wanted = ready.map((p) => ({
    hubProductId: hubByDuda.get(p.duda_product_id)!.id,
    dudaProductId: p.duda_product_id,
    name: hubByDuda.get(p.duda_product_id)!.name ?? p.duda_name,
    toggles: { ...p.sa_range_logos, ...p.cert_logos },
  }));
  const plan = planLogos({ wanted, links, logoIdFor });

  // Counts per key, READY products only.
  const readyIds = new Set(wanted.map((w) => w.hubProductId));
  const onNow = (logoId: string) => links.filter((l) => l.logoId === logoId && readyIds.has(l.hubProductId)).length;
  const rows = Object.entries(KEYS).map(([key, k]) => {
    const logoId = logoIdFor.get(key)!;
    const sheetOn = ready.filter((p) => ({ ...p.sa_range_logos, ...p.cert_logos })[key] === true).length;
    const nulls = ready.filter((p) => ({ ...p.sa_range_logos, ...p.cert_logos })[key] == null).length;
    const now = onNow(logoId);
    const adds = plan.adds.filter((a) => a.key === key).length;
    const held = plan.heldOn.filter((h) => h.key === key).length;
    return { key, label: k.label, group: k.group, brief: EXPECTED_ON[key] ?? null, sheetOn, nulls, now, adds, after: now + adds, held };
  });
  // The sheet's ON count must be the brief's, and "after" must be exactly the
  // sheet's ON plus what is held on — anything else is a data or logic problem.
  const problems = rows.flatMap((r) => [
    ...(r.brief != null && r.sheetOn !== r.brief ? [`${r.label}: the sheet turns ${r.sheetOn} on, the brief expects ${r.brief}`] : []),
    ...(r.brief != null && r.after !== r.sheetOn + r.held ? [`${r.label}: after ${r.after} ≠ sheet ${r.sheetOn} + held ${r.held}`] : []),
  ]);

  const lines: string[] = [];
  const byProduct = (xs: LogoChange[]) => {
    const m = new Map<string, { name: string; keys: string[] }>();
    for (const x of xs) {
      if (!m.has(x.dudaProductId)) m.set(x.dudaProductId, { name: x.name, keys: [] });
      m.get(x.dudaProductId)!.keys.push(KEYS[x.key].label);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  };
  lines.push(`# Phase 3 dry run: logo toggles`, ``);
  lines.push(`**Generated:** ${new Date().toISOString()} by \`npm run logos:assign\` (dry run, nothing written).`);
  lines.push(`**Source:** \`sa-equip-products.json\`, READY products only (${ready.length}). **ON only**: no logo is switched off. \`null\` (UKCA, Made in Britain, SA Rental) is not touched.`, ``);
  lines.push(`## Summary`, ``, `| | Toggles | Products |`, `|---|---|---|`);
  for (const g of GROUPS) {
    const xs = plan.adds.filter((a) => KEYS[a.key].group === g);
    lines.push(`| Switched ON: ${g} | ${xs.length} | ${new Set(xs.map((x) => x.dudaProductId)).size} |`);
  }
  lines.push(`| **Switched ON: total** | **${plan.adds.length}** | **${new Set(plan.adds.map((x) => x.dudaProductId)).size}** |`);
  lines.push(`| Switched OFF | 0 | 0 |`);
  lines.push(`| Sheet says OFF but currently ON (left on, for SA Equip) | ${plan.heldOn.length} | ${new Set(plan.heldOn.map((x) => x.dudaProductId)).size} |`, ``);

  lines.push(`## Every toggle that would change (switched ON)`, ``);
  for (const g of GROUPS) {
    const xs = plan.adds.filter((a) => KEYS[a.key].group === g);
    lines.push(`### ${g} (${xs.length})`, ``);
    if (!xs.length) { lines.push(`None.`, ``); continue; }
    lines.push(`| Product | Switched ON |`, `|---|---|`);
    byProduct(xs).forEach((p) => lines.push(`| ${md(p.name)} | ${p.keys.join(", ")} |`));
    lines.push(``);
  }
  lines.push(`## Sheet says OFF, currently ON: NOT changed (for SA Equip to confirm)`, ``);
  if (!plan.heldOn.length) lines.push(`None.`, ``);
  else {
    lines.push(`| Product | Logo | Group |`, `|---|---|---|`);
    [...plan.heldOn].sort((a, b) => a.key.localeCompare(b.key) || a.name.localeCompare(b.name))
      .forEach((h) => lines.push(`| ${md(h.name)} | ${KEYS[h.key].label} | ${KEYS[h.key].group} |`));
    lines.push(``);
  }
  lines.push(`## On-counts vs the brief (READY products)`, ``);
  lines.push(`The brief's counts assume OFFs are applied too. With ON only, "After" = the sheet's ON count plus the logos held on.`, ``);
  lines.push(`| Logo | Brief | Sheet says ON | Now | Switched ON | After (ON only) | Held on | Check |`, `|---|---|---|---|---|---|---|---|`);
  for (const r of rows) {
    const check = r.brief == null ? `not touched (null on ${r.nulls})` : r.after === r.sheetOn + r.held && r.sheetOn === r.brief ? (r.held ? `✓ brief + ${r.held} held` : "✓") : "✗";
    lines.push(`| ${r.label} | ${r.brief ?? "—"} | ${r.brief == null ? "—" : r.sheetOn} | ${r.now} | ${r.adds} | ${r.after} | ${r.held} | ${check} |`);
  }
  lines.push(``);

  writeFileSync(path.join(out, "phase3-plan.json"), JSON.stringify({ at: new Date().toISOString(), confirm, plan, rows }, null, 2) + "\n");
  if (reportPath) writeFileSync(path.resolve(process.cwd(), reportPath), lines.join("\n"));

  console.log(`\n${confirm ? "Applying" : "Dry run —"} ${ready.length} READY products, ON only`);
  for (const g of GROUPS) console.log(`  ${g.padEnd(20)} switched ON ${plan.adds.filter((a) => KEYS[a.key].group === g).length}`);
  console.log(`  held on (sheet says off) ${plan.heldOn.length}`);
  console.log(problems.length ? `  ✗ ${problems.length} problem(s):\n    ${problems.join("\n    ")}` : "  ✓ every count reconciles with the brief");
  console.log(`  plan: ${path.join(out, "phase3-plan.json")}${reportPath ? `\n  report: ${path.resolve(process.cwd(), reportPath)}` : ""}`);

  if (!confirm) {
    console.log("\nNothing written. Re-run with --confirm to apply to the Hub.\n");
    return;
  }
  if (problems.length) throw new Error("refusing to apply: the counts above do not reconcile");
  writeFileSync(path.join(out, `hub-product-logos-before-apply-${Date.now()}.json`), JSON.stringify(await prisma.productLogo.findMany(), null, 2) + "\n");
  await prisma.productLogo.createMany({ data: plan.adds.map((a) => ({ hubProductId: a.hubProductId, logoId: a.logoId })), skipDuplicates: true });
  const again = planLogos({ wanted, links: await prisma.productLogo.findMany({ select: { hubProductId: true, logoId: true } }), logoIdFor });
  if (again.adds.length) throw new Error(`applied, but ${again.adds.length} toggle(s) are still off — investigate`);
  console.log(`\n✓ Applied: ${plan.adds.length} logos switched on, none switched off.\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

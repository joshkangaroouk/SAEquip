/**
 * Hire/Purchase as the OLD site offered it, and "What do you need?" on the
 * filtration units (Josh, 15 Oct 2026).
 *
 *   npm run catalogue:old-site-options --workspace=backend -- --plan <hire-purchase-plan.json> [--confirm]
 *
 * The plan (one entry per visible product, built from the live WordPress
 * pages' Hire/Purchase choice) says per product: hp ["Hire","Purchase"],
 * ["Purchase"], ["Hire"], [] (no choice at all) or null (leave as it is).
 *   - The store's "Hire/Purchase" option carries exactly those choices, Hire
 *     first; [] removes it.
 *   - The SA Rental logo is ON exactly when Hire is offered (null: untouched).
 *   - The Filtration Unit (SAFU) is not an accessory (its main-product flag).
 *   - "What do you need?" goes FIRST on the units in FILTERS: the unit, then
 *     the replacement filters the old site listed for it. Existing options
 *     (Filter Type) are kept. A filter is sold, never hired: the Add to Quote
 *     widget records Purchase for any choice but the unit (the FIRST one).
 *     Choices named with the earlier " (purchase only)" suffix are renamed in
 *     place (same id), so a re-run never brings the suffix back.
 *
 * Options go through updateOptionsPreservingVariations(); a product whose
 * variations carry data that would be lost stops the run first. Dry run by default.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { duda, type DudaOption, type DudaOptionRef } from "../services/duda.js";
import { updateOptionsPreservingVariations } from "../services/productOptions.js";

const confirm = process.argv.includes("--confirm");
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HP_NAME = "Hire/Purchase";
const WDYN = "What do you need?";
const P = "";
/** The suffix the filter choices carried until 2026-10-15 (Josh asked for it to go). */
const OLD_SUFFIX = " (purchase only)";
const G4 = `G4 Filter (Stage 1)${P}`, F7 = `F7 Bag Filter (Stage 2)${P}`, HEPA = `HEPA H14 Filter (Stage 2)${P}`;
/** Unit first, then the filters as the old site listed them for that unit. */
const FILTERS: { sku: string; name: string; choices: string[]; from: string }[] = [
  {
    sku: "SAECFU", name: "Compact Filtration Unit (SAECFU)", from: "its own page's Filters choice",
    choices: ["Compact Filtration Unit", G4, F7, HEPA, `Dust Filter Bundle (12 panel filters & 24 compact bag filters)${P}`],
  },
  {
    sku: "SAFU", name: "Filtration Unit", from: "its replacement-filter products (SAFU/RF)",
    choices: [
      "Filtration Unit", G4, F7, HEPA,
      `Activated Carbon Cartridge – Set of 9 (Stage 3)${P}`, `Activated Carbon Cartridge – Single (Stage 3)${P}`,
      `Vapour Filter Set${P}`, `2 Stage Standard Dust Filter Set${P}`, `2 Stage Breathable Dust Filter Set${P}`, `3 Stage Breathable Dust Filter Set${P}`,
    ],
  },
];
const UNFLAG_ACCESSORY = { sku: "SAFU", name: "Filtration Unit" };

type PlanItem = { dudaId: string; name: string; hp: ("Hire" | "Purchase")[] | null; source: string };

async function main() {
  const planPath = arg("plan");
  if (!planPath) throw new Error("pass --plan <hire-purchase-plan.json>");
  const plan = JSON.parse(readFileSync(path.resolve(process.cwd(), planPath), "utf8")) as PlanItem[];
  const planBy = new Map(plan.map((p) => [p.dudaId, p]));

  const options = (await duda.listOptions()).results ?? [];
  const hp = options.find((o) => o.name === HP_NAME);
  if (!hp) throw new Error(`no "${HP_NAME}" option`);
  const hpChoice = (v: string) => hp.choices.find((c) => c.value === v)!.id;
  let wdyn: DudaOption | undefined = options.find((o) => o.name === WDYN);
  const wanted = [...new Set(FILTERS.flatMap((f) => f.choices))];
  // An old-suffixed choice whose plain name is wanted (and not already there) is renamed in place.
  const renames = (wdyn?.choices ?? [])
    .filter((c) => c.value.endsWith(OLD_SUFFIX))
    .map((c) => ({ id: c.id, from: c.value, to: c.value.slice(0, -OLD_SUFFIX.length) }))
    .filter((r) => wanted.includes(r.to) && !wdyn!.choices.some((c) => c.value === r.to));
  const renamed = (v: string) => renames.find((r) => r.from === v)?.to ?? v;
  // Every comparison below sees the names as they will be once renamed.
  if (wdyn) wdyn = { ...wdyn, choices: wdyn.choices.map((c) => ({ ...c, value: renamed(c.value) })) };
  const missingChoices = wanted.filter((v) => !wdyn?.choices.some((c) => c.value === v));

  const rental = (await prisma.logo.findMany({ where: { kind: "SA_LOGO" }, include: { mediaAsset: { select: { filename: true } } } }))
    .filter((l) => /rental/i.test(`${l.label} ${l.alt} ${l.mediaAsset.filename}`));
  if (rental.length !== 1) throw new Error("expected one SA Rental logo");
  const rentalId = rental[0].id;

  const all = await duda.listAllProducts();
  const visible = all.filter((p) => p.status === "ACTIVE");
  const hub = await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, isAccessory: true, logos: { select: { logoId: true } } } });
  const hubBy = new Map(hub.map((h) => [h.dudaProductId, h]));
  const missingPlan = visible.filter((p) => !planBy.has(p.id));
  if (missingPlan.length) throw new Error(`not in the plan: ${missingPlan.map((p) => p.name).join(", ")}`);
  for (const f of [...FILTERS, UNFLAG_ACCESSORY]) {
    const p = visible.find((x) => x.sku === f.sku);
    if (!p || p.name !== f.name) throw new Error(`SKU ${f.sku} is "${p?.name}", not "${f.name}"`);
  }
  const unflag = visible.find((p) => p.sku === UNFLAG_ACCESSORY.sku)!;

  console.log(`\n${confirm ? "Applying" : "Dry run —"} Hire/Purchase from the old site, and "${WDYN}"`);
  console.log(`  ${UNFLAG_ACCESSORY.name}: accessory ${hubBy.get(unflag.id)!.isAccessory ? "→ main product" : "already a main product"}`);
  console.log(`  "${WDYN}": ${wdyn ? "in the store" : `to create (${options.length} of 20 options used)`}${missingChoices.length ? `; ${missingChoices.length} choice(s) to add` : ""}${renames.length ? `; ${renames.length} choice(s) to rename in place` : ""}`);
  for (const r of renames) console.log(`    "${r.from}" → "${r.to}"`);

  // Desired refs per product: What do you need? first, others kept, Hire/Purchase last.
  type Change = { p: (typeof visible)[number]; refs: (DudaOptionRef & { name: string; values: string[] })[]; hpLine: string; filterLine: string };
  const changes: Change[] = [];
  const rentalOn: string[] = [], rentalOff: string[] = [];
  for (const p of visible) {
    const item = planBy.get(p.id)!;
    const cur = (p.options ?? []).map((o) => ({ id: o.id, name: o.name, choiceIds: (o.choices ?? []).map((c) => c.id), values: (o.choices ?? []).map((c) => (o.name === WDYN ? renamed : String)((c as { value: string }).value)) }));
    const f = FILTERS.find((x) => x.sku === p.sku && x.name === p.name);
    const refs: Change["refs"] = [];
    if (f) refs.push({ id: wdyn?.id ?? "(new)", name: WDYN, choiceIds: f.choices.map((v) => wdyn?.choices.find((c) => c.value === v)?.id ?? `(new:${v})`), values: f.choices });
    for (const o of cur) if (o.id !== hp.id && o.name !== WDYN) refs.push(o);
    const curHp = cur.find((o) => o.id === hp.id);
    const hpWant = item.hp === null ? (curHp ? curHp.values : []) : item.hp;
    if (hpWant.length) refs.push({ id: hp.id, name: HP_NAME, choiceIds: hpWant.map(hpChoice), values: hpWant });
    const key = (rs: { id: string; values: string[] }[]) => rs.map((r) => `${r.id}:${r.values.join("|")}`).join(" + ");
    if (key(refs) !== key(cur)) {
      changes.push({
        p, refs,
        hpLine: `${curHp ? curHp.values.join("/") : "none"} → ${hpWant.length ? hpWant.join("/") : "none"}`,
        filterLine: f ? `${WDYN} ${f.choices.length - 1} filters (from ${f.from})` : "",
      });
    }
    if (item.hp !== null) {
      const on = hubBy.get(p.id)!.logos.some((l) => l.logoId === rentalId);
      const want = item.hp.includes("Hire");
      if (want && !on) rentalOn.push(p.name);
      if (!want && on) rentalOff.push(p.name);
    }
  }
  const atRisk = changes.filter((c) => (c.p.variations ?? []).some((v) => v.sku || (v.price_difference && Number(v.price_difference) !== 0) || (v.status && v.status !== "ACTIVE")));
  if (atRisk.length) throw new Error(`variation data would be lost on: ${atRisk.map((c) => c.p.name).join(", ")}`);
  for (const c of changes) {
    const n = c.refs.reduce((t, r) => t * r.values.length, 1);
    console.log(`  ${c.p.name}: Hire/Purchase ${c.hpLine}${c.filterLine ? `; ${c.filterLine}` : ""} (${n} variations)`);
    if (n > 300) throw new Error(`${c.p.name}: ${n} variations is over Duda's 300`);
  }
  console.log(`  SA Rental ON: ${rentalOn.join("; ") || "none"}`);
  console.log(`  SA Rental OFF: ${rentalOff.join("; ") || "none"}`);
  console.log(`  left as they are: ${plan.filter((p) => p.hp === null).map((p) => `${p.name} (${p.source})`).join("; ")}`);
  if (!confirm) { console.log("\nNothing written.\n"); return; }

  await prisma.hubProduct.update({ where: { dudaProductId: unflag.id }, data: { isAccessory: false } });
  for (const r of renames) await duda.updateOptionChoice(wdyn!.id, r.id, r.to);
  if (!wdyn) wdyn = await duda.createOption({ name: WDYN, type: "TEXT", choices: wanted });
  else for (const v of missingChoices) wdyn = await duda.addOptionChoice(wdyn.id, v);
  const w = wdyn;
  const failed: string[] = [];
  for (const c of changes) {
    const refs = c.refs.map((r) => (r.name === WDYN ? { id: w.id, choiceIds: r.values.map((v) => w.choices.find((x) => x.value === v)!.id) } : { id: r.id, choiceIds: r.choiceIds }));
    try {
      const rep = await updateOptionsPreservingVariations(c.p.id, refs);
      if (rep.dropped.length || rep.failed.length) failed.push(`${c.p.name}: dropped ${rep.dropped.length}, failed ${rep.failed.length}`);
    } catch (e) {
      failed.push(`${c.p.name}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(300);
  }
  const hubId = (name: string) => hubBy.get(visible.find((p) => p.name === name)!.id)!.id;
  await prisma.productLogo.createMany({ data: rentalOn.map((n) => ({ hubProductId: hubId(n), logoId: rentalId })), skipDuplicates: true });
  await prisma.productLogo.deleteMany({ where: { logoId: rentalId, hubProductId: { in: rentalOff.map(hubId) } } });

  // Verify against what Duda and the Hub now hold.
  const after = await duda.listAllProducts();
  const hubAfter = new Map((await prisma.hubProduct.findMany({ select: { dudaProductId: true, logos: { select: { logoId: true } } } })).map((h) => [h.dudaProductId, h]));
  const wrong: string[] = [];
  for (const c of changes) {
    const a = after.find((p) => p.id === c.p.id)!;
    const got = (a.options ?? []).map((o) => `${o.name}:${(o.choices ?? []).map((x) => (x as { value: string }).value).join("|")}`).join(" + ");
    const want = c.refs.map((r) => `${r.name}:${r.values.join("|")}`).join(" + ");
    if (got !== want) wrong.push(`${c.p.name}: ${got}`);
  }
  for (const n of rentalOn) if (!hubAfter.get(visible.find((p) => p.name === n)!.id)!.logos.some((l) => l.logoId === rentalId)) wrong.push(`${n}: Rental still off`);
  for (const n of rentalOff) if (hubAfter.get(visible.find((p) => p.name === n)!.id)!.logos.some((l) => l.logoId === rentalId)) wrong.push(`${n}: Rental still on`);
  console.log(`  ✓ written. Check: ${wrong.length ? "✗ " + wrong.join("; ") : `all ${changes.length} products and the Rental logo as planned`}${failed.length ? `\n  ✗ ${failed.join("; ")}` : ""}\n`);
  if (wrong.length || failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

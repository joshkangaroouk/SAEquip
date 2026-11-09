/**
 * A "Both" choice wherever Hire AND Purchase are offered (Josh, 28 Oct 2026).
 *
 *   npm run catalogue:hire-purchase-both --workspace=backend [-- --confirm]
 *
 * Worked out from what Duda holds NOW, not from the old-site plan, so nothing
 * changed since that plan is undone:
 *   - "Both" is added to the store's "Hire/Purchase" option if it is missing;
 *   - every product (hidden ones too) whose Hire/Purchase exposes both Hire
 *     and Purchase gets Both after them, so Hire stays first, which is the
 *     choice Duda pre-selects. Purchase-only and Hire-only products are left
 *     alone, and so are their other options (Filter Type);
 *   - "Both" is stored as an English option label (DudaTranslation "en"), as
 *     i18n:sync-duda does for the others, so the basket and the quotes staff
 *     receive read it by id.
 *
 * Options go through updateOptionsPreservingVariations(). Adding a choice to
 * an option a product already has maps every old combination one-to-one onto
 * a new one, so SKUs and prices carry across; any dropped or failed restore
 * is reported and fails the run. Dry run by default; re-running is a no-op.
 */
import "dotenv/config";
import { prisma } from "../prisma.js";
import { duda } from "../services/duda.js";
import { updateOptionsPreservingVariations } from "../services/productOptions.js";

const confirm = process.argv.includes("--confirm");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HP_NAME = "Hire/Purchase";
const BOTH = "Both";
const MAX_VARIATIONS = 300;

const valuesOf = (o: { choices?: { id: string }[] | null }) =>
  (o.choices ?? []).map((c) => ({ id: c.id, value: (c as { value?: string }).value ?? "" }));

async function main() {
  let hp = ((await duda.listOptions()).results ?? []).find((o) => o.name === HP_NAME);
  if (!hp) throw new Error(`no "${HP_NAME}" option in the store`);
  const choice = (v: string) => valuesOf(hp!).find((c) => c.value === v)?.id;
  const hire = choice("Hire"), purchase = choice("Purchase");
  if (!hire || !purchase) throw new Error(`"${HP_NAME}" has no Hire or no Purchase choice`);

  const all = await duda.listAllProducts();
  type Plan = { id: string; name: string; status: string; refs: { id: string; choiceIds: string[] }[]; variations: number; hpLine: string };
  const plans: Plan[] = [];
  let already = 0;
  for (const p of all) {
    const opts = p.options ?? [];
    const cur = opts.find((o) => o.id === hp!.id);
    if (!cur) continue;
    const ids = valuesOf(cur).map((c) => c.id);
    if (!ids.includes(hire) || !ids.includes(purchase)) continue;
    const both = choice(BOTH);
    if (both && ids.includes(both)) { already++; continue; }
    const refs = opts.map((o) => ({
      id: o.id,
      // "Both" stands in for its id until it exists (dry run before it is created).
      choiceIds: o.id === hp!.id ? [...ids, both ?? BOTH] : valuesOf(o).map((c) => c.id),
    }));
    const variations = refs.reduce((t, r) => t * r.choiceIds.length, 1);
    if (variations > MAX_VARIATIONS) throw new Error(`${p.name}: ${variations} variations is over Duda's ${MAX_VARIATIONS}`);
    plans.push({
      id: p.id, name: p.name, status: p.status ?? "?", refs, variations,
      hpLine: `${valuesOf(cur).map((c) => c.value).join("/")} → +${BOTH}`,
    });
  }

  console.log(`\n${confirm ? "Applying" : "Dry run —"} "${BOTH}" on every product offering Hire and Purchase`);
  console.log(`  store option "${HP_NAME}": ${choice(BOTH) ? `already has "${BOTH}"` : `"${BOTH}" will be added`}`);
  for (const p of plans) console.log(`  ${p.name}${p.status === "ACTIVE" ? "" : ` [${p.status}]`}: ${p.hpLine} (${p.variations} variations)`);
  console.log(`  ${plans.length} to change, ${already} already have "${BOTH}"`);
  if (!confirm) { console.log("\nNothing written.\n"); return; }

  if (!choice(BOTH)) hp = await duda.addOptionChoice(hp.id, BOTH);
  const bothId = choice(BOTH);
  if (!bothId) throw new Error(`"${BOTH}" was not added to "${HP_NAME}"`);
  for (const [entity, dudaId, text] of [["OPTION", hp.id, HP_NAME], ["CHOICE", bothId, BOTH]] as const) {
    await prisma.dudaTranslation.upsert({
      where: { locale_entity_dudaId: { locale: "en", entity, dudaId } },
      create: { locale: "en", entity, dudaId, text, sourceText: text },
      update: { text, sourceText: text },
    });
  }

  const problems: string[] = [];
  let restored = 0;
  for (const p of plans) {
    const refs = p.refs.map((r) => ({ id: r.id, choiceIds: r.choiceIds.map((c) => (c === BOTH ? bothId : c)) }));
    try {
      const rep = await updateOptionsPreservingVariations(p.id, refs);
      restored += rep.restored;
      if (rep.dropped.length || rep.failed.length) problems.push(`${p.name}: dropped ${rep.dropped.join(", ") || 0}, failed ${rep.failed.length}`);
    } catch (e) {
      problems.push(`${p.name}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(300);
  }

  // Verify against what Duda now holds.
  const after = new Map((await duda.listAllProducts()).map((p) => [p.id, p]));
  for (const p of plans) {
    const a = after.get(p.id);
    const got = a?.options?.find((o) => o.id === hp!.id);
    const vals = got ? valuesOf(got).map((c) => c.value) : [];
    if (vals.join("|") !== [...vals.filter((v) => v !== BOTH), BOTH].join("|") || vals[0] !== "Hire" || !vals.includes("Purchase"))
      problems.push(`${p.name}: Hire/Purchase is now ${vals.join("/") || "none"}`);
    if ((a?.variations ?? []).length !== p.variations) problems.push(`${p.name}: ${(a?.variations ?? []).length} variations, expected ${p.variations}`);
  }
  console.log(`\n  ${plans.length} products updated, ${restored} variation(s) carried their data across`);
  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s):\n    ${problems.join("\n    ")}\n`);
    process.exitCode = 1;
  } else console.log(`  ✓ verified: every one now offers Hire/Purchase/${BOTH}\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

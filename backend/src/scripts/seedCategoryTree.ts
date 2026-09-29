/**
 * Build the three-parent category tree in Duda.
 *
 * Dry run (default — reports exactly what would change, writes nothing):
 *   npm run duda:seed-category-tree --workspace=backend
 *
 * Apply:
 *   npm run duda:seed-category-tree --workspace=backend -- --confirm
 *
 * Print the live tree:
 *   npm run duda:seed-category-tree --workspace=backend -- --verify
 *
 * The shape:
 *
 *   Products                     Industries              Site Challenges
 *     Lighting and Power           Aviation & Aerospace    Welding Fume Control
 *     Climate Control…             Oil & Gas               Dust Extraction…
 *     Fume, Dust, LEV…             …                       …
 *
 * ⚠️ The children are derived from the HUB'S TAGS, not hardcoded. Two reasons:
 * the names match what was actually authored rather than a transcription of
 * them, and Stage 3 (retiring tags) can then map each tag to its category by
 * title with no lookup table to drift.
 *
 * ⚠️ Calls `duda.*` directly rather than `POST /api/categories`. That route
 * re-lists every category to validate the parent on each nested create, which
 * would be ~20 extra full listings for one run.
 *
 * Idempotent: matching is on title, case-insensitively, so a re-run adopts what
 * already exists instead of creating duplicates.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { duda, CATEGORY_ROOT, type DudaCategorySummary } from "../services/duda.js";

const prisma = new PrismaClient();

// ---------------------------------------------------------------- argv helpers

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gentle pacing — services/duda.ts has no rate-limit handling of its own. */
const DELAY_MS = 250;

/** The parent that adopts whatever is already at the top level. */
const PRODUCTS_PARENT = "Products";

const norm = (s: string) => s.trim().toLowerCase();

/** Print the live tree, depth-first, with each category's Duda product count. */
async function verify(): Promise<void> {
  const cats = await duda.listAllCategories();
  const byParent = new Map<string, DudaCategorySummary[]>();
  for (const c of cats) {
    const k = c.parent_id || CATEGORY_ROOT;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  console.log(`\n${cats.length} categories:\n`);
  const walk = (p: string, d: number) => {
    for (const c of byParent.get(p) ?? []) {
      console.log(`  ${"  ".repeat(d)}${d === 0 ? "" : "└ "}${c.title}  [${c.products_count}]`);
      walk(c.id, d + 1);
    }
  };
  walk(CATEGORY_ROOT, 0);
  // A parent deleted in Duda strands its children: buildTree() surfaces them at
  // the root rather than dropping them, so they are reachable but misplaced.
  const orphans = cats.filter(
    (c) => (c.parent_id || CATEGORY_ROOT) !== CATEGORY_ROOT && !cats.some((x) => x.id === c.parent_id),
  );
  console.log(`\n  orphans (parent missing): ${orphans.length}`);
  for (const o of orphans) console.log(`     ${o.title}`);
  console.log();
}

async function main() {
  const confirm = flag("confirm");

  if (flag("verify")) {
    await verify();
    return;
  }

  const groups = await prisma.tagGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { tags: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  if (!groups.length) fail("No tag groups found — nothing to derive the tree from.");

  const existing = await duda.listAllCategories();
  const byTitle = new Map<string, DudaCategorySummary>(existing.map((c) => [norm(c.title), c]));

  /*
   * Everything at the top level BEFORE this run is the product taxonomy, and
   * moves under Products. Captured up front so categories created below are
   * never swept up by it — and listed in full in the dry run, because "move
   * whatever is at the root" is exactly the kind of rule that should not be
   * taken on trust.
   */
  const parentTitles = new Set([PRODUCTS_PARENT, ...groups.map((g) => g.name)].map(norm));
  const toAdopt = existing.filter(
    (c) => (c.parent_id || CATEGORY_ROOT) === CATEGORY_ROOT && !parentTitles.has(norm(c.title)),
  );

  console.log(`\n${confirm ? "Applying" : "Dry run —"} category tree\n`);
  console.log(`  Duda has ${existing.length} categor${existing.length === 1 ? "y" : "ies"} today`);
  console.log(
    `  ${toAdopt.length} top-level categor${toAdopt.length === 1 ? "y" : "ies"} will move under “${PRODUCTS_PARENT}”:`,
  );
  for (const c of toAdopt) console.log(`      ${c.title}`);
  if (!confirm) console.log();

  let created = 0;
  let adopted = 0;
  let moved = 0;
  const failures: string[] = [];

  /** Create a category, or adopt the existing one with that title. */
  const ensure = async (title: string, parentId: string): Promise<string | null> => {
    const hit = byTitle.get(norm(title));
    if (hit) {
      adopted++;
      console.log(`  ⊘ ${title.padEnd(44)} already exists`);
      return hit.id;
    }
    if (!confirm) {
      console.log(`  + ${title.padEnd(44)} would be created`);
      created++;
      return null;
    }
    try {
      const made = await duda.createCategory({ title, parent_id: parentId });
      byTitle.set(norm(title), made as unknown as DudaCategorySummary);
      created++;
      console.log(`  ✓ ${title.padEnd(44)} created`);
      await sleep(DELAY_MS);
      return made.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 140) : String(err);
      failures.push(`${title}: ${msg}`);
      console.log(`  ✗ ${title.padEnd(44)} ${msg}`);
      return null;
    }
  };

  // --- the three parents ---
  console.log(`\n── parents ──`);
  const productsId = await ensure(PRODUCTS_PARENT, CATEGORY_ROOT);
  const groupParentId = new Map<string, string | null>();
  for (const g of groups) groupParentId.set(g.id, await ensure(g.name, CATEGORY_ROOT));

  // --- adopt the existing product taxonomy ---
  if (toAdopt.length) {
    console.log(`\n── moving the existing categories under ${PRODUCTS_PARENT} ──`);
    for (const c of toAdopt) {
      if (!confirm) {
        console.log(`  → ${c.title.padEnd(44)} would move`);
        moved++;
        continue;
      }
      if (!productsId) {
        failures.push(`${c.title}: no "${PRODUCTS_PARENT}" parent to move it under`);
        continue;
      }
      try {
        await duda.updateCategory(c.id, { parent_id: productsId });
        moved++;
        console.log(`  ✓ ${c.title.padEnd(44)} moved`);
        await sleep(DELAY_MS);
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 140) : String(err);
        failures.push(`${c.title}: ${msg}`);
        console.log(`  ✗ ${c.title.padEnd(44)} ${msg}`);
      }
    }
  }

  // --- a child per tag, under its group's parent ---
  for (const g of groups) {
    console.log(`\n── ${g.name} (${g.tags.length} from tags) ──`);
    const parentId = groupParentId.get(g.id);
    for (const t of g.tags) {
      if (!parentId && confirm) {
        failures.push(`${t.name}: no "${g.name}" parent to nest under`);
        continue;
      }
      await ensure(t.name, parentId ?? CATEGORY_ROOT);
    }
  }

  console.log(`\n=== CATEGORY TREE ===`);
  console.log(`  created          : ${created}${confirm ? "" : " (would be)"}`);
  console.log(`  already existed  : ${adopted}`);
  console.log(`  moved under ${PRODUCTS_PARENT.padEnd(4)}: ${moved}${confirm ? "" : " (would be)"}`);
  console.log(`  failed           : ${failures.length}`);
  for (const f of failures) console.log(`     ${f}`);

  if (!confirm) {
    console.log(`\n  Re-run with --confirm to apply.\n`);
  } else {
    console.log(`\n  Next: npm run duda:sync-categories --workspace=backend\n`);
  }
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

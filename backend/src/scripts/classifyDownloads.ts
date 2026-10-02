/**
 * Give every existing download its resources-page type (and certificate scheme),
 * from the title it was imported with.
 *
 *   npm run downloads:classify --workspace=backend              # dry run
 *   npm run downloads:classify --workspace=backend -- --confirm # writes
 *   npm run downloads:classify --workspace=backend -- --confirm --force  # re-classify typed rows too
 *
 * Only rows with no type are touched unless --force, so a type set by hand in
 * the product editor is never overwritten. An unrecognised title stops the run
 * before ANY write and is named — see TITLE_CLASSIFICATION.
 */
import { prisma } from "../prisma.js";
import { TITLE_CLASSIFICATION } from "../services/downloadKinds.js";

const confirm = process.argv.includes("--confirm");
const force = process.argv.includes("--force");

async function main() {
  const rows = await prisma.download.findMany({
    include: { hubProduct: { select: { name: true } } },
    orderBy: [{ hubProductId: "asc" }, { sortOrder: "asc" }],
  });
  const todo = rows.filter((r) => force || r.kind === null);

  const unmapped = todo.filter((r) => !TITLE_CLASSIFICATION[r.title.trim()]);
  if (unmapped.length) {
    console.error(`\n✗ ${unmapped.length} download(s) have a title with no known type — nothing written:`);
    for (const r of unmapped) console.error(`    ${r.hubProduct.name}: "${r.title}"`);
    console.error("  Add the title to TITLE_CLASSIFICATION in services/downloadKinds.ts, or type them in the editor.\n");
    process.exitCode = 1;
    return;
  }

  let changed = 0;
  for (const r of todo) {
    const c = TITLE_CLASSIFICATION[r.title.trim()];
    if (r.kind === c.kind && r.certScheme === c.certScheme) continue;
    changed++;
    if (confirm) await prisma.download.update({ where: { id: r.id }, data: { kind: c.kind, certScheme: c.certScheme } });
  }

  // What each page will list, from the state after this run.
  const after = confirm ? await prisma.download.findMany() : rows.map((r) => ({ ...r, ...(TITLE_CLASSIFICATION[r.title.trim()] ?? {}) }));
  const products = (kind: string) => new Set(after.filter((r) => r.kind === kind).map((r) => r.hubProductId)).size;
  const schemes: Record<string, number> = {};
  for (const r of after) if (r.certScheme) schemes[r.certScheme] = (schemes[r.certScheme] ?? 0) + 1;

  console.log(`\n${confirm ? "Classified" : "Would classify"} ${changed} of ${rows.length} download(s)${force ? "" : ` (${rows.length - todo.length} already typed, left alone)`}.`);
  console.log(`  Datasheets page:   ${products("DATASHEET")} products`);
  console.log(`  User Manuals page: ${products("MANUAL")} products`);
  console.log(`  Certificates page: ${products("CERTIFICATE")} products — ${Object.entries(schemes).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  console.log(`  Untyped (on no page): ${after.filter((r) => !r.kind).length}`);
  if (!confirm && changed) console.log("\nDry run — re-run with --confirm to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Write every unique piece of Hub-only English that a translated page can
 * show, for the one-off mass translation (phase 3 of "Languages" in CLAUDE.md).
 *
 *   npm run i18n:export-sources --workspace=backend
 *
 * Writes migration/i18n/sources.json (gitignored). Read-only against the DB.
 * Pass-through text (codes, measurements) is left out — it is never translated.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";
import { collectSources } from "../services/i18n/sources.js";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../migration/i18n");

async function main() {
  const sources = await collectSources();
  mkdirSync(OUT, { recursive: true });
  const items = sources
    .map((s) => ({ kind: s.kind, sourceHash: s.sourceHash, sourceText: s.sourceText, products: s.productIds.length }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.sourceText.localeCompare(b.sourceText));
  writeFileSync(path.join(OUT, "sources.json"), JSON.stringify(items, null, 1));
  const byKind: Record<string, { n: number; chars: number }> = {};
  for (const i of items) {
    const k = (byKind[i.kind] ??= { n: 0, chars: 0 });
    k.n++;
    k.chars += i.sourceText.length;
  }
  console.log(`\n${items.length} unique strings → ${path.relative(process.cwd(), path.join(OUT, "sources.json"))}`);
  for (const [k, v] of Object.entries(byKind)) console.log(`  ${k.padEnd(12)} ${String(v.n).padStart(5)} strings  ${String(v.chars).padStart(7)} chars`);
  console.log(`  total chars: ${items.reduce((n, i) => n + i.sourceText.length, 0)}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

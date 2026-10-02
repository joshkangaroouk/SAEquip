#!/usr/bin/env node
/**
 * Fails if CLAUDE.md names a function — written as `name()` — that no longer
 * exists anywhere in the code.
 *
 *   node scripts/check-doc-refs.mjs
 *
 * Run by the pre-push hook. Docs go stale by rename more than by anything
 * else, and a stale doc is not harmless here: on 2026-10-02 a security hole
 * stayed hidden because a comment described protection that had been removed.
 * Only the `name()` form is checked, deliberately — it is unambiguous, so the
 * check never cries wolf over a prose word that happens to be in backticks.
 * A function the doc mentions only as history should say so in prose rather
 * than as `name()`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
const names = [...new Set([...doc.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)\(\)`/g)].map((m) => m[1]))];

const SEARCH = ["backend/src", "backend/scripts", "frontend/src", "scripts"];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) files.push(p);
  }
};
for (const d of SEARCH) walk(path.join(ROOT, d));
const code = files.map((f) => readFileSync(f, "utf8")).join("\n");

const missing = names.filter((n) => !new RegExp(`\\b${n}\\b`).test(code));
if (missing.length) {
  console.error(`\n✗ CLAUDE.md names ${missing.length} function(s) that no longer exist in the code:`);
  for (const n of missing) console.error(`    ${n}()`);
  console.error("  Update the doc (or, if it is history, describe it in prose rather than as name()).\n");
  process.exit(1);
}
console.log(`✓ doc references: all ${names.length} functions CLAUDE.md names still exist`);

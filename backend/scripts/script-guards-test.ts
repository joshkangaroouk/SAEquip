/**
 * The refusal rules that stop the maintenance scripts overwriting live data.
 * Pure functions only: no network, no database.
 *   npm run script-guards:test --workspace=backend
 */
import { syncRefusal } from "../src/scripts/lib/syncGuard.js";

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};

// ---- duda:sync-categories
const sync = (o: Partial<Parameters<typeof syncRefusal>[0]>) =>
  syncRefusal({ confirm: true, hubLinks: 194, linkedInDuda: 194, removals: 0, allowRemovals: false, ...o });
check(sync({}) === null, "sync: in step with Duda → allowed");
check(sync({ confirm: false, hubLinks: 0 }) === null, "sync: a dry run is never refused");
check(/NO assignments/.test(sync({ hubLinks: 0 }) ?? ""), "sync: an empty Hub over a populated Duda → refused");
check(/NO assignments/.test(sync({ hubLinks: 0, allowRemovals: true }) ?? ""), "sync: --allow-removals does not unlock an empty Hub");
check(sync({ hubLinks: 0, linkedInDuda: 0 }) === null, "sync: both empty → nothing to lose, allowed");
check(sync({ removals: 3 }) === null, "sync: a few removals (routine unticking) → allowed");
check(sync({ removals: 40 }) === null, "sync: 40 of 194 removed (≤ a quarter) → allowed");
check(/more than a quarter/.test(sync({ removals: 60 }) ?? ""), "sync: 60 of 194 removed → refused");
check(sync({ removals: 60, allowRemovals: true }) === null, "sync: 60 of 194 with --allow-removals → allowed");
check(sync({ linkedInDuda: 8, removals: 8 }) === null, "sync: a tiny catalogue (≤ 10 removals) → allowed");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

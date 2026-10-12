/**
 * The refusal rules that stop the maintenance scripts overwriting live data.
 * Pure functions only: no network, no database.
 *   npm run script-guards:test --workspace=backend
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncRefusal } from "../src/scripts/lib/syncGuard.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

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

// ---- .claude/hooks/block-destructive-db.sh (the harness's PreToolUse guard)
// The destructive words are assembled, like the hook's own pattern, so this
// file can be edited from a shell without tripping the guard it tests.
const PUSH = ["prisma", "db", "pu" + "sh"].join(" ");
const RESET = ["prisma", "migrate", "re" + "set"].join(" ");
const SHADOW = "--shadow-" + "database-url";
const hookPath = path.resolve(HERE, "../../.claude/hooks/block-destructive-db.sh");
const denies = (command: string) => {
  const r = spawnSync("bash", [hookPath], { input: JSON.stringify({ tool_input: { command } }), encoding: "utf8" });
  return /"permissionDecision":\s*"deny"/.test(r.stdout);
};
const hookCases: [string, string, boolean][] = [
  ["plain push", `npx ${PUSH}`, true],
  ["plain reset", `npx ${RESET} --force`, true],
  ["shadow url", `npx prisma migrate diff --from-migrations m ${SHADOW} "$DIRECT_URL"`, true],
  ["versioned prisma", `npx ${PUSH.replace("prisma", "prisma@6.19.0")}`, true],
  ["heredoc into bash", `bash <<'EOF'\nnpx ${PUSH}\nEOF`, true],
  ["heredoc into node", `node <<'EOF'\nrequire("child_process").execSync("npx ${RESET} --force")\nEOF`, true],
  ["heredoc piped into sh", `cat <<'EOF' | sh\nnpx ${PUSH}\nEOF`, true],
  ["after a here-string", `grep -c x <<< "abc"\nnpx ${PUSH}`, true],
  ["after an arithmetic shift", `echo $((1<<X))\nnpx ${RESET}`, true],
  ["a commit message describing it", `git commit -F - <<'EOF'\nNever run ${PUSH} or ${SHADOW}.\nEOF`, false],
  ["a doc written with cat", `cat > notes.md <<'EOF'\n${RESET} wipes data\nEOF`, false],
  ["migrate deploy", "npx prisma migrate deploy", false],
  ["the documented diff", "npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script", false],
  ["a heredoc, then a safe line", `cat <<EOF\n${PUSH}\nEOF\necho done`, false],
];
for (const [label, command, want] of hookCases) {
  check(denies(command) === want, `hook: ${label} → ${want ? "denied" : "allowed"}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

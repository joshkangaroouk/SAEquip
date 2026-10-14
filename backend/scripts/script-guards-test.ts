/**
 * The refusal rules that stop the maintenance scripts overwriting live data.
 * Pure functions only: no network, no database.
 *   npm run script-guards:test --workspace=backend
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncRefusal } from "../src/scripts/lib/syncGuard.js";
import { keepEditedDescription, planDownloadSet, planTypeLinks } from "../src/scripts/lib/importGuards.js";
import { applyPlan, planAssignments } from "../src/scripts/lib/taxonomyPlan.js";
import { planLogos, planLogoToggles } from "../src/scripts/lib/logoPlan.js";

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

// ---- duda:import-products --descriptions
check(keepEditedDescription("<p>edited</p>", "<p>csv</p>", false), "descriptions: a Hub edit is kept");
check(!keepEditedDescription("<p>edited</p>", "<p>csv</p>", true), "descriptions: --force overwrites it");
check(!keepEditedDescription("<p>csv</p>", "<p>csv</p>\n", false), "descriptions: identical (bar whitespace) → not 'kept'");
check(!keepEditedDescription(null, "<p>csv</p>", false), "descriptions: an empty Hub copy is filled");

// ---- downloads:import (a keyed diff, never recreate)
const existing = [
  { id: "d1", mediaAssetId: "fileA" },
  { id: "d2", mediaAssetId: "fileB" },
];
const plan = planDownloadSet(existing, [
  { mediaAssetId: "fileB", title: "Datasheet" },
  { mediaAssetId: "fileC", title: "UKEX Certificate" },
]);
check(!("error" in plan), "downloads: a known set plans");
if (!("error" in plan)) {
  check(JSON.stringify(plan.deleteIds) === '["d1"]', "downloads: only the dropped file's row is deleted");
  check(plan.updates.length === 1 && plan.updates[0].id === "d2" && plan.updates[0].sortOrder === 0, "downloads: a surviving file keeps its row (id, type, gating, leads)");
  check(
    plan.creates.length === 1 && plan.creates[0].kind === "CERTIFICATE" && plan.creates[0].certScheme === "UKEX" && plan.creates[0].sortOrder === 1,
    "downloads: a new file is typed from its title",
  );
}
check("error" in planDownloadSet([], [{ mediaAssetId: "x", title: "Brochure" }]), "downloads: an unknown title is refused before any write");
check("error" in planDownloadSet([], [{ mediaAssetId: "x", title: "constructor" }]), "downloads: a prototype key is not a title");

// ---- duda:assign-product-types (scoped to the products it assigns)
{
  const L = (p: string, c: string) => ({ hubProductId: p, dudaCategoryId: c });
  const current = [L("csv1", "LIGHT"), L("csv1", "PRODUCTS"), L("csv2", "FUME"), L("csv2", "PRODUCTS"), L("handmade", "CLIMATE"), L("handmade", "PRODUCTS")];
  const writes = [L("csv1", "LIGHT"), L("csv1", "PRODUCTS"), L("csv2", "CLIMATE"), L("csv2", "PRODUCTS")];
  const tp = planTypeLinks(current, writes);
  check(tp.leftAlone.length === 2 && tp.leftAlone.every((l) => l.hubProductId === "handmade"), "types: a product not in the CSV keeps its links");
  check(JSON.stringify(tp.removals) === JSON.stringify([L("csv2", "FUME")]), "types: only a CSV product's changed type is removed");
  check(JSON.stringify(tp.adds) === JSON.stringify([L("csv2", "CLIMATE")]), "types: only the missing link is added");
  check(planTypeLinks(writes, writes).adds.length === 0 && planTypeLinks(writes, writes).removals.length === 0, "types: in step → nothing to do");
}

// ---- taxonomy:assign (SA Equip's master sheet, READY products only)
{
  const C = (id: string, title: string, parentId = "ROOT") => ({ id, title, parentId });
  const cats = [
    C("SC", "Site Challenges"), C("IND", "Industries"), C("PROD", "Products"), C("OTHER", "Other"),
    C("weld", "Welding", "SC"), C("dust", "Dust", "SC"), C("tank", "Tank", "SC"),
    C("oil", "Oil & Gas", "IND"), C("nuc", "Nuclear", "IND"),
    C("light", "Lighting", "PROD"), C("climate", "Climate", "PROD"),
  ];
  const L = (p: string, c: string) => ({ hubProductId: p, dudaCategoryId: c });
  const W = (p: string, o: Partial<Parameters<typeof planAssignments>[0]["wanted"][number]> = {}) =>
    ({ hubProductId: p, dudaProductId: `D${p}`, name: p, category: "Lighting", siteChallenges: ["Dust"], industries: ["Oil & Gas"], ...o });
  const links = [
    L("a", "PROD"), L("a", "light"), L("a", "SC"), L("a", "weld"), L("a", "OTHER"),
    L("b", "PROD"), L("b", "climate"),
    L("hold", "SC"), L("hold", "weld"), L("hold", "PROD"), L("hold", "climate"),
  ];
  const run = (wanted: ReturnType<typeof W>[], approved: string[] = [], l = links) =>
    planAssignments({ wanted, links: l, cats, approvedCategoryChange: new Set(approved) });
  const has = (xs: { hubProductId: string; dudaCategoryId: string }[], p: string, c: string) => xs.some((x) => x.hubProductId === p && x.dudaCategoryId === c);

  const p = run([W("a"), W("b")]);
  check(has(p.removals, "a", "weld") && has(p.adds, "a", "dust"), "assign: the sheet's challenges REPLACE the current ones");
  check(!has(p.removals, "a", "SC") && !has(p.adds, "a", "SC"), "assign: a parent already held is kept, not re-added");
  check(has(p.adds, "a", "IND") && has(p.adds, "a", "oil"), "assign: a new branch adds its parent link too");
  check(!p.removals.some((r) => r.dudaCategoryId === "OTHER"), "assign: a category outside the three branches is never touched");
  check(!p.adds.concat(p.removals).some((x) => x.hubProductId === "hold"), "assign: a product not given (HOLD) is never touched");
  check(p.flags.length === 1 && p.flags[0].name === "b" && !has(p.removals, "b", "climate"), "assign: an unapproved type difference is flagged, not changed");
  const ok = run([W("b")], ["Db"]);
  check(has(ok.removals, "b", "climate") && has(ok.adds, "b", "light") && !ok.flags.length, "assign: an approved type change moves the product");
  check(run([W("a", { siteChallenges: null, industries: null, category: null })]).adds.length === 0 &&
    run([W("a", { siteChallenges: null, industries: null, category: null })]).removals.length === 0, "assign: null fields are left exactly as they are");
  const empty = run([W("a", { siteChallenges: [] })]);
  check(has(empty.removals, "a", "weld") && has(empty.removals, "a", "SC"), "assign: an empty list clears the branch AND its parent link");
  const again = run([W("a"), W("b")], ["Db"], applyPlan(links, run([W("a"), W("b")], ["Db"])));
  check(!again.changes.length && !again.adds.length && !again.removals.length, "assign: applying the plan converges (a re-run finds nothing)");
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  check(throws(() => run([W("a", { industries: ["Oil and Gas"] })])), "assign: a title not in the tree (spelling) stops the plan");
  check(throws(() => run([W("a", { siteChallenges: ["Oil & Gas"] })])), "assign: a title from the wrong branch stops the plan");
  check(throws(() => run([W("a"), W("a")])), "assign: a product given twice stops the plan");

  // SA Equip's display order, stored as each challenge link's sortOrder.
  const ord = run([W("a", { siteChallenges: ["Dust", "Tank"], siteChallengesOrder: ["Tank", "Dust"] })]);
  const sortOf = (xs: { hubProductId: string; dudaCategoryId: string; sortOrder?: number | null }[], c: string) => xs.find((x) => x.dudaCategoryId === c)?.sortOrder;
  check(sortOf(ord.adds, "tank") === 0 && sortOf(ord.adds, "dust") === 1, "assign: new challenge links carry the display order (0 first)");
  check(ord.changes.find((c) => c.field === "Site Challenges")?.to.join(",") === "Tank,Dust", "assign: the dry run lists challenges in display order");
  const held = [L("a", "SC"), { ...L("a", "dust"), sortOrder: 0 }, { ...L("a", "tank"), sortOrder: 1 }];
  const re = run([W("a", { siteChallenges: ["Dust", "Tank"], siteChallengesOrder: ["Tank", "Dust"], industries: null, category: null })], [], held);
  check(!re.changes.length && re.reorders.length === 2 && sortOf(re.reorders, "tank") === 0, "assign: same challenges, new order → reordered, not re-created");
  check(throws(() => run([W("a", { siteChallenges: ["Dust", "Tank"], siteChallengesOrder: ["Dust"] })])), "assign: an order missing a challenge stops the plan");
  check(throws(() => run([W("a", { siteChallenges: ["Dust"], siteChallengesOrder: ["Dust", "Weld"] })])), "assign: an order naming an extra challenge stops the plan");
  const ow = [W("a", { siteChallengesOrder: ["Dust"] }), W("b", { siteChallengesOrder: ["Dust"] })];
  const done = applyPlan(links, run(ow, ["Db"]));
  const twice = run(ow, ["Db"], done);
  check(!twice.adds.length && !twice.removals.length && !twice.reorders.length, "assign: with an order, applying the plan still converges");
}

// ---- logos:assign (Phase 3: ON only, certification logos are compliance claims)
{
  const ids = new Map([["inmetro", "INM"], ["zone_0", "Z0"], ["rental", "REN"], ["cyclone", "CYC"]]);
  const LL = (p: string, l: string) => ({ hubProductId: p, logoId: l });
  const links = [LL("a", "INM"), LL("a", "REN"), LL("b", "CYC")];
  const W = (p: string, toggles: Record<string, boolean | null>) => ({ hubProductId: p, dudaProductId: `D${p}`, name: p, toggles });
  const lp = planLogos({ wanted: [W("a", { inmetro: false, zone_0: true, rental: null, cyclone: false }), W("b", { cyclone: true, inmetro: true })], links, logoIdFor: ids });
  check(lp.adds.some((x) => x.hubProductId === "a" && x.key === "zone_0") && lp.adds.some((x) => x.hubProductId === "b" && x.key === "inmetro"), "logos: true on an OFF toggle → switched ON");
  check(!lp.adds.some((x) => x.hubProductId === "b" && x.key === "cyclone"), "logos: true on an ON toggle → nothing to do");
  check(lp.heldOn.length === 1 && lp.heldOn[0].key === "inmetro" && lp.heldOn[0].hubProductId === "a", "logos: false on an ON logo → held on and listed, never switched off");
  check(!lp.adds.concat(lp.heldOn).some((x) => x.key === "rental"), "logos: null is never touched");
  check(!lp.heldOn.some((x) => x.key === "cyclone" && x.hubProductId === "a"), "logos: false on an OFF logo → nothing to list");
  check(!("removals" in lp), "logos: the plan has no way to switch anything off");
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  check(throws(() => planLogos({ wanted: [W("a", { atex: true })], links, logoIdFor: ids })), "logos: a sheet key with no catalogue logo stops the plan");
  check(throws(() => planLogos({ wanted: [W("a", {}), W("a", {})], links, logoIdFor: ids })), "logos: a product given twice stops the plan");
}

// ---- Phase 5b: explicit ON and OFF (SA Equip's answers); planLogos stays ON-only
{
  const ids = new Map([["endure", "END"], ["cyclone", "CYC"], ["ex_logo", "EX"], ["ukca", "UK"]]);
  const LL = (p: string, l: string) => ({ hubProductId: p, logoId: l });
  const links = [LL("e", "CYC"), LL("e", "EX"), LL("e", "UK")];
  const W = (on: string[], off: string[], p = "e") => ({ hubProductId: p, dudaProductId: `D${p}`, name: p, on, off });
  const t = planLogoToggles({ wanted: [W(["endure"], ["cyclone", "ex_logo"])], links, logoIdFor: ids });
  check(t.adds.map((x) => x.key).join() === "endure" && t.removes.map((x) => x.key).sort().join() === "cyclone,ex_logo", "toggles: ON adds, OFF removes, and each is listed");
  check(!t.removes.some((x) => x.key === "ukca"), "toggles: a logo in neither list is left alone (UKCA)");
  check(planLogoToggles({ wanted: [W(["cyclone"], ["endure"])], links, logoIdFor: ids }).adds.length === 0 &&
    planLogoToggles({ wanted: [W(["cyclone"], ["endure"])], links, logoIdFor: ids }).removes.length === 0, "toggles: already in the wanted state → nothing to do");
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  check(throws(() => planLogoToggles({ wanted: [W(["ex_logo"], ["ex_logo"])], links, logoIdFor: ids })), "toggles: a logo both ON and OFF stops the plan");
  check(throws(() => planLogoToggles({ wanted: [W([], ["atex"])], links, logoIdFor: ids })), "toggles: an unknown logo key stops the plan");
}

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

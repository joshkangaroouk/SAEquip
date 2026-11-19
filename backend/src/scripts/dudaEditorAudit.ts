/**
 * Does Duda agree with the Hub about who has Website Editor access? READ-ONLY.
 *
 *   npm run duda:editor-audit --workspace=backend
 *
 * The Hub's DudaEditorAccount rows are what authorise minting a login link,
 * and Duda's site permissions are what that login can then do. The two can
 * drift (USERS-AUDIT M4): the 2026-09-29 database wipe left Duda holding a full
 * grant the Hub had forgotten, and a grant the Hub fails to record would be
 * invisible to the Users page. This lists, for every staff account:
 * - the Hub's mapping, if any;
 * - every grant Duda holds on the site for the mapped account, the login email
 *   and its `+saequip` alias (the accounts revokeEveryEditorGrant() checks).
 *
 * Problems (exit code 1):
 * - a Duda grant the Hub does not map (Remove, Disable and Delete now find it,
 *   but nothing else shows it);
 * - a Hub mapping with no grant behind it (the page would offer a link Duda refuses);
 * - a DISABLED account that still holds a grant;
 * - a mapping for a user id that no longer exists (deleted outside the Users page).
 *
 * Permissions beyond the Hub's standard set (EDITOR_PERMISSIONS) are listed as
 * notes, not problems: some are added in Duda on purpose (the marketing ones,
 * Josh, 2026-11-19).
 */
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { DudaApiError } from "../services/duda.js";
import { EDITOR_PERMISSIONS, dudaSso } from "../services/dudaSso.js";
import { EDITOR_SITE, customerAlias } from "../services/dudaEditorAccess.js";
import { listUsersWithFactors } from "../services/supabaseUsers.js";

const site = EDITOR_SITE;
const STANDARD = new Set<string>(EDITOR_PERMISSIONS);

/** Duda's permissions for `name` on the site; [] when it holds none or does not exist. */
async function held(name: string): Promise<string[]> {
  try {
    const perms = (await dudaSso.getSitePermissions(name, site)) as { permissions?: string[] } | undefined;
    return perms?.permissions ?? [];
  } catch (err) {
    if (err instanceof DudaApiError && /ResourceNotExist|doesn't exist|does not have access/i.test(err.body)) return [];
    throw err;
  }
}

async function main() {
  const users = await listUsersWithFactors(env.allowedEmailDomains);
  const mappings = await prisma.dudaEditorAccount.findMany({ include: { siteAccess: true } });
  const ids = new Set(users.map((u) => u.id));
  const problems: string[] = [];

  console.log(`Website Editor access on ${site}: ${users.length} staff accounts, ${mappings.length} Hub mappings\n`);

  for (const u of users.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))) {
    const email = u.email ?? "";
    const mapping = mappings.find((m) => m.staffUserId === u.id) ?? null;
    const mapped = mapping?.siteAccess.some((s) => s.siteName === site) ? mapping.dudaAccountName : null;
    const disabled = !!u.banned_until && Date.parse(u.banned_until) > Date.now();
    const names = [...new Set([mapping?.dudaAccountName, email, customerAlias(email)].filter((n): n is string => !!n))];

    console.log(`${email}${disabled ? "  (DISABLED)" : ""}`);
    console.log(`  Hub mapping   ${mapped ?? "none"}`);
    let mappedHolds = false;
    for (const name of names) {
      const perms = await held(name);
      if (perms.length === 0) continue;
      const extra = perms.filter((p) => !STANDARD.has(p));
      const missing = [...STANDARD].filter((p) => !perms.includes(p));
      console.log(`  Duda grant    ${name}: ${perms.length} permissions`);
      if (extra.length) console.log(`    note: beyond the Hub's standard set: ${extra.join(", ")}`);
      if (missing.length) console.log(`    note: missing from the standard set: ${missing.join(", ")}`);
      if (name === mapped) mappedHolds = true;
      else problems.push(`${email}: Duda grants ${name} access the Hub does not map`);
      if (disabled) problems.push(`${email}: disabled, but ${name} still has access in Duda`);
    }
    if (mapped && !mappedHolds) problems.push(`${email}: the Hub maps ${mapped}, which holds no permissions in Duda`);
    console.log("");
  }

  for (const m of mappings) {
    if (!ids.has(m.staffUserId)) problems.push(`A mapping for ${m.staffEmail} (${m.dudaAccountName}) belongs to an account that no longer exists`);
  }

  if (problems.length) {
    console.log(`✗ ${problems.length} problem(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    console.log("\nRemove access on the Users page (or disable/delete) clears a stray grant; Give access re-records a mapping.\n");
    process.exitCode = 1;
  } else {
    console.log("✓ Duda and the Hub agree.\n");
  }
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

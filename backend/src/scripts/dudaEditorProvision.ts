/**
 * Provision (or revoke) a staff member's Duda editor access.
 *
 * Creating Duda accounts and granting site permissions are the privilege-
 * escalating operations in this feature. Since 2026-11 the super admin can
 * also do them from the Users page (routes/users.ts, behind requireSuperAdmin
 * and a 2FA session); both go through services/dudaEditorAccess.ts, so the
 * guards live in one place. This CLI stays as the fallback, behind --confirm.
 *
 * Grant:
 *   npm run duda:editor-provision --workspace=backend -- \
 *     --email staff@saequip.com --supabase-user-id <uuid> \
 *     [--site 8a8f03b5] [--first Jane] [--last Smith] --confirm
 *
 * Revoke:
 *   npm run duda:editor-provision --workspace=backend -- \
 *     --email staff@saequip.com --revoke [--site 8a8f03b5] --confirm
 *
 * Inspect what Duda actually thinks (read-only, no --confirm needed):
 *   npm run duda:editor-provision --workspace=backend -- \
 *     --email staff@saequip.com --check
 *
 * Find a Supabase user id: Supabase dashboard → Authentication → Users.
 */
import { prisma } from "../prisma.js";
import { DudaApiError } from "../services/duda.js";
import { dudaSso } from "../services/dudaSso.js";
import {
  EDITOR_SITE as DEFAULT_SITE,
  EditorAccessError,
  GRANTABLE_SITES,
  grantEditorAccess,
  revokeEditorAccess,
} from "../services/dudaEditorAccess.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/**
 * Find the mapping for a staff LOGIN address.
 *
 * ⚠️ Looks up `staffEmail`, not `dudaAccountName`. Those are different columns
 * for a reason — anyone who is already a Duda STAFF user needs a separately
 * named CUSTOMER account (see the guard in `grant`) — and querying the name
 * column with a login address silently returns nothing, which reads
 * identically to "this person has no access".
 */
async function findMapping(email: string) {
  return prisma.dudaEditorAccount.findFirst({
    where: { staffEmail: email },
    include: { siteAccess: true },
  });
}

/**
 * ⚠️ `override` is `--duda-account`, and it matters most when there is NO
 * mapping — which is exactly when you are checking whether Duda still holds a
 * grant the Hub has lost. Without it this fell back to the LOGIN address, and
 * Duda answers "does not have access" for a staff login whatever the customer
 * account holds. That is the third door onto the same wrong answer this script
 * has already produced twice: a confident "no access" for a fully granted
 * account. Report which name was asked about, always.
 */
async function check(email: string, site: string, override?: string) {
  const mapping = await findMapping(email);

  console.log("\n--- Hub mapping (this DB) ---");
  if (!mapping) {
    console.log("  none — this person cannot mint an SSO link");
  } else {
    console.log(`  staffEmail:      ${mapping.staffEmail}`);
    console.log(`  staffUserId:     ${mapping.staffUserId}`);
    console.log(`  dudaAccountName: ${mapping.dudaAccountName}`);
    console.log(`  granted sites:   ${mapping.siteAccess.map((s) => s.siteName).join(", ") || "(none)"}`);
  }

  console.log("\n--- Duda's view (source of truth for permissions) ---");
  // Ask about the DUDA account name, which is what actually holds the grant.
  // The explicit flag wins over the mapping: with no mapping there is nothing
  // else to go on, and the login address is the one answer guaranteed wrong.
  const dudaAccount = override ?? mapping?.dudaAccountName ?? email;
  console.log(`  (querying Duda account ${dudaAccount})`);
  if (!mapping && !override) {
    console.log("  ⚠ no mapping and no --duda-account, so this is the LOGIN address.");
    console.log("    If this person has a separate customer account, pass --duda-account");
    console.log("    or the answer below is meaningless.");
  }
  try {
    const perms = await dudaSso.getSitePermissions(dudaAccount, site);
    console.log(`  ${site}: ${JSON.stringify(perms)}`);
  } catch (err) {
    if (err instanceof DudaApiError) {
      console.log(`  ${site}: Duda ${err.status} — ${err.body.slice(0, 200)}`);
    } else {
      console.log(`  ${site}: failed — ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  console.log("");
}

/**
 * Grant, through the shared service. `--duda-account` forces the Duda account
 * name; without it the service keeps an existing mapping's name, or tries the
 * email and falls back to name+saequip@domain for a Duda STAFF user.
 */
async function grant(email: string, supabaseUserId: string, site: string) {
  const result = await grantEditorAccess({
    staffUserId: supabaseUserId,
    staffEmail: email,
    firstName: arg("first") ?? null,
    lastName: arg("last") ?? null,
    grantedBy: null,
    site,
    dudaAccountName: arg("duda-account"),
  });
  for (const step of result.steps) console.log(`• ${step}`);
  console.log(`\n✓ Done. ${email} can now use Edit Website for ${site} (Duda account ${result.dudaAccountName}).\n`);
}

/** Revoke, through the shared service: verified with Duda before the Hub rows go. */
async function revoke(email: string, site: string) {
  const result = await revokeEditorAccess({ staffEmail: email, site, dudaAccountName: arg("duda-account") });
  for (const step of result.steps) console.log(`• ${step}`);
  console.log(`\n✓ Revoked. ${result.dudaAccountName} has no access to ${site}.\n`);
}

async function main() {
  const email = arg("email");
  const site = arg("site") ?? DEFAULT_SITE;

  if (!email) fail("--email is required");

  if (flag("check")) {
    await check(email!, site, arg("duda-account"));
    return;
  }

  if (!flag("confirm")) {
    fail("Refusing to run without --confirm (this changes live Duda permissions).");
  }

  // Revoke deliberately skips the GRANTABLE_SITES check — a retired site is
  // exactly the case where you still need to be able to take access away.
  if (flag("revoke")) {
    await revoke(email!, site);
    return;
  }

  if (!GRANTABLE_SITES.has(site)) {
    fail(
      `Site "${site}" is not grantable. Only ${[...GRANTABLE_SITES].join(", ")} is allowed — ` +
        `add it to GRANTABLE_SITES in services/dudaEditorAccess.ts if that's genuinely intended.`,
    );
  }

  const supabaseUserId = arg("supabase-user-id");
  if (!supabaseUserId) {
    fail("--supabase-user-id is required when granting (Supabase dashboard → Authentication → Users)");
  }
  await grant(email!, supabaseUserId!, site);
}

main()
  .catch((err) => {
    if (err instanceof EditorAccessError) console.error(`\n✗ ${err.message}\n`);
    else console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

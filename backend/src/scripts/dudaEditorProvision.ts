/**
 * Provision (or revoke) a staff member's Duda editor access.
 *
 * Deliberately a CLI script and NOT an HTTP route: creating Duda accounts and
 * granting site permissions are the privilege-escalating operations in this
 * feature. Exposed as an authenticated endpoint, any allowed-domain session
 * could self-provision — so they live here, behind an explicit --confirm,
 * matching the duda:spike-options convention.
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
import { EDITOR_PERMISSIONS, dudaSso } from "../services/dudaSso.js";

/** The SAEquip site in use (saequip-2). */
const DEFAULT_SITE = "8a8f03b5";

/**
 * Sites this script may GRANT access to. The retired site `099434f3` is
 * deliberately absent so it can't be granted again — but note the check only
 * gates grants, never revokes: you must always be able to revoke access on a
 * site that's no longer grantable.
 */
const GRANTABLE_SITES = new Set([DEFAULT_SITE]);

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

async function check(email: string, site: string) {
  const mapping = await prisma.dudaEditorAccount.findUnique({
    where: { dudaAccountName: email },
    include: { siteAccess: true },
  });

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
  try {
    const perms = await dudaSso.getSitePermissions(email, site);
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

async function grant(email: string, supabaseUserId: string, site: string) {
  // 1. Duda account (idempotent-ish: reuse it if it already exists).
  let accountExists = false;
  try {
    await dudaSso.getAccount(email);
    accountExists = true;
    console.log(`• Duda account "${email}" already exists — reusing it`);
  } catch (err) {
    if (!(err instanceof DudaApiError)) throw err;
    console.log(`• Duda account "${email}" not found — creating`);
  }

  if (!accountExists) {
    await dudaSso.createAccount({
      account_name: email,
      email,
      first_name: arg("first"),
      last_name: arg("last"),
      lang: "en",
    });
    console.log(`• created Duda account "${email}"`);
  }

  // 2. Site permissions (least privilege — see EDITOR_PERMISSIONS).
  try {
    await dudaSso.grantSiteAccess(email, site, EDITOR_PERMISSIONS);
    console.log(`• granted ${EDITOR_PERMISSIONS.length} permissions on ${site}`);
  } catch (err) {
    if (err instanceof DudaApiError) {
      // Already had access → replace the set so it matches our intent exactly.
      console.log(`• grant returned ${err.status}; trying full permission replacement instead`);
      await dudaSso.updateSitePermissions(email, site, EDITOR_PERMISSIONS);
      console.log(`• replaced permissions on ${site}`);
    } else {
      throw err;
    }
  }

  // 3. Hub mapping — this is what actually authorizes SSO.
  const account = await prisma.dudaEditorAccount.upsert({
    where: { staffUserId: supabaseUserId },
    create: { staffUserId: supabaseUserId, staffEmail: email, dudaAccountName: email },
    update: { staffEmail: email, dudaAccountName: email },
  });

  await prisma.dudaEditorSiteAccess.upsert({
    where: { dudaEditorAccountId_siteName: { dudaEditorAccountId: account.id, siteName: site } },
    create: {
      dudaEditorAccountId: account.id,
      siteName: site,
      grantedPermissions: [...EDITOR_PERMISSIONS],
    },
    update: { grantedPermissions: [...EDITOR_PERMISSIONS] },
  });

  console.log(`• wrote Hub mapping (staffUserId ${supabaseUserId} → ${email} → ${site})`);
  console.log(`\n✓ Done. ${email} can now use Edit Website for ${site}.\n`);
}

async function revoke(email: string, site: string) {
  try {
    await dudaSso.revokeSiteAccess(email, site);
    console.log(`• Duda accepted the revoke for ${email} on ${site}`);
  } catch (err) {
    if (!(err instanceof DudaApiError)) throw err;
    // A 404 here is NOT "already revoked" — that's what a WRONG PATH looks
    // like, and treating it as success once left a retired site fully granted
    // while this script printed a tick. Only Duda explicitly saying the
    // resource doesn't exist counts as nothing-to-do.
    if (/ResourceNotExist|doesn't exist|not exist/i.test(err.body)) {
      console.log(`• Duda reports no such grant (${err.status}) — nothing to revoke`);
    } else {
      fail(
        `Duda refused the revoke: ${err.status} — ${err.body.slice(0, 200)}\n` +
          `  Duda still holds this grant. Fix the API call before touching the Hub mapping,\n` +
          `  or you'll leave access live with no local record of it.`,
      );
    }
  }

  // Verify against Duda rather than trusting the call above. Duda is the source
  // of truth for permissions; the Hub row only gates minting a link.
  try {
    const perms = (await dudaSso.getSitePermissions(email, site)) as
      | { permissions?: string[] }
      | undefined;
    const left = perms?.permissions ?? [];
    if (left.length > 0) {
      fail(
        `Revoke did not take effect — Duda still reports ${left.length} permission(s) ` +
          `on ${site}: ${left.join(", ")}`,
      );
    }
    console.log(`• verified with Duda: no permissions remain on ${site}`);
  } catch (err) {
    if (err instanceof DudaApiError && /ResourceNotExist|doesn't exist|not exist/i.test(err.body)) {
      console.log(`• verified with Duda: grant is gone (${err.status})`);
    } else {
      throw err;
    }
  }

  const account = await prisma.dudaEditorAccount.findUnique({
    where: { dudaAccountName: email },
    include: { siteAccess: true },
  });

  if (!account) {
    console.log("• no Hub mapping to remove");
  } else {
    await prisma.dudaEditorSiteAccess.deleteMany({
      where: { dudaEditorAccountId: account.id, siteName: site },
    });
    console.log(`• removed Hub site-access row for ${site}`);

    const remaining = await prisma.dudaEditorSiteAccess.count({
      where: { dudaEditorAccountId: account.id },
    });
    if (remaining === 0) {
      await prisma.dudaEditorAccount.delete({ where: { id: account.id } });
      console.log("• no sites left — removed the Hub account mapping entirely");
    }
  }
  console.log(`\n✓ Revoked. ${email} can no longer mint an SSO link for ${site}.\n`);
}

async function main() {
  const email = arg("email");
  const site = arg("site") ?? DEFAULT_SITE;

  if (!email) fail("--email is required");

  if (flag("check")) {
    await check(email!, site);
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
        `add it to GRANTABLE_SITES in this script if that's genuinely intended.`,
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
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

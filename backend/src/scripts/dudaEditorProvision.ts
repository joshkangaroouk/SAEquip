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

async function check(email: string, site: string) {
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
  const dudaAccount = mapping?.dudaAccountName ?? email;
  if (dudaAccount !== email) console.log(`  (querying Duda account ${dudaAccount})`);
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

async function grant(email: string, supabaseUserId: string, site: string) {
  /*
   * The Duda account name is NOT necessarily the staff member's login.
   *
   * `DudaEditorAccount` has always had separate `staffEmail` and
   * `dudaAccountName` columns; this script used to pass the login for both,
   * which works only while the two coincide. They don't for anyone who is
   * already a Duda STAFF user — see the account_type guard below — so
   * `--duda-account` lets the Duda side use a distinct name (plus-addressing
   * like josh+saequip@kangaroouk.com delivers to the same mailbox) while the
   * Hub still keys the mapping on the Supabase user.
   */
  const dudaAccount = arg("duda-account") ?? email;
  if (dudaAccount !== email) {
    console.log(`• Duda account name: ${dudaAccount}  (Hub login stays ${email})`);
  }

  // 1. Duda account (idempotent-ish: reuse it if it already exists).
  let accountExists = false;
  try {
    const existing = (await dudaSso.getAccount(dudaAccount)) as { account_type?: string };
    accountExists = true;
    console.log(`• Duda account "${dudaAccount}" already exists — reusing it`);

    /*
     * ⚠️ REFUSE anything that isn't a CUSTOMER account.
     *
     * Duda rejects a per-site grant to a STAFF account with
     * `"Only customers may be granted access to specific sites"` — because a
     * STAFF account belongs to the agency-level partner account and already
     * reaches every site in the portfolio (~871 of them). SSO'ing as it would
     * hand out exactly the blast radius this whole feature exists to avoid,
     * and the permission set we so carefully withhold (E_COMMERCE, DEV_MODE,
     * RESET) would be meaningless.
     *
     * Checked here rather than left to Duda's 400, so the reason is stated
     * once, in the place someone reads when it fails.
     */
    const type = String(existing.account_type ?? "").toUpperCase();
    if (type && type !== "CUSTOMER") {
      fail(
        `Duda account "${dudaAccount}" is account_type ${type}, not CUSTOMER.\n` +
          "  Duda refuses per-site grants to non-customer accounts, and rightly so: a STAFF\n" +
          "  account sits under the agency partner account and already reaches every site in\n" +
          "  the portfolio, so an SSO link for it would not be scoped to this site at all.\n\n" +
          "  Create a separate CUSTOMER account instead, e.g.:\n" +
          `    npm run duda:editor-provision --workspace=backend -- \\\n` +
          `      --email ${email} --duda-account ${email.replace("@", "+saequip@")} \\\n` +
          `      --supabase-user-id ${supabaseUserId} --first Josh --last Wright --confirm`,
      );
    }
  } catch (err) {
    if (!(err instanceof DudaApiError)) throw err;
    console.log(`• Duda account "${dudaAccount}" not found — creating`);
  }

  if (!accountExists) {
    await dudaSso.createAccount({
      account_name: dudaAccount,
      // The mailbox stays the real one even when the account NAME is
      // plus-addressed, so Duda's own mail reaches the person.
      email,
      first_name: arg("first"),
      last_name: arg("last"),
      lang: "en",
    });
    console.log(`• created Duda account "${dudaAccount}"`);
  }

  // 2. Site permissions (least privilege — see EDITOR_PERMISSIONS).
  try {
    await dudaSso.grantSiteAccess(dudaAccount, site, EDITOR_PERMISSIONS);
    console.log(`• granted ${EDITOR_PERMISSIONS.length} permissions on ${site}`);
  } catch (err) {
    if (err instanceof DudaApiError) {
      /*
       * ⚠️ Print Duda's MESSAGE, not just the status. This used to log only
       * the code, so a grant failing for a reason Duda spelled out plainly
       * looked like an unexplained 400 and the fallback fired blindly —
       * which then failed with its own opaque status. The body is the
       * difference between "already has access" and something that needs a
       * human.
       */
      console.log(`• grant returned ${err.status}: ${String(err.body).slice(0, 300)}`);
      console.log("  trying full permission replacement instead…");
      try {
        await dudaSso.updateSitePermissions(dudaAccount, site, EDITOR_PERMISSIONS);
        console.log(`• replaced permissions on ${site}`);
      } catch (err2) {
        if (err2 instanceof DudaApiError) {
          console.error(`• replacement ALSO failed: ${err2.status} ${String(err2.body).slice(0, 300)}`);
        }
        throw err2;
      }
    } else {
      throw err;
    }
  }

  // 3. Hub mapping — this is what actually authorizes SSO.
  const account = await prisma.dudaEditorAccount.upsert({
    where: { staffUserId: supabaseUserId },
    create: { staffUserId: supabaseUserId, staffEmail: email, dudaAccountName: dudaAccount },
    update: { staffEmail: email, dudaAccountName: dudaAccount },
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
  /*
   * ⚠️ Resolve the DUDA account name FIRST. Revoking against the login
   * address would ask Duda about an account that never held the grant, get
   * `ResourceNotExist`, report "nothing to revoke" and then delete the Hub
   * mapping — leaving the real customer account with full editor permissions
   * on a live site and no record of it. That is the same silent-revoke failure
   * that once left an account holding all 11 permissions behind a success
   * tick, reached through a different door.
   */
  const mapping = await findMapping(email);
  const dudaAccount = mapping?.dudaAccountName ?? email;
  if (dudaAccount !== email) {
    console.log(`• revoking Duda account ${dudaAccount} (login ${email})`);
  }
  try {
    await dudaSso.revokeSiteAccess(dudaAccount, site);
    console.log(`• Duda accepted the revoke for ${dudaAccount} on ${site}`);
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
    const perms = (await dudaSso.getSitePermissions(dudaAccount, site)) as
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

  const account = mapping;

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

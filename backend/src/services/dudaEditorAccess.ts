import { prisma } from "../prisma.js";
import { DudaApiError } from "./duda.js";
import { EDITOR_PERMISSIONS, dudaSso } from "./dudaSso.js";

/**
 * Giving and taking away Website Editor (Duda editor SSO) access: the ONE copy
 * of the logic, used by the `duda:editor-provision` CLI and, since 2026-11, by
 * the super admin on the Users page and when an invite is accepted.
 *
 * What makes it safe (see CLAUDE.md "Website Editor"):
 * - Each person gets their own Duda CUSTOMER account. A STAFF account sits
 *   under the agency partner account and reaches every site in the portfolio,
 *   and Duda refuses per-site grants to it, so one is never used: the
 *   person's email is tried first, then `name+saequip@domain`.
 * - Only the fixed least-privilege set (EDITOR_PERMISSIONS: never E_COMMERCE,
 *   DEV_MODE or RESET) on a site in GRANTABLE_SITES.
 * - The Hub rows (DudaEditorAccount + DudaEditorSiteAccess) are what authorise
 *   minting a link. A revoke is checked against Duda before they are deleted,
 *   so the Hub never forgets a grant Duda still holds.
 * - Errors come back as EditorAccessError with a short, safe message; Duda's
 *   raw response is never passed through.
 */

/** The live site (`DUDA_SITE_NAME`), and the only one access can be granted on. */
export const EDITOR_SITE = "8a8f03b5";
export const GRANTABLE_SITES: ReadonlySet<string> = new Set([EDITOR_SITE]);

export class EditorAccessError extends Error {
  constructor(
    readonly code: "site_not_grantable" | "not_customer" | "duda_error" | "revoke_refused" | "revoke_not_effective",
    message: string,
  ) {
    super(message);
    this.name = "EditorAccessError";
  }
}

type Duda = Pick<
  typeof dudaSso,
  "getAccount" | "createAccount" | "grantSiteAccess" | "updateSitePermissions" | "getSitePermissions" | "revokeSiteAccess"
>;

interface Mapping {
  id: string;
  dudaAccountName: string;
}

export interface EditorAccessDb {
  findMapping: (by: { staffUserId?: string; staffEmail: string }) => Promise<Mapping | null>;
  saveGrant: (g: {
    staffUserId: string;
    staffEmail: string;
    dudaAccountName: string;
    site: string;
    permissions: string[];
    grantedBy: string | null;
  }) => Promise<void>;
  /** Removes the site's row, and the account row once it has no sites left. */
  removeSite: (mapping: Mapping, site: string) => Promise<void>;
}

const prismaDb: EditorAccessDb = {
  findMapping: ({ staffUserId, staffEmail }) =>
    prisma.dudaEditorAccount.findFirst({
      // ⚠️ By the Hub login (staffUserId, else staffEmail), NEVER by
      // dudaAccountName: for a +saequip account the two differ, and looking
      // up the login as an account name once made a revoke miss the real grant.
      where: staffUserId ? { staffUserId } : { staffEmail },
      select: { id: true, dudaAccountName: true },
    }),
  saveGrant: async (g) => {
    // A row for the same Duda account and the same email under ANOTHER user id
    // is what an account deleted outside the Users page leaves behind (the
    // delete route removes it; the Supabase dashboard does not). Re-inviting
    // that email used to hit the unique dudaAccountName after Duda had
    // already granted, leaving a grant the Hub did not record. It is the same
    // person's address, so the row moves to the new account. A different
    // email on that Duda account is a real clash and still fails.
    await prisma.dudaEditorAccount.updateMany({
      where: { dudaAccountName: g.dudaAccountName, staffEmail: g.staffEmail, NOT: { staffUserId: g.staffUserId } },
      data: { staffUserId: g.staffUserId },
    });
    const account = await prisma.dudaEditorAccount.upsert({
      where: { staffUserId: g.staffUserId },
      create: { staffUserId: g.staffUserId, staffEmail: g.staffEmail, dudaAccountName: g.dudaAccountName },
      update: { staffEmail: g.staffEmail, dudaAccountName: g.dudaAccountName },
    });
    await prisma.dudaEditorSiteAccess.upsert({
      where: { dudaEditorAccountId_siteName: { dudaEditorAccountId: account.id, siteName: g.site } },
      create: { dudaEditorAccountId: account.id, siteName: g.site, grantedPermissions: g.permissions, grantedBy: g.grantedBy },
      update: { grantedPermissions: g.permissions, grantedBy: g.grantedBy },
    });
  },
  removeSite: async (mapping, site) => {
    await prisma.dudaEditorSiteAccess.deleteMany({ where: { dudaEditorAccountId: mapping.id, siteName: site } });
    const left = await prisma.dudaEditorSiteAccess.count({ where: { dudaEditorAccountId: mapping.id } });
    if (left === 0) await prisma.dudaEditorAccount.delete({ where: { id: mapping.id } });
  },
};

export const realDeps = { duda: dudaSso as Duda, db: prismaDb };

const gone = (err: DudaApiError) => /ResourceNotExist|doesn't exist|not exist/i.test(err.body);

/** A lookup that found no such account: a 404, or Duda's 400 "Account … doesn't exist." */
export const accountMissing = (err: DudaApiError) => err.status === 404 || (err.status === 400 && gone(err));

/** Duda's own message if its error body has one, else the status. Never the raw body. */
function dudaMessage(err: unknown): string {
  if (!(err instanceof DudaApiError)) return err instanceof Error ? err.message : "unknown error";
  try {
    const msg = (JSON.parse(err.body) as { message?: unknown }).message;
    if (typeof msg === "string" && msg) return `Duda ${err.status}: ${msg.slice(0, 160)}`;
  } catch {
    // not JSON
  }
  return `Duda ${err.status}`;
}

/** `name@domain` → `name+saequip@domain`: Duda's separate CUSTOMER account for a STAFF user. */
export const customerAlias = (email: string) => email.replace("@", "+saequip@");

export interface GrantResult {
  dudaAccountName: string;
  /** A new Duda account was created (else an existing CUSTOMER was reused). */
  created: boolean;
  /** The +saequip name was used because the email is a Duda STAFF account. */
  aliased: boolean;
  /** What happened, step by step, for the CLI to print. */
  steps: string[];
}

/**
 * Give `staffEmail` (Supabase user `staffUserId`) Website Editor access on
 * `site`. Safe to repeat: an existing account and grant are reused.
 *
 * `dudaAccountName` forces the Duda account name (the CLI's --duda-account);
 * without it, an existing mapping's name is kept, else the email is tried and
 * a STAFF account there falls back to `name+saequip@domain`.
 */
export async function grantEditorAccess(
  input: {
    staffUserId: string;
    staffEmail: string;
    firstName?: string | null;
    lastName?: string | null;
    grantedBy: string | null;
    site?: string;
    dudaAccountName?: string;
  },
  deps: { duda: Duda; db: EditorAccessDb } = realDeps,
): Promise<GrantResult> {
  const site = input.site ?? EDITOR_SITE;
  if (!GRANTABLE_SITES.has(site)) {
    throw new EditorAccessError("site_not_grantable", `Site ${site} is not one access can be granted on.`);
  }
  const steps: string[] = [];
  const mapping = await deps.db.findMapping({ staffUserId: input.staffUserId, staffEmail: input.staffEmail });
  const forced = input.dudaAccountName;
  let name = forced ?? mapping?.dudaAccountName ?? input.staffEmail;
  let aliased = false;

  // 1. The Duda account: reuse a CUSTOMER, create one if missing, never use a STAFF one.
  let exists = false;
  for (;;) {
    try {
      const account = (await deps.duda.getAccount(name)) as { account_type?: string } | undefined;
      const type = String(account?.account_type ?? "").toUpperCase();
      if (type && type !== "CUSTOMER") {
        if (!forced && !aliased && name === input.staffEmail) {
          steps.push(`Duda account ${name} is ${type}, not CUSTOMER: using ${customerAlias(name)} instead`);
          name = customerAlias(name);
          aliased = true;
          continue;
        }
        throw new EditorAccessError(
          "not_customer",
          `Duda account ${name} is ${type}, not CUSTOMER. Duda only grants one site to customer accounts.`,
        );
      }
      exists = true;
      steps.push(`Duda account ${name} already exists: reusing it`);
    } catch (err) {
      if (err instanceof EditorAccessError) throw err;
      // ⚠️ Duda answers a missing account with 400 "Account <name> doesn't
      // exist." (measured live, 2026-11-18), not a 404, so that means "create"
      // too. Any other error still stops.
      if (!(err instanceof DudaApiError) || !accountMissing(err)) {
        throw new EditorAccessError("duda_error", `Couldn't look up the Duda account (${dudaMessage(err)}).`);
      }
    }
    break;
  }

  if (!exists) {
    try {
      await deps.duda.createAccount({
        account_name: name,
        // The real mailbox, even when the account NAME is plus-addressed.
        email: input.staffEmail,
        first_name: input.firstName ?? undefined,
        last_name: input.lastName ?? undefined,
        lang: "en",
      });
    } catch (err) {
      throw new EditorAccessError("duda_error", `Couldn't create the Duda account (${dudaMessage(err)}).`);
    }
    steps.push(`Created Duda account ${name}`);
  }

  // 2. The site's permissions: the fixed set, replaced in full if a plain grant is refused.
  const permissions = [...EDITOR_PERMISSIONS];
  try {
    await deps.duda.grantSiteAccess(name, site, permissions);
    steps.push(`Granted ${permissions.length} permissions on ${site}`);
  } catch (err) {
    steps.push(`Grant refused (${dudaMessage(err)}): replacing the permissions in full`);
    try {
      await deps.duda.updateSitePermissions(name, site, permissions);
      steps.push(`Replaced the permissions on ${site}`);
    } catch (err2) {
      throw new EditorAccessError("duda_error", `Duda refused the editor permissions (${dudaMessage(err2)}).`);
    }
  }

  // 3. The Hub mapping, which is what authorises minting a link.
  // ⚠️ Duda has granted by now. If the Hub cannot record it, take the grant
  // back, or Duda would hold access the Hub knows nothing about, which no
  // Remove, Disable or Delete would ever look for (USERS-AUDIT M4). Only a NEW
  // grant: with a mapping already there, the Hub's record still stands.
  try {
    await deps.db.saveGrant({
      staffUserId: input.staffUserId,
      staffEmail: input.staffEmail,
      dudaAccountName: name,
      site,
      permissions,
      grantedBy: input.grantedBy,
    });
  } catch (err) {
    if (!mapping) {
      try {
        await deps.duda.revokeSiteAccess(name, site);
      } catch {
        // The sweep (revokeEveryEditorGrant) still finds it by name.
      }
    }
    throw new EditorAccessError(
      "duda_error",
      `Duda granted access but the Hub couldn't record it (${err instanceof Error ? err.message.slice(0, 160) : "unknown error"}), so the grant was ${mapping ? "left as it was" : "taken back"}. Try again.`,
    );
  }
  steps.push(`Saved the Hub mapping (${input.staffEmail} → ${name} → ${site})`);
  return { dudaAccountName: name, created: !exists, aliased, steps };
}

export interface RevokeResult {
  dudaAccountName: string;
  /** Duda held a grant to remove (else there was nothing there). */
  hadGrant: boolean;
  steps: string[];
}

/**
 * Take Website Editor access away on `site`, and only then delete the Hub
 * rows. Any site may be revoked, retired ones included: that is exactly when
 * access still needs taking away.
 *
 * ⚠️ Only Duda saying the grant does not exist counts as "nothing to revoke".
 * A bare 404 is what a wrong path looks like, and treating it as success once
 * left a site fully granted while the CLI printed a tick. A refused or
 * ineffective revoke throws and leaves the Hub rows, so the record stays.
 */
export async function revokeEditorAccess(
  input: { staffUserId?: string; staffEmail: string; site?: string; dudaAccountName?: string },
  deps: { duda: Duda; db: EditorAccessDb } = realDeps,
): Promise<RevokeResult> {
  const site = input.site ?? EDITOR_SITE;
  const steps: string[] = [];
  const mapping = await deps.db.findMapping({ staffUserId: input.staffUserId, staffEmail: input.staffEmail });
  const name = input.dudaAccountName ?? mapping?.dudaAccountName ?? input.staffEmail;
  let hadGrant = true;

  try {
    await deps.duda.revokeSiteAccess(name, site);
    steps.push(`Duda accepted the revoke for ${name} on ${site}`);
  } catch (err) {
    if (err instanceof DudaApiError && gone(err)) {
      hadGrant = false;
      steps.push(`Duda holds no grant for ${name} on ${site}: nothing to revoke`);
    } else {
      throw new EditorAccessError(
        "revoke_refused",
        `Duda refused the revoke (${dudaMessage(err)}). Access is still live; the Hub record was kept.`,
      );
    }
  }

  // Verify with Duda, the source of truth for permissions.
  try {
    const perms = (await deps.duda.getSitePermissions(name, site)) as { permissions?: string[] } | undefined;
    const left = perms?.permissions ?? [];
    if (left.length > 0) {
      throw new EditorAccessError(
        "revoke_not_effective",
        `The revoke didn't take effect: Duda still lists ${left.length} permission(s) on ${site}.`,
      );
    }
    steps.push(`Checked with Duda: no permissions left on ${site}`);
  } catch (err) {
    if (err instanceof EditorAccessError) throw err;
    if (!(err instanceof DudaApiError && gone(err))) {
      throw new EditorAccessError("duda_error", `Couldn't confirm the revoke with Duda (${dudaMessage(err)}).`);
    }
    steps.push(`Checked with Duda: the grant is gone`);
  }

  if (mapping) {
    await deps.db.removeSite(mapping, site);
    steps.push(`Removed the Hub record for ${site}`);
  } else {
    steps.push("No Hub record to remove");
  }
  return { dudaAccountName: name, hadGrant, steps };
}

export interface SweepResult {
  /** Duda accounts whose grant on the site was removed. */
  revoked: string[];
  /** A Hub mapping existed (and is gone now). */
  hadMapping: boolean;
  steps: string[];
}

/**
 * Take away EVERY Website Editor grant this person could hold on `site`, not
 * just the one the Hub records (USERS-AUDIT M4). Used by Remove access,
 * Disable and Delete on the Users page.
 *
 * ⚠️ Why not just revokeEditorAccess(): that asks Duda only about the account
 * the Hub maps (or the login email), so a grant the Hub has lost (the
 * 2026-09-29 database wipe left exactly that) or never recorded survived a
 * Disable or a Delete that reported success. This checks the mapped account,
 * the login email AND its `+saequip` alias:
 * - Duda answers ResourceNotExist for an account that does not exist and for
 *   one with no access to the site (measured 2026-11-19, a STAFF login
 *   included), so either means "nothing here";
 * - any other answer stops with an error, so Delete keeps the account rather
 *   than guessing (fail closed, as the revoke itself does);
 * - each grant found goes through revokeEditorAccess(), which verifies it is
 *   gone before the Hub forgets it.
 */
export async function revokeEveryEditorGrant(
  input: { staffUserId: string; staffEmail: string; site?: string },
  deps: { duda: Duda; db: EditorAccessDb } = realDeps,
): Promise<SweepResult> {
  const site = input.site ?? EDITOR_SITE;
  const steps: string[] = [];
  const mapping = await deps.db.findMapping({ staffUserId: input.staffUserId, staffEmail: input.staffEmail });
  const names = [...new Set([mapping?.dudaAccountName, input.staffEmail, customerAlias(input.staffEmail)].filter((n): n is string => !!n))];
  const revoked: string[] = [];

  for (const name of names) {
    let held: string[];
    try {
      const perms = (await deps.duda.getSitePermissions(name, site)) as { permissions?: string[] } | undefined;
      held = perms?.permissions ?? [];
    } catch (err) {
      if (err instanceof DudaApiError && gone(err)) {
        steps.push(`${name}: no access to ${site}`);
        continue;
      }
      throw new EditorAccessError("duda_error", `Couldn't check ${name}'s access with Duda (${dudaMessage(err)}).`);
    }
    if (held.length === 0) {
      steps.push(`${name}: no permissions on ${site}`);
      continue;
    }
    const result = await revokeEditorAccess({ staffUserId: input.staffUserId, staffEmail: input.staffEmail, site, dudaAccountName: name }, deps);
    steps.push(...result.steps.map((st) => `${name}: ${st}`));
    revoked.push(name);
  }

  // A mapping with no grant behind it is removed too: the Hub must not offer
  // a link Duda would refuse, nor say access exists.
  const left = await deps.db.findMapping({ staffUserId: input.staffUserId, staffEmail: input.staffEmail });
  if (left) {
    await deps.db.removeSite(left, site);
    steps.push(`Removed the Hub record for ${site}`);
  }
  return { revoked, hadMapping: !!mapping, steps };
}

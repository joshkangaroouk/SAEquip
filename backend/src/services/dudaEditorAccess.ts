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

  // 1. The Duda account: reuse a CUSTOMER, create on 404, never use a STAFF one.
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
      if (!(err instanceof DudaApiError) || err.status !== 404) {
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
  await deps.db.saveGrant({
    staffUserId: input.staffUserId,
    staffEmail: input.staffEmail,
    dudaAccountName: name,
    site,
    permissions,
    grantedBy: input.grantedBy,
  });
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

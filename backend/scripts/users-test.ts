/**
 * The user-management rules, run without Supabase, Duda or a database
 * (USERS-AUDIT M2, 2026-11-19). Every rule here keeps accounts safe, and none
 * of them had a test: invites, the super admin's actions on the Users page,
 * Website Editor grants and revokes, the password policy and the reset link's
 * return address. The handlers take their calls as `deps`, so each case runs
 * the real route code against in-memory fakes.
 *
 *   npm run users:test --workspace=backend
 */
process.env.VERCEL = process.env.VERCEL ?? "";

import type { RequestHandler } from "express";
import { assessPassword, isBreachedPassword } from "../src/services/passwordPolicy.js";
import {
  acceptInviteRoute,
  checkInviteRoute,
  createInviteRoute,
  hashInviteToken,
  inviteStatus,
  removeInviteRoute,
  revokeInviteRoute,
  type InviteDeps,
  type InviteRow,
} from "../src/services/userInvites.js";
import {
  deleteUserRoute,
  disableUserRoute,
  grantEditorRoute,
  requireMfaRoute,
  revokeEditorRoute,
  turnOffMfaRoute,
  type AdminUser,
  type UserAdminDeps,
} from "../src/services/userAdmin.js";
import {
  EditorAccessError,
  grantEditorAccess,
  revokeEditorAccess,
  revokeEveryEditorGrant,
  type EditorAccessDb,
} from "../src/services/dudaEditorAccess.js";
import { DudaApiError } from "../src/services/duda.js";
import { resetRedirectFor } from "../src/routes/users.js";
import { TWO_FACTOR_ON } from "../src/services/twoFactor.js";
import { staffName } from "../src/services/supabaseUsers.js";

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};
const section = (name: string) => console.log(`\n${name}`);

// ---- A fake Express request/response -------------------------------------------

type Body = Record<string, unknown>;
interface Called {
  status: number;
  body: Body;
  activity: Record<string, unknown>;
  error?: unknown;
}

async function call(
  handler: RequestHandler,
  req: { params?: Body; query?: Body; body?: unknown; user?: { id: string; email: string; role?: string | null; aal?: string | null } },
): Promise<Called> {
  const activity: Record<string, unknown> = {};
  const out: Called = { status: 200, body: {}, activity };
  const res = {
    status(n: number) {
      out.status = n;
      return res;
    },
    json(b: Body) {
      out.body = b;
      return res;
    },
  };
  const fullReq = {
    params: req.params ?? {},
    query: req.query ?? {},
    body: req.body ?? {},
    user: req.user,
    method: "POST",
    url: "/",
    originalUrl: "/",
    activity: { set: (patch: Record<string, unknown>) => Object.assign(activity, patch) },
  };
  await handler(fullReq as never, res as never, ((err: unknown) => {
    out.error = err;
    out.status = 500;
  }) as never);
  return out;
}

const ADMIN = { id: "admin-1", email: "boss@saequip.test", role: "super_admin", aal: "aal1" };

// ---- Password policy ------------------------------------------------------------

section("Password policy");
check(assessPassword("Correct-Horse-9-Battery").ok, "a long mixed password passes");
check(!assessPassword("Short1!a").ok, "under 12 characters fails");
check(!assessPassword("alllowercase-123").ok, "no upper case fails");
check(!assessPassword("NoDigitsHere!!").ok, "no digit fails");
check(!assessPassword("NoSymbolsHere123").ok, "no symbol fails");
check(!assessPassword("Summertime2026!").ok, "the word-plus-digits shape fails", assessPassword("Summertime2026!").problems.join("; "));

{
  // The dashboard's copy (frontend/src/lib/passwordPolicy.ts) must agree, or its
  // checklist promises what the server refuses, or the reverse.
  const { assessPassword: browserAssess } = await import("../../frontend/src/lib/passwordPolicy.ts");
  const samples = ["Correct-Horse-9-Battery", "Short1!a", "alllowercase-123", "NoDigitsHere!!", "NoSymbolsHere123", "Summertime2026!", "Summertime202!", "Password12345!", "a1!Bc2@De3#Fg", "ÄÖÜäöü-12345x"];
  const disagree = samples.filter((pw) => browserAssess(pw).ok !== assessPassword(pw).ok);
  check(disagree.length === 0, "the browser's password rules match the server's", disagree.join(", "));
}
{
  // "password" is SHA-1 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
  const range = (suffix: string) => async () => new Response(`${suffix}:12\r\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0`, { status: 200 });
  check(await isBreachedPassword("password", range("1E4C9B93F3F0682250B6CF8331B7EE68FD8") as typeof fetch), "a breached password is caught");
  check(!(await isBreachedPassword("password", range("0000000000000000000000000000000000") as typeof fetch)), "an unlisted password passes");
  check(!(await isBreachedPassword("password", (async () => new Response("", { status: 503 })) as typeof fetch)), "a failed lookup fails open");
  check(!(await isBreachedPassword("password", (async () => { throw new Error("timeout"); }) as typeof fetch)), "a thrown lookup fails open");
}

// ---- The reset link's return address --------------------------------------------

section("Password reset return address");
check(resetRedirectFor("https://hub.example", "hub.example") === "https://hub.example/reset-password", "this dashboard's own origin is used");
check(resetRedirectFor("https://evil.example", "hub.example") === undefined, "a foreign origin is never used");
check(resetRedirectFor(undefined, "hub.example") === undefined, "no Origin: left to Supabase's Site URL");
check(resetRedirectFor("javascript:alert(1)", "hub.example") === undefined, "a non-http origin is refused");
check(resetRedirectFor("http://localhost:5173", "api.example") === "http://localhost:5173/reset-password", "localhost in development");

// ---- Names ------------------------------------------------------------------------

section("Names come from the server's copy");
check(staffName({ app_metadata: { first_name: "Pat", last_name: "Lee" }, user_metadata: { first_name: "The", last_name: "Boss" } }).full === "Pat Lee", "app_metadata wins over a name the person edited themselves");
check(staffName({ app_metadata: {}, user_metadata: { first_name: "Old", last_name: "Account" } }).full === "Old Account", "an account with no server copy still shows its name");
check(staffName({ app_metadata: {}, user_metadata: {} }).full === null, "no name at all: null, so the email shows");

// ---- Invites ----------------------------------------------------------------------

section("Invites");
const NOW = new Date("2026-11-19T12:00:00Z");
function inviteWorld(opts: { existing?: string[]; createError?: string; editorFails?: boolean } = {}) {
  const rows: (InviteRow & { tokenHash: string })[] = [];
  let seq = 0;
  const created: string[] = [];
  const grants: string[] = [];
  const deps: InviteDeps = {
    now: () => NOW,
    allowedDomains: ["saequip.test"],
    userExists: async (email) => (opts.existing ?? []).includes(email) || created.includes(email),
    createUser: async ({ email }) => {
      if (opts.createError) return { error: opts.createError };
      created.push(email);
      return { id: `user-${email}` };
    },
    isBreached: async (pw) => pw === "Breached-Pass-123",
    grantEditor: async (g) => {
      if (opts.editorFails) throw new Error("Duda said no");
      grants.push(g.staffEmail);
      return {};
    },
    invites: {
      findByHash: async (h) => rows.find((r) => r.tokenHash === h) ?? null,
      findById: async (id) => rows.find((r) => r.id === id) ?? null,
      list: async () => [...rows],
      create: async (d) => {
        const row = { id: `inv-${++seq}`, createdAt: NOW, usedAt: null, revokedAt: null, revokedBy: null, acceptedUserId: null, editorGrantError: null, ...d };
        rows.push(row);
        return row;
      },
      revokePending: async (email, by, now) => {
        let n = 0;
        for (const r of rows) if (r.email === email && inviteStatus(r, now) === "pending") (r.revokedAt = now), (r.revokedBy = by), n++;
        return n;
      },
      revoke: async (id, by, now) => {
        const r = rows.find((x) => x.id === id);
        if (!r || inviteStatus(r, now) !== "pending") return 0;
        r.revokedAt = now;
        r.revokedBy = by;
        return 1;
      },
      remove: async (id, now) => {
        const i = rows.findIndex((x) => x.id === id && !x.usedAt && (x.revokedAt || x.expiresAt <= now));
        if (i < 0) return 0;
        rows.splice(i, 1);
        return 1;
      },
      claim: async (id, now) => {
        const r = rows.find((x) => x.id === id);
        if (!r || inviteStatus(r, now) !== "pending") return 0;
        r.usedAt = now;
        return 1;
      },
      release: async (id) => {
        const r = rows.find((x) => x.id === id)!;
        r.usedAt = null;
      },
      accepted: async (id, userId) => {
        rows.find((x) => x.id === id)!.acceptedUserId = userId;
      },
      setEditorError: async (id, message) => {
        rows.find((x) => x.id === id)!.editorGrantError = message;
      },
    },
  };
  return { deps, rows, created, grants };
}
const GOOD_PW = "Correct-Horse-9-Battery";

{
  const w = inviteWorld({ existing: ["has@saequip.test"] });
  const outsider = await call(createInviteRoute(w.deps), { body: { email: "x@gmail.com" }, user: ADMIN });
  check(outsider.status === 400 && outsider.body.error === "forbidden_domain", "an address outside the allowed domains cannot be invited");
  const extra = await call(createInviteRoute(w.deps), { body: { email: "a@saequip.test", role: "super_admin" }, user: ADMIN });
  check(extra.status === 400, "an extra field (a role) is refused: the body is strict");
  const has = await call(createInviteRoute(w.deps), { body: { email: "has@saequip.test" }, user: ADMIN });
  check(has.status === 409 && has.body.error === "already_has_account", "an address with an account is refused");

  const first = await call(createInviteRoute(w.deps), { body: { email: "New@SAEquip.test" }, user: ADMIN });
  const token1 = String(first.body.token);
  check(first.status === 201 && token1.length >= 40, "an invite returns its token once", `${token1.length} chars`);
  check(!("tokenHash" in (first.body.invite as Body)), "the response never carries the token's hash");
  check(w.rows[0].tokenHash === hashInviteToken(token1) && w.rows[0].email === "new@saequip.test", "only the hash is stored, and the email lower-cased");
  check(!JSON.stringify(first.activity).includes(token1), "the token is not in the activity entry");

  const second = await call(createInviteRoute(w.deps), { body: { email: "new@saequip.test" }, user: ADMIN });
  const token2 = String(second.body.token);
  check(w.rows[0].revokedAt !== null, "a new invite revokes the pending one for the same email");
  const oldCheck = await call(checkInviteRoute(w.deps), { body: { token: token1 } });
  check(oldCheck.status === 410 && oldCheck.body.error === "revoked", "the revoked link says so");
  const ok = await call(checkInviteRoute(w.deps), { body: { token: token2 } });
  check(ok.status === 200 && ok.body.email === "new@saequip.test", "the live link names its email");
  const bogus = await call(checkInviteRoute(w.deps), { body: { token: "x".repeat(43) } });
  check(bogus.status === 404, "an unknown token is invalid");

  const weak = await call(acceptInviteRoute(w.deps), { body: { token: token2, firstName: "A", lastName: "B", password: "weakpass" } });
  check(weak.status === 400 && weak.body.error === "weak_password", "a weak password is refused on the server");
  const breached = await call(acceptInviteRoute(w.deps), { body: { token: token2, firstName: "A", lastName: "B", password: "Breached-Pass-123" } });
  check(breached.status === 400 && breached.body.error === "breached_password", "a breached password is refused");
  const smuggled = await call(acceptInviteRoute(w.deps), { body: { token: token2, firstName: "A", lastName: "B", password: GOOD_PW, email: "evil@saequip.test" } });
  check(smuggled.status === 400, "an email in the accept body is refused (it always comes from the invite)");

  const accepted = await call(acceptInviteRoute(w.deps), { body: { token: token2, firstName: " Ann\u0007 ", lastName: "Lee", password: GOOD_PW } });
  check(accepted.status === 201 && w.created.includes("new@saequip.test"), "a good acceptance creates the invite's account");
  check(w.rows[1].usedAt !== null && w.rows[1].acceptedUserId === "user-new@saequip.test", "the invite is marked used and linked to the account");
  const again = await call(acceptInviteRoute(w.deps), { body: { token: token2, firstName: "A", lastName: "B", password: GOOD_PW } });
  check(again.status === 410 && again.body.error === "used", "the link works once");

  const revokeUsed = await call(revokeInviteRoute(w.deps), { params: { id: w.rows[1].id }, user: ADMIN });
  check(revokeUsed.status === 409 && typeof revokeUsed.body.detail === "string", "a used invite cannot be revoked, and says why", String(revokeUsed.body.detail));
  const removeUsed = await call(removeInviteRoute(w.deps), { params: { id: w.rows[1].id }, user: ADMIN });
  check(removeUsed.status === 409, "a used invite cannot be removed (it is the record of who invited them)");
  const removeRevoked = await call(removeInviteRoute(w.deps), { params: { id: "inv-1" }, user: ADMIN });
  check(removeRevoked.status === 200 && w.rows.length === 1, "a revoked invite can be removed");
}
{
  const w = inviteWorld({ createError: "Database error saving new user" });
  const made = await call(createInviteRoute(w.deps), { body: { email: "c@saequip.test" }, user: ADMIN });
  const token = String(made.body.token);
  const failed = await call(acceptInviteRoute(w.deps), { body: { token, firstName: "A", lastName: "B", password: GOOD_PW } });
  check(failed.status === 400 && failed.body.error === "create_failed", "a refused account creation is reported");
  check(w.rows[0].usedAt === null, "and the claim is released, so the link works again");
}
{
  const w = inviteWorld({ editorFails: true });
  const made = await call(createInviteRoute(w.deps), { body: { email: "e@saequip.test", grantWebsiteEditor: true }, user: ADMIN });
  const res = await call(acceptInviteRoute(w.deps), { body: { token: String(made.body.token), firstName: "A", lastName: "B", password: GOOD_PW } });
  check(res.status === 201, "a Website Editor failure never costs the account");
  check(w.rows[0].editorGrantError === "Duda said no" && res.activity.outcome === "partial", "it is recorded for a retry and logged as partly done");
}
{
  const w = inviteWorld();
  const made = await call(createInviteRoute(w.deps), { body: { email: "late@saequip.test" }, user: ADMIN });
  w.rows[0].expiresAt = new Date(NOW.getTime() - 1);
  const late = await call(acceptInviteRoute(w.deps), { body: { token: String(made.body.token), firstName: "A", lastName: "B", password: GOOD_PW } });
  check(late.status === 410 && late.body.error === "expired", "an expired link cannot create an account");
}

// ---- The super admin's actions ----------------------------------------------------

section("Users page: the super admin's actions");
function adminWorld(users: AdminUser[], opts: { revokeFails?: boolean; deleteSticks?: boolean; mfaSticks?: boolean; editorRemoved?: boolean } = {}) {
  const calls: string[] = [];
  const byId = new Map(users.map((u) => [u.id, { ...u }]));
  const deps: UserAdminDeps = {
    getUser: async (id) => (byId.get(id) ? { ...byId.get(id)! } : null),
    setDisabled: async (id, disabled) => {
      calls.push(`${disabled ? "disable" : "enable"}:${id}`);
      byId.get(id)!.disabled = disabled;
    },
    grantEditor: async (g) => {
      calls.push(`grant:${g.staffUserId}`);
      return { dudaAccountName: g.staffEmail, aliased: false };
    },
    revokeEditor: async (r) => {
      calls.push(`revoke:${r.staffUserId}`);
      if (opts.revokeFails) throw new EditorAccessError("duda_error", "Duda is down");
      return { removed: opts.editorRemoved ?? true };
    },
    clearEditorError: async (id) => void calls.push(`clear:${id}`),
    turnOffMfa: async (id) => {
      calls.push(`mfa-off:${id}`);
      if (!opts.mfaSticks) Object.assign(byId.get(id)!, { mfaEnabled: false, mfaRequired: false });
      return 1;
    },
    requireMfa: async (id) => void (byId.get(id)!.mfaRequired = true),
    deleteUser: async (id) => {
      calls.push(`delete:${id}`);
      if (!opts.deleteSticks) byId.delete(id);
    },
  };
  return { deps, calls, byId };
}
const person = (id: string, extra: Partial<AdminUser> = {}): AdminUser => ({
  id,
  email: `${id}@saequip.test`,
  role: null,
  firstName: "Pat",
  lastName: "Lee",
  disabled: false,
  mfaEnabled: false,
  mfaRequired: false,
  ...extra,
});
const ME = person(ADMIN.id, { role: "super_admin", email: ADMIN.email });
const OTHER_ADMIN = person("admin-2", { role: "super_admin" });

{
  const w = adminWorld([ME, OTHER_ADMIN, person("staff")]);
  const self = await call(disableUserRoute(w.deps), { params: { id: ME.id }, user: ADMIN });
  check(self.status === 409 && self.body.error === "cannot_change_self", "the super admin cannot disable themselves");
  const other = await call(disableUserRoute(w.deps), { params: { id: OTHER_ADMIN.id }, user: ADMIN });
  check(other.status === 409 && other.body.error === "cannot_change_super_admin", "nor another super admin");
  const missing = await call(disableUserRoute(w.deps), { params: { id: "ghost" }, user: ADMIN });
  check(missing.status === 404 && typeof missing.body.detail === "string", "an unknown account is a 404 with a sentence");
  check(!w.calls.some((c) => c.startsWith("disable")), "none of those touched an account");

  const ok = await call(disableUserRoute(w.deps), { params: { id: "staff" }, user: ADMIN });
  check(ok.status === 200 && ok.body.editorRevoked === true, "disabling also removes Website Editor access");
  check(w.calls.join(",") === "disable:staff,revoke:staff", "the account is disabled FIRST, then access removed", w.calls.join(","));
}
{
  const w = adminWorld([ME, person("staff")], { revokeFails: true });
  const res = await call(disableUserRoute(w.deps), { params: { id: "staff" }, user: ADMIN });
  check(res.status === 200 && w.byId.get("staff")!.disabled && typeof res.body.editorError === "string", "a failed revoke still disables, and says so");
  check(res.activity.outcome === "partial", "and is logged as partly done");
}
{
  const w = adminWorld([ME, person("never-had-access")], { editorRemoved: false });
  const res = await call(disableUserRoute(w.deps), { params: { id: "never-had-access" }, user: ADMIN });
  check(w.calls.includes("revoke:never-had-access"), "Duda is asked even when the Hub has no mapping (USERS-AUDIT M4)");
  check(res.body.editorRevoked === false, "and nothing found is reported as nothing removed");
}
{
  const w = adminWorld([ME, OTHER_ADMIN, person("staff")]);
  const noConfirm = await call(deleteUserRoute(w.deps), { params: { id: "staff" }, user: ADMIN });
  check(noConfirm.status === 400 && noConfirm.body.error === "confirm_required", "delete needs ?confirm=true");
  const self = await call(deleteUserRoute(w.deps), { params: { id: ME.id }, query: { confirm: "true" }, user: ADMIN });
  const other = await call(deleteUserRoute(w.deps), { params: { id: OTHER_ADMIN.id }, query: { confirm: "true" }, user: ADMIN });
  check(self.status === 409 && other.status === 409, "the super admin cannot delete themselves or another super admin");
  const ok = await call(deleteUserRoute(w.deps), { params: { id: "staff" }, query: { confirm: "true" }, user: ADMIN });
  check(ok.status === 200 && !w.byId.has("staff"), "a delete removes the account");
  check(w.calls.indexOf("revoke:staff") < w.calls.indexOf("delete:staff"), "Website Editor access goes BEFORE the account");
}
{
  const w = adminWorld([ME, person("staff")], { revokeFails: true });
  const res = await call(deleteUserRoute(w.deps), { params: { id: "staff" }, query: { confirm: "true" }, user: ADMIN });
  check(res.status === 502 && res.body.error === "editor_revoke_failed", "a revoke Duda cannot confirm stops the delete");
  check(w.byId.has("staff") && !w.calls.some((c) => c.startsWith("delete")), "and the account is kept");
}
{
  const w = adminWorld([ME, person("staff")], { deleteSticks: true });
  const res = await call(deleteUserRoute(w.deps), { params: { id: "staff" }, query: { confirm: "true" }, user: ADMIN });
  check(res.status === 502 && res.body.error === "not_applied", "a delete Supabase did not keep is reported, not claimed");
}
{
  const w = adminWorld([ME, OTHER_ADMIN, person("staff", { mfaEnabled: true, mfaRequired: true })]);
  const self = await call(turnOffMfaRoute(w.deps), { params: { id: ME.id }, user: ADMIN });
  const other = await call(turnOffMfaRoute(w.deps), { params: { id: OTHER_ADMIN.id }, user: ADMIN });
  check(self.status === 409 && other.status === 409, "two-factor cannot be turned off for yourself or another super admin");
  const ok = await call(turnOffMfaRoute(w.deps), { params: { id: "staff" }, user: ADMIN });
  check(ok.status === 200 && ok.body.mfaEnabled === false, "turning it off for staff works");
  const req = await call(requireMfaRoute(w.deps), { params: { id: "staff" }, user: ADMIN });
  if (TWO_FACTOR_ON) check(req.status === 200 && req.body.mfaRequired === true, "Require two-factor sets the requirement");
  else check(req.status === 409 && req.body.error === "two_factor_off", "Require two-factor is refused while it is off for the Hub");
}
{
  const w = adminWorld([ME, person("staff", { mfaEnabled: true, mfaRequired: true })], { mfaSticks: true });
  const res = await call(turnOffMfaRoute(w.deps), { params: { id: "staff" }, user: ADMIN });
  check(res.status === 502 && res.body.error === "not_applied", "a two-factor change Supabase did not keep is reported");
}
{
  const w = adminWorld([ME, person("off", { disabled: true }), person("staff")]);
  const disabled = await call(grantEditorRoute(w.deps), { params: { id: "off" }, user: ADMIN });
  check(disabled.status === 409 && disabled.body.error === "account_disabled", "a disabled account cannot be given Website Editor access");
  const ok = await call(grantEditorRoute(w.deps), { params: { id: "staff" }, user: ADMIN });
  check(ok.status === 200 && w.calls.includes("clear:staff"), "a grant clears the invite's 'couldn't be set up' note");
  const removed = await call(revokeEditorRoute(w.deps), { params: { id: "staff" }, user: ADMIN });
  check(removed.status === 200 && w.calls.includes("revoke:staff"), "Remove access revokes");
}

// ---- Website Editor grants and revokes ---------------------------------------------

section("Website Editor: grants and revokes against a fake Duda");
const GONE = (name: string) => new DudaApiError(400, JSON.stringify({ error_code: "ResourceNotExist", message: `Account ${name} doesn't exist.` }), "/x");
const NO_SITE = (name: string) => new DudaApiError(400, JSON.stringify({ error_code: "ResourceNotExist", message: `Account ${name} does not have access to site 8a8f03b5` }), "/x");

function dudaWorld(accounts: Record<string, { type: string; perms?: string[] }>, opts: { saveFails?: boolean; lookupError?: boolean; revokeIneffective?: boolean; mapping?: { staffUserId: string; name: string } } = {}) {
  const calls: string[] = [];
  const rows = opts.mapping ? [{ id: "m1", staffUserId: opts.mapping.staffUserId, dudaAccountName: opts.mapping.name }] : [];
  const duda = {
    getAccount: async (name: string) => {
      if (opts.lookupError) throw new DudaApiError(500, "{}", "/x");
      const a = accounts[name];
      if (!a) throw GONE(name);
      return { account_type: a.type };
    },
    createAccount: async (a: { account_name: string }) => {
      calls.push(`create:${a.account_name}`);
      accounts[a.account_name] = { type: "CUSTOMER" };
      return {};
    },
    grantSiteAccess: async (name: string, _site: string, perms: readonly string[]) => {
      calls.push(`grant:${name}`);
      accounts[name].perms = [...perms];
      return {};
    },
    updateSitePermissions: async () => ({}),
    getSitePermissions: async (name: string) => {
      const a = accounts[name];
      if (!a) throw GONE(name);
      if (!a.perms?.length) throw NO_SITE(name);
      return { permissions: a.perms };
    },
    revokeSiteAccess: async (name: string) => {
      calls.push(`revoke:${name}`);
      const a = accounts[name];
      if (!a?.perms?.length) throw NO_SITE(name);
      if (!opts.revokeIneffective) a.perms = [];
      return {};
    },
  };
  const db: EditorAccessDb = {
    findMapping: async ({ staffUserId }) => rows.find((r) => r.staffUserId === staffUserId) ?? null,
    saveGrant: async (g) => {
      if (opts.saveFails) throw new Error("connection reset");
      calls.push(`save:${g.dudaAccountName}`);
      const r = rows.find((x) => x.staffUserId === g.staffUserId);
      if (r) r.dudaAccountName = g.dudaAccountName;
      else rows.push({ id: `m${rows.length + 2}`, staffUserId: g.staffUserId, dudaAccountName: g.dudaAccountName });
    },
    removeSite: async (m) => {
      calls.push(`remove:${m.dudaAccountName}`);
      rows.splice(rows.findIndex((r) => r.id === m.id), 1);
    },
  };
  return { deps: { duda: duda as never, db }, calls, rows, accounts };
}
const person1 = { staffUserId: "u1", staffEmail: "pat@saequip.test", grantedBy: "boss" };
const throwsCode = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
    return false;
  } catch (err) {
    return err instanceof EditorAccessError && err.code === code;
  }
};

{
  const w = dudaWorld({ "pat@saequip.test": { type: "STAFF" } });
  const r = await grantEditorAccess(person1, w.deps);
  check(r.aliased && r.dudaAccountName === "pat+saequip@saequip.test", "a Duda STAFF login is never used: the +saequip customer account is", r.dudaAccountName);
  check(w.calls.join(",") === "create:pat+saequip@saequip.test,grant:pat+saequip@saequip.test,save:pat+saequip@saequip.test", "created, granted, then recorded", w.calls.join(","));
}
{
  const w = dudaWorld({ "pat@saequip.test": { type: "STAFF" } });
  check(await throwsCode(grantEditorAccess({ ...person1, dudaAccountName: "pat@saequip.test" }, w.deps), "not_customer"), "a FORCED STAFF account is refused");
}
{
  const w = dudaWorld({});
  await grantEditorAccess(person1, w.deps);
  check(w.calls[0] === "create:pat@saequip.test", "Duda's 400 'doesn't exist' means create");
}
{
  const w = dudaWorld({}, { lookupError: true });
  check(await throwsCode(grantEditorAccess(person1, w.deps), "duda_error"), "any other lookup error stops");
  check(!w.calls.some((c) => c.startsWith("grant")), "before granting anything");
}
{
  const w = dudaWorld({ "pat@saequip.test": { type: "CUSTOMER" } }, { saveFails: true });
  check(await throwsCode(grantEditorAccess(person1, w.deps), "duda_error"), "a grant the Hub cannot record fails");
  check(w.calls.includes("revoke:pat@saequip.test") && !w.accounts["pat@saequip.test"].perms?.length, "and is taken back in Duda (no grant the Hub doesn't know about)");
}
{
  const w = dudaWorld({ "pat@saequip.test": { type: "CUSTOMER", perms: ["EDIT"] } }, { saveFails: true, mapping: { staffUserId: "u1", name: "pat@saequip.test" } });
  await throwsCode(grantEditorAccess(person1, w.deps), "duda_error");
  check(!w.calls.some((c) => c.startsWith("revoke")), "but a re-grant over an existing mapping is left alone");
}
{
  const w = dudaWorld({ "pat@saequip.test": { type: "CUSTOMER", perms: ["EDIT"] } }, { revokeIneffective: true, mapping: { staffUserId: "u1", name: "pat@saequip.test" } });
  check(await throwsCode(revokeEditorAccess(person1, w.deps), "revoke_not_effective"), "a revoke Duda did not apply is an error");
  check(w.rows.length === 1, "and the Hub keeps its record");
}
{
  // The audit's case: the Hub lost its mapping, Duda still grants the alias.
  const w = dudaWorld({ "pat@saequip.test": { type: "STAFF" }, "pat+saequip@saequip.test": { type: "CUSTOMER", perms: ["EDIT", "PUBLISH"] } });
  const r = await revokeEveryEditorGrant(person1, w.deps);
  check(r.revoked.join() === "pat+saequip@saequip.test" && !w.accounts["pat+saequip@saequip.test"].perms?.length, "the sweep finds and removes a grant the Hub does not map");
}
{
  const w = dudaWorld({ "pat@saequip.test": { type: "CUSTOMER" } }, { mapping: { staffUserId: "u1", name: "pat@saequip.test" } });
  const r = await revokeEveryEditorGrant(person1, w.deps);
  check(r.revoked.length === 0 && r.hadMapping && w.rows.length === 0, "a mapping with no grant behind it is removed");
}
{
  const w = dudaWorld({});
  const r = await revokeEveryEditorGrant(person1, w.deps);
  check(r.revoked.length === 0 && !r.hadMapping, "someone with no Duda account has nothing to remove");
}
{
  const w = dudaWorld({ "pat@saequip.test": { type: "CUSTOMER", perms: ["EDIT"] } });
  w.deps.duda = { ...(w.deps.duda as object), getSitePermissions: async () => { throw new DudaApiError(503, "busy", "/x"); } } as never;
  check(await throwsCode(revokeEveryEditorGrant(person1, w.deps), "duda_error"), "Duda unreachable: the sweep stops rather than guess");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

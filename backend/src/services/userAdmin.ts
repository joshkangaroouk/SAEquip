import type { RequestHandler } from "express";
import { EditorAccessError } from "./dudaEditorAccess.js";
import { TWO_FACTOR_ON } from "./twoFactor.js";

/**
 * What the super admin can do to an account from the Users page (2026-11):
 * disable or enable it, delete it, give or remove its Website Editor access,
 * and turn its two-factor off or make it required (see turnOffMfaRoute). Behind
 * requireAuth + requireSuperAdmin (routes/users.ts); the calls are `deps` so
 * the rules are tested without Supabase or Duda.
 *
 * - The super admin cannot disable themselves (it would lock out the only
 *   person who can undo it) or another super admin (that is a CLI job).
 * - Disabling also removes Website Editor access, verified in Duda: a Duda
 *   session outlives the Hub one, so leaving it would keep a disabled person
 *   editing the live site. Enabling does NOT give it back; that is its own click.
 */

export interface AdminUser {
  id: string;
  email: string;
  role: string | null;
  firstName: string | null;
  lastName: string | null;
  disabled: boolean;
  /** A confirmed authenticator. */
  mfaEnabled: boolean;
  /** `app_metadata.mfa_required`. */
  mfaRequired: boolean;
}

export interface UserAdminDeps {
  getUser: (id: string) => Promise<AdminUser | null>;
  setDisabled: (id: string, disabled: boolean) => Promise<void>;
  hasEditor: (userId: string) => Promise<boolean>;
  grantEditor: (g: {
    staffUserId: string;
    staffEmail: string;
    firstName: string | null;
    lastName: string | null;
    grantedBy: string | null;
  }) => Promise<{ dudaAccountName: string; aliased: boolean }>;
  revokeEditor: (r: { staffUserId: string; staffEmail: string }) => Promise<unknown>;
  /** Clears an invite's "couldn't be set up" note once access is granted. */
  clearEditorError: (userId: string) => Promise<void>;
  /**
   * Delete EVERY factor (confirmed or half-enrolled) and set `mfa_required`
   * false, stamping who did it and when. Returns how many factors went.
   */
  turnOffMfa: (id: string, by: string) => Promise<number>;
  /** Set `mfa_required` true and clear the turned-off stamp. */
  requireMfa: (id: string) => Promise<void>;
  /** Delete the Supabase account for good. */
  deleteUser: (id: string) => Promise<void>;
}

/** The refusal for changing `target`'s access, or null when allowed. */
export function accessChangeRefusal(
  actorId: string | undefined,
  target: AdminUser,
  verb: "disable" | "delete" = "disable",
): { status: number; body: object } | null {
  if (target.id === actorId) {
    return { status: 409, body: { error: "cannot_change_self", detail: `You can't ${verb} your own account.` } };
  }
  if (target.role === "super_admin") {
    return {
      status: 409,
      body: { error: "cannot_change_super_admin", detail: "Another super admin's access can only be changed with the CLI." },
    };
  }
  return null;
}

async function target(deps: UserAdminDeps, id: string, res: Parameters<RequestHandler>[1]): Promise<AdminUser | null> {
  const user = await deps.getUser(id);
  if (!user) res.status(404).json({ error: "not_found" });
  return user;
}

const editorFailure = (err: unknown) =>
  err instanceof EditorAccessError ? { error: err.code, detail: err.message } : null;

/**
 * POST /api/users/:id/disable → `{ disabled: true, editorRevoked, editorError? }`.
 * The account is disabled first (that is what matters, and it is immediate);
 * a Website Editor revoke that fails is reported, not hidden, so it can be
 * retried with Remove access.
 */
export function disableUserRoute(deps: UserAdminDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await target(deps, String(req.params.id), res);
      if (!user) return;
      req.activity?.set({ target: { label: user.email } });
      const refusal = accessChangeRefusal(req.user?.id, user);
      if (refusal) {
        res.status(refusal.status).json(refusal.body);
        return;
      }
      await deps.setDisabled(user.id, true);
      console.info(`[users] ${req.user?.email} disabled ${user.email}`);
      let editorRevoked = false;
      let editorError: string | undefined;
      if (await deps.hasEditor(user.id)) {
        try {
          await deps.revokeEditor({ staffUserId: user.id, staffEmail: user.email });
          editorRevoked = true;
        } catch (err) {
          editorError = editorFailure(err)?.detail ?? "Couldn't remove Website Editor access.";
        }
      }
      req.activity?.set({
        summary: `Disabled ${user.email}${editorRevoked ? " and removed their Website Editor access" : ""}`,
        outcome: editorError ? "partial" : undefined,
        details: { editorRevoked, editorError },
      });
      res.json({ disabled: true, editorRevoked, ...(editorError ? { editorError } : {}) });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * DELETE /api/users/:id?confirm=true → `{ deleted: true, editorRevoked }`
 * (Josh, 2026-11-18; it was CLI-only). The account is gone for good: signed
 * out at once (requireAuth's getUser finds no user) and unable to sign in.
 * Disable is the reversible one.
 *
 * ⚠️ Website Editor access is removed FIRST, verified in Duda, and a revoke
 * that fails stops the delete: a Duda session outlives the Hub one, and once
 * the account is gone the Users page has no row left to retry from. The Duda
 * customer account itself stays, holding no site.
 *
 * What the person did stays: notes, read and star stamps, invites and the SSO
 * audit record names and emails, not a live account.
 */
export function deleteUserRoute(deps: UserAdminDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      if (req.query.confirm !== "true") {
        res.status(400).json({ error: "confirm_required", detail: "Deleting an account needs ?confirm=true." });
        return;
      }
      const user = await target(deps, String(req.params.id), res);
      if (!user) return;
      req.activity?.set({ target: { label: user.email } });
      const refusal = accessChangeRefusal(req.user?.id, user, "delete");
      if (refusal) {
        res.status(refusal.status).json(refusal.body);
        return;
      }
      let editorRevoked = false;
      if (await deps.hasEditor(user.id)) {
        try {
          await deps.revokeEditor({ staffUserId: user.id, staffEmail: user.email });
          editorRevoked = true;
        } catch (err) {
          const failure = editorFailure(err);
          res.status(502).json({
            error: "editor_revoke_failed",
            detail: `Couldn't remove their Website Editor access, so the account was kept: ${failure?.detail ?? "Duda refused."} Try again, or remove the access first.`,
          });
          return;
        }
      }
      await deps.deleteUser(user.id);
      if (await deps.getUser(user.id)) {
        res.status(502).json({ error: "not_applied", detail: "Supabase didn't delete the account. Try again." });
        return;
      }
      console.info(`[users] ${req.user?.email} deleted ${user.email}${editorRevoked ? " (Website Editor access removed first)" : ""}`);
      req.activity?.set({
        summary: `Deleted the account ${user.email}${editorRevoked ? " (Website Editor access removed first)" : ""}`,
        details: { editorRevoked, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null },
      });
      res.json({ deleted: true, editorRevoked });
    } catch (err) {
      next(err);
    }
  };
}

/** POST /api/users/:id/enable. Website Editor access is not given back. */
export function enableUserRoute(deps: UserAdminDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await target(deps, String(req.params.id), res);
      if (!user) return;
      req.activity?.set({ target: { label: user.email } });
      const refusal = accessChangeRefusal(req.user?.id, user);
      if (refusal) {
        res.status(refusal.status).json(refusal.body);
        return;
      }
      await deps.setDisabled(user.id, false);
      console.info(`[users] ${req.user?.email} enabled ${user.email}`);
      req.activity?.set({ summary: `Enabled ${user.email}` });
      res.json({ disabled: false });
    } catch (err) {
      next(err);
    }
  };
}

/** POST /api/users/:id/website-editor → `{ dudaAccountName, aliased }`. Refused for a disabled account. */
export function grantEditorRoute(deps: UserAdminDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await target(deps, String(req.params.id), res);
      if (!user) return;
      req.activity?.set({ target: { label: user.email } });
      if (user.disabled) {
        res.status(409).json({ error: "account_disabled", detail: "Enable the account first." });
        return;
      }
      try {
        const result = await deps.grantEditor({
          staffUserId: user.id,
          staffEmail: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          grantedBy: req.user?.email ?? null,
        });
        await deps.clearEditorError(user.id);
        console.info(`[users] ${req.user?.email} gave ${user.email} Website Editor access (${result.dudaAccountName})`);
        req.activity?.set({
          summary: `Gave ${user.email} Website Editor access`,
          details: { dudaAccount: result.dudaAccountName, aliased: result.aliased },
        });
        res.json({ dudaAccountName: result.dudaAccountName, aliased: result.aliased });
      } catch (err) {
        const failure = editorFailure(err);
        if (!failure) throw err;
        res.status(502).json(failure);
      }
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Who the super admin may change two-factor for: anyone but themselves (the
 * super admin must keep it, and their own routes need a 2FA session) and
 * another super admin (a CLI job, like disabling one).
 */
export function mfaChangeRefusal(actorId: string | undefined, target: AdminUser): { status: number; body: object } | null {
  if (target.id === actorId) {
    return { status: 409, body: { error: "cannot_change_self", detail: "You can't change your own two-factor here: as super admin you must keep it." } };
  }
  if (target.role === "super_admin") {
    return { status: 409, body: { error: "cannot_change_super_admin", detail: "Another super admin's two-factor can only be changed with the CLI." } };
  }
  return null;
}

/**
 * DELETE /api/users/:id/two-factor → `{ mfaEnabled: false, mfaRequired: false, factorsRemoved }`.
 *
 * ⚠️ It REMOVES a security control from someone else's account (Josh,
 * 2026-11-17: it was CLI-only, `users:mfa`, until then). The person can then
 * sign in with just their password, for a lost phone or someone who cannot
 * use an authenticator. So: super admin with a 2FA session only
 * (requireSuperAdmin), never their own account or another super admin's, the
 * result read back from Supabase before it is reported, and who did it stamped
 * on the account (`mfa_disabled_by`/`_at`), which the Users page shows. The
 * dialog asks the super admin to check with the person directly first.
 */
export function turnOffMfaRoute(deps: UserAdminDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await target(deps, String(req.params.id), res);
      if (!user) return;
      req.activity?.set({ target: { label: user.email } });
      const refusal = mfaChangeRefusal(req.user?.id, user);
      if (refusal) {
        res.status(refusal.status).json(refusal.body);
        return;
      }
      const factorsRemoved = await deps.turnOffMfa(user.id, req.user?.email ?? "unknown");
      const after = await deps.getUser(user.id);
      if (!after || after.mfaEnabled || after.mfaRequired) {
        res.status(502).json({ error: "not_applied", detail: "Supabase didn't keep the change. Try again." });
        return;
      }
      console.info(`[users] ${req.user?.email} turned off two-factor for ${user.email} (${factorsRemoved} factor(s) removed)`);
      req.activity?.set({ summary: `Turned off two-factor for ${user.email}`, details: { factorsRemoved } });
      res.json({ mfaEnabled: false, mfaRequired: false, factorsRemoved });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * POST /api/users/:id/two-factor → `{ mfaRequired: true, mfaEnabled }`: make
 * two-factor required again. Without an authenticator, their next request
 * sends them to /setup-2fa; with one, they can no longer turn it off.
 */
export function requireMfaRoute(deps: UserAdminDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await target(deps, String(req.params.id), res);
      if (!user) return;
      req.activity?.set({ target: { label: user.email } });
      const refusal = mfaChangeRefusal(req.user?.id, user);
      if (refusal) {
        res.status(refusal.status).json(refusal.body);
        return;
      }
      // Nothing would enforce it while two-factor is off for the Hub.
      if (!TWO_FACTOR_ON) {
        res.status(409).json({ error: "two_factor_off", detail: "Two-factor is turned off for the Hub at the moment." });
        return;
      }
      await deps.requireMfa(user.id);
      const after = await deps.getUser(user.id);
      if (!after?.mfaRequired) {
        res.status(502).json({ error: "not_applied", detail: "Supabase didn't keep the change. Try again." });
        return;
      }
      console.info(`[users] ${req.user?.email} required two-factor for ${user.email}`);
      req.activity?.set({ summary: `Required two-factor for ${user.email}` });
      res.json({ mfaRequired: true, mfaEnabled: after.mfaEnabled });
    } catch (err) {
      next(err);
    }
  };
}

/** DELETE /api/users/:id/website-editor. Verified with Duda before the Hub record goes. */
export function revokeEditorRoute(deps: UserAdminDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await target(deps, String(req.params.id), res);
      if (!user) return;
      req.activity?.set({ target: { label: user.email } });
      try {
        await deps.revokeEditor({ staffUserId: user.id, staffEmail: user.email });
        console.info(`[users] ${req.user?.email} removed Website Editor access from ${user.email}`);
        req.activity?.set({ summary: `Removed Website Editor access from ${user.email}` });
        res.json({ ok: true });
      } catch (err) {
        const failure = editorFailure(err);
        if (!failure) throw err;
        res.status(502).json(failure);
      }
    } catch (err) {
      next(err);
    }
  };
}

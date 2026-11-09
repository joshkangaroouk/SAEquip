import type { RequestHandler } from "express";
import { EditorAccessError } from "./dudaEditorAccess.js";

/**
 * What the super admin can do to an account from the Users page (2026-11):
 * disable or enable it, and give or remove its Website Editor access. Behind
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
}

/** The refusal for changing `target`'s access, or null when allowed. */
export function accessChangeRefusal(actorId: string | undefined, target: AdminUser): { status: number; body: object } | null {
  if (target.id === actorId) {
    return { status: 409, body: { error: "cannot_change_self", detail: "You can't disable your own account." } };
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
      res.json({ disabled: true, editorRevoked, ...(editorError ? { editorError } : {}) });
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
      const refusal = accessChangeRefusal(req.user?.id, user);
      if (refusal) {
        res.status(refusal.status).json(refusal.body);
        return;
      }
      await deps.setDisabled(user.id, false);
      console.info(`[users] ${req.user?.email} enabled ${user.email}`);
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

/** DELETE /api/users/:id/website-editor. Verified with Duda before the Hub record goes. */
export function revokeEditorRoute(deps: UserAdminDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await target(deps, String(req.params.id), res);
      if (!user) return;
      try {
        await deps.revokeEditor({ staffUserId: user.id, staffEmail: user.email });
        console.info(`[users] ${req.user?.email} removed Website Editor access from ${user.email}`);
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

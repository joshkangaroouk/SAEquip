import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { z } from "zod";
import { assessPassword } from "./passwordPolicy.js";

/**
 * Inviting people to the dashboard (2026-11). The super admin enters an email
 * and gets a link, `/invite#t=<token>`, that works ONCE, for 5 HOURS, and that
 * they send by hand. The invitee sees their email fixed, gives their name and
 * a password, and must then set up two-factor before the dashboard loads.
 *
 * The link is a bearer credential: whoever holds it can create that account.
 * So:
 * - only the SHA-256 of the token is stored, and the link is shown once;
 * - it lasts 5 hours and works once (claimed atomically), and can be revoked;
 * - the token travels in the URL FRAGMENT, which browsers never send to a
 *   server, and is redeemed only by a POST from the page, so a chat app's link
 *   preview cannot use it up;
 * - the email always comes from the invite, never from the browser.
 *
 * The handlers take their storage and Supabase calls as `deps`, so the rules
 * are tested without a database (see routes/invites.ts for the real ones).
 */

export const INVITE_TTL_MS = 5 * 60 * 60 * 1000;

/** 32 random bytes as base64url (43 characters), and the hash that is stored. */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type InviteStatus = "pending" | "used" | "revoked" | "expired";

export interface InviteRow {
  id: string;
  email: string;
  grantWebsiteEditor: boolean;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  acceptedUserId: string | null;
  editorGrantError: string | null;
}

/** Used and revoked win over expired, so the list says what actually happened. */
export function inviteStatus(i: Pick<InviteRow, "usedAt" | "revokedAt" | "expiresAt">, now: Date = new Date()): InviteStatus {
  if (i.usedAt) return "used";
  if (i.revokedAt) return "revoked";
  if (i.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

/** What the Users page gets: everything but the token, which is never stored. */
export const shapeInvite = (i: InviteRow, now: Date = new Date()) => ({ ...i, status: inviteStatus(i, now) });

/** A name as typed, minus control characters and runs of spaces. */
const name = z
  .string()
  .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1).max(80));

const token = z.string().min(20).max(100);

export const inviteBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    grantWebsiteEditor: z.boolean().optional(),
  })
  .strict();
export const tokenBody = z.object({ token }).strict();
export const acceptBody = z
  .object({ token, firstName: name, lastName: name, password: z.string().min(1).max(256) })
  .strict();

export interface InviteDeps {
  invites: {
    findByHash: (hash: string) => Promise<InviteRow | null>;
    findById: (id: string) => Promise<InviteRow | null>;
    list: () => Promise<InviteRow[]>;
    create: (data: { email: string; tokenHash: string; grantWebsiteEditor: boolean; createdBy: string; expiresAt: Date }) => Promise<InviteRow>;
    /** Revoke every PENDING invite for `email`; the count revoked. */
    revokePending: (email: string, by: string, now: Date) => Promise<number>;
    /** Revoke one invite if it is still pending; the count revoked (0 or 1). */
    revoke: (id: string, by: string, now: Date) => Promise<number>;
    /** Mark it used if it is still pending (unused, unrevoked, unexpired); 0 or 1. */
    claim: (id: string, now: Date) => Promise<number>;
    /** Undo a claim whose account could not be created, so the link works again. */
    release: (id: string) => Promise<void>;
    accepted: (id: string, userId: string) => Promise<void>;
    setEditorError: (id: string, message: string | null) => Promise<void>;
  };
  allowedDomains: string[];
  userExists: (email: string) => Promise<boolean>;
  createUser: (u: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    invitedBy: string;
  }) => Promise<{ id: string } | { error: string }>;
  isBreached: (password: string) => Promise<boolean>;
  grantEditor: (g: { staffUserId: string; staffEmail: string; firstName: string; lastName: string; grantedBy: string }) => Promise<unknown>;
  now?: () => Date;
}

const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";
const badRequest = (details: unknown) => ({ error: "validation_error", details });

/** GET /api/invites (super admin): the latest 100, newest first. */
export function listInvitesRoute(deps: InviteDeps): RequestHandler {
  return async (_req, res, next) => {
    try {
      const now = deps.now?.() ?? new Date();
      res.json({ invites: (await deps.invites.list()).map((i) => shapeInvite(i, now)) });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * POST /api/invites { email, grantWebsiteEditor? } (super admin) → 201
 * `{ invite, token }`. The token is in this answer ONLY; the browser builds
 * the link from its own address. A pending invite for the same email is
 * revoked, so there is only ever one live link per person.
 */
export function createInviteRoute(deps: InviteDeps): RequestHandler {
  return async (req, res, next) => {
    const parsed = inviteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(badRequest(parsed.error.flatten()));
      return;
    }
    const { email } = parsed.data;
    if (!deps.allowedDomains.includes(domainOf(email))) {
      res.status(400).json({
        error: "forbidden_domain",
        detail: `Only ${deps.allowedDomains.map((d) => `@${d}`).join(" and ")} addresses can sign in, so only they can be invited.`,
      });
      return;
    }
    try {
      if (await deps.userExists(email)) {
        res.status(409).json({
          error: "already_has_account",
          detail: `${email} already has an account. Send them a password reset from the Users list instead.`,
        });
        return;
      }
      const now = deps.now?.() ?? new Date();
      const by = req.user?.email ?? "unknown";
      await deps.invites.revokePending(email, by, now);
      const { token, hash } = newInviteToken();
      const invite = await deps.invites.create({
        email,
        tokenHash: hash,
        grantWebsiteEditor: parsed.data.grantWebsiteEditor ?? false,
        createdBy: by,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      });
      console.info(`[invites] ${by} invited ${email} (${invite.id})`);
      res.status(201).json({ invite: shapeInvite(invite, now), token });
    } catch (err) {
      next(err);
    }
  };
}

/** POST /api/invites/:id/revoke (super admin). 409 if it is no longer pending. */
export function revokeInviteRoute(deps: InviteDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const now = deps.now?.() ?? new Date();
      const by = req.user?.email ?? "unknown";
      if ((await deps.invites.revoke(id, by, now)) === 0) {
        const invite = await deps.invites.findById(id);
        if (!invite) res.status(404).json({ error: "not_found" });
        else res.status(409).json({ error: "not_pending", status: inviteStatus(invite, now) });
        return;
      }
      console.info(`[invites] ${by} revoked ${id}`);
      res.json({ invite: shapeInvite((await deps.invites.findById(id))!, now) });
    } catch (err) {
      next(err);
    }
  };
}

/** The invite for a token, or the response that says why not. */
async function usableInvite(
  deps: InviteDeps,
  rawToken: string,
  now: Date,
): Promise<{ invite: InviteRow } | { status: number; body: Record<string, unknown> }> {
  const invite = await deps.invites.findByHash(hashInviteToken(rawToken));
  if (!invite) return { status: 404, body: { error: "invalid" } };
  const status = inviteStatus(invite, now);
  if (status !== "pending") return { status: 410, body: { error: status } };
  return { invite };
}

/**
 * POST /api/accept-invite/check { token } (public) → `{ email, expiresAt }`,
 * 410 `{ error: "expired" | "used" | "revoked" }`, or 404 `{ error: "invalid" }`.
 * Saying which is harmless: it takes the token to ask.
 */
export function checkInviteRoute(deps: InviteDeps): RequestHandler {
  return async (req, res, next) => {
    const parsed = tokenBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(404).json({ error: "invalid" });
      return;
    }
    try {
      const found = await usableInvite(deps, parsed.data.token, deps.now?.() ?? new Date());
      if ("status" in found) {
        res.status(found.status).json(found.body);
        return;
      }
      res.json({ email: found.invite.email, expiresAt: found.invite.expiresAt });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * POST /api/accept-invite { token, firstName, lastName, password } (public).
 * Creates the account for the INVITE's email, flagged `mfa_required`, so it
 * can do nothing until two-factor is set up.
 *
 * The invite is claimed atomically BEFORE the account is created, so two
 * submissions cannot both succeed; if Supabase refuses the account, the claim
 * is released and the link works again. Website Editor access, if ticked, is
 * granted after: a Duda failure is recorded for a retry on the Users page and
 * never costs the person their account.
 */
export function acceptInviteRoute(deps: InviteDeps): RequestHandler {
  return async (req, res, next) => {
    const parsed = acceptBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(badRequest(parsed.error.flatten()));
      return;
    }
    const { firstName, lastName, password } = parsed.data;
    try {
      const now = deps.now?.() ?? new Date();
      const found = await usableInvite(deps, parsed.data.token, now);
      if ("status" in found) {
        res.status(found.status).json(found.body);
        return;
      }
      const { invite } = found;
      if (!deps.allowedDomains.includes(domainOf(invite.email))) {
        res.status(403).json({ error: "forbidden_domain" });
        return;
      }
      const verdict = assessPassword(password);
      if (!verdict.ok) {
        res.status(400).json({ error: "weak_password", problems: verdict.problems });
        return;
      }
      if (await deps.isBreached(password)) {
        res.status(400).json({
          error: "breached_password",
          detail: "That password has appeared in a data breach, so it is the first thing an attacker would try. Choose another.",
        });
        return;
      }
      if (await deps.userExists(invite.email)) {
        res.status(409).json({ error: "already_has_account" });
        return;
      }
      if ((await deps.invites.claim(invite.id, now)) === 0) {
        res.status(410).json({ error: "used" });
        return;
      }
      const created = await deps.createUser({ email: invite.email, password, firstName, lastName, invitedBy: invite.createdBy });
      if ("error" in created) {
        await deps.invites.release(invite.id);
        res.status(400).json({ error: "create_failed", detail: created.error });
        return;
      }
      await deps.invites.accepted(invite.id, created.id);
      console.info(`[invites] ${invite.email} accepted ${invite.id} (user ${created.id})`);

      if (invite.grantWebsiteEditor) {
        try {
          await deps.grantEditor({
            staffUserId: created.id,
            staffEmail: invite.email,
            firstName,
            lastName,
            grantedBy: invite.createdBy,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown error";
          await deps.invites.setEditorError(invite.id, message.slice(0, 500));
          console.warn(`[invites] Website Editor access for ${invite.email} not set up: ${message}`);
        }
      }
      res.status(201).json({ ok: true, email: invite.email });
    } catch (err) {
      next(err);
    }
  };
}

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { supabase } from "../supabase.js";
import { requireSuperAdmin } from "../middleware/requireAuth.js";
import { PgRateLimitStore } from "../middleware/pgRateLimitStore.js";
import { isBreachedPassword } from "../services/passwordPolicy.js";
import { findUserWithFactors } from "../services/supabaseUsers.js";
import { grantEditorAccess } from "../services/dudaEditorAccess.js";
import {
  acceptInviteRoute,
  checkInviteRoute,
  createInviteRoute,
  listInvitesRoute,
  revokeInviteRoute,
  type InviteDeps,
} from "../services/userInvites.js";

/** The real storage, Supabase and Duda calls behind services/userInvites.ts. */
const deps: InviteDeps = {
  invites: {
    findByHash: (tokenHash) => prisma.userInvite.findUnique({ where: { tokenHash } }),
    findById: (id) => prisma.userInvite.findUnique({ where: { id } }),
    list: () => prisma.userInvite.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    create: (data) => prisma.userInvite.create({ data }),
    revokePending: async (email, by, now) =>
      (
        await prisma.userInvite.updateMany({
          where: { email, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now, revokedBy: by },
        })
      ).count,
    revoke: async (id, by, now) =>
      (
        await prisma.userInvite.updateMany({
          where: { id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now, revokedBy: by },
        })
      ).count,
    // One conditional UPDATE, so two simultaneous submissions cannot both claim it.
    claim: async (id, now) =>
      (
        await prisma.userInvite.updateMany({
          where: { id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        })
      ).count,
    release: async (id) => {
      await prisma.userInvite.update({ where: { id }, data: { usedAt: null } });
    },
    accepted: async (id, userId) => {
      await prisma.userInvite.update({ where: { id }, data: { acceptedUserId: userId } });
    },
    setEditorError: async (id, message) => {
      await prisma.userInvite.update({ where: { id }, data: { editorGrantError: message } });
    },
  },
  allowedDomains: env.allowedEmailDomains,
  userExists: async (email) => (await findUserWithFactors(email)) !== null,
  createUser: async ({ email, password, firstName, lastName, invitedBy }) => {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      // The invite chose the address; public signup stays disabled.
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
      // app_metadata: only the service role can write it, so the API can trust it.
      app_metadata: { mfa_required: true, invited_by: invitedBy },
    });
    if (error || !data.user) return { error: error?.message ?? "Supabase returned no user." };
    return { id: data.user.id };
  },
  isBreached: (password) => isBreachedPassword(password),
  grantEditor: (g) => grantEditorAccess(g),
};

/** Super admin only, under /api (so behind requireAuth too). */
export const invitesRouter = Router();
invitesRouter.get("/invites", requireSuperAdmin, listInvitesRoute(deps));
invitesRouter.post("/invites", requireSuperAdmin, createInviteRoute(deps));
invitesRouter.post("/invites/:id/revoke", requireSuperAdmin, revokeInviteRoute(deps));

/**
 * Public, mounted at /api/accept-invite BEFORE requireAuth: the person has no
 * account yet. Postgres-backed limits per IP (an in-memory counter is per
 * serverless instance). The token is 256 bits, so this is about load, not
 * guessing.
 */
const acceptLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("accept-invite"),
  message: { error: "rate_limited", detail: "Too many attempts. Wait a minute and try again." },
});
const acceptHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 50,
  standardHeaders: false,
  legacyHeaders: false,
  store: new PgRateLimitStore("accept-invite-hourly"),
  message: { error: "rate_limited", detail: "Too many attempts. Try again later." },
});

export const acceptInviteRouter = Router();
acceptInviteRouter.use(acceptLimiter, acceptHourlyLimiter);
acceptInviteRouter.post("/check", checkInviteRoute(deps));
acceptInviteRouter.post("/", acceptInviteRoute(deps));

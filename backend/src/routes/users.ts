import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { supabase } from "../supabase.js";
import { hasVerifiedFactor, listUsersWithFactors } from "../services/supabaseUsers.js";
import { PgRateLimitStore } from "../middleware/pgRateLimitStore.js";
import { isSuperAdminSession, requireSuperAdmin } from "../middleware/requireAuth.js";
import { grantEditorAccess, revokeEditorAccess } from "../services/dudaEditorAccess.js";
import {
  disableUserRoute,
  enableUserRoute,
  grantEditorRoute,
  revokeEditorRoute,
  type UserAdminDeps,
} from "../services/userAdmin.js";

export const usersRouter = Router();

/**
 * Staff accounts: the list (everyone signed in), a password-reset trigger
 * (your own address; anyone's for the super admin), and, since 2026-11, the
 * SUPER ADMIN's actions: disable / enable an account
 * and give / remove its Website Editor access. New accounts come from invites
 * (routes/invites.ts).
 *
 * ⚠️ Every action that changes access is behind requireSuperAdmin (the
 * `super_admin` role in app_metadata AND a 2FA-verified session).
 * `requireAuth` alone proves only "valid token + allowed domain", and
 * ALLOWED_EMAIL_DOMAINS spans two companies, which is far too coarse to gate
 * access. No route can GRANT the super admin role: that stays a CLI job
 * (`npm run users:admin`), as do deleting an account and resetting someone's
 * 2FA (`users:create`, `users:mfa`).
 *
 * Everyone else still has identical access to the content: super admin adds
 * user management, nothing more.
 */

/** Shape returned to the dashboard. Deliberately no tokens, no links. */
interface StaffUser {
  id: string;
  email: string;
  /** "First Last" from user_metadata (invited accounts), else null. */
  name: string | null;
  /** "super_admin" or null. */
  role: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  /** TOTP factors that completed enrollment. */
  mfaEnabled: boolean;
  /** Two-factor is required for this account (invitees, the super admin). */
  mfaRequired: boolean;
  /** Disabled by the super admin (banned in Supabase). */
  disabled: boolean;
  /** Has a Duda editor account mapped (see the Website Editor section). */
  dudaEditor: boolean;
  /** The Duda account the mapping uses, e.g. a +saequip one. */
  dudaAccountName: string | null;
  /** Website Editor access was ticked on the invite but could not be set up. */
  editorError: string | null;
}

const fullName = (meta: Record<string, unknown> | undefined): string | null => {
  const parts = [meta?.first_name, meta?.last_name].filter((p): p is string => typeof p === "string" && p.trim() !== "");
  return parts.length ? parts.join(" ") : null;
};
const isDisabled = (bannedUntil: string | undefined) => !!bannedUntil && Date.parse(bannedUntil) > Date.now();

/**
 * GET /api/users — every Supabase auth user whose domain is allowed.
 *
 * Users outside ALLOWED_EMAIL_DOMAINS cannot sign in anyway (requireAuth
 * rejects them), so listing them would only add noise.
 */
usersRouter.get("/users", async (req, res, next) => {
  try {
    // ⚠️ via listUsersWithFactors, NOT listUsers: the latter omits `factors`
    // entirely, so Two-factor rendered "Off" for accounts that had it on.
    const allUsers = await listUsersWithFactors(env.allowedEmailDomains);

    const [editors, editorErrors] = await Promise.all([
      prisma.dudaEditorAccount.findMany({ select: { staffUserId: true, dudaAccountName: true } }),
      prisma.userInvite.findMany({
        where: { acceptedUserId: { not: null }, editorGrantError: { not: null } },
        select: { acceptedUserId: true, editorGrantError: true },
      }),
    ]);
    const editorFor = new Map(editors.map((e) => [e.staffUserId, e.dudaAccountName]));
    const errorFor = new Map(editorErrors.map((i) => [i.acceptedUserId, i.editorGrantError]));

    const users: StaffUser[] = allUsers
      .map((u) => {
        const app = (u.app_metadata ?? {}) as { role?: unknown; mfa_required?: unknown };
        const dudaAccountName = editorFor.get(u.id) ?? null;
        return {
          id: u.id,
          email: u.email ?? "",
          name: fullName(u.user_metadata),
          role: typeof app.role === "string" ? app.role : null,
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at ?? null,
          emailConfirmed: !!u.email_confirmed_at,
          mfaEnabled: hasVerifiedFactor(u),
          mfaRequired: app.mfa_required === true,
          disabled: isDisabled(u.banned_until),
          dudaEditor: dudaAccountName !== null,
          dudaAccountName,
          editorError: dudaAccountName ? null : errorFor.get(u.id) ?? null,
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    // Whether the person looking may manage users (the page shows the controls).
    const superAdmin = req.user?.role === "super_admin" && req.user.aal === "aal2";
    res.json({ users, allowedDomains: env.allowedEmailDomains, viewer: { superAdmin } });
  } catch (err) {
    next(err);
  }
});

/**
 * Password-reset emails are rate limited per CALLER, Postgres-backed.
 *
 * In-memory counters are useless on serverless — each short-lived instance
 * keeps its own, so "5 per hour" becomes "5 per hour per instance" (the same
 * reasoning as the SSO limiter). Keyed on the authenticated user rather than
 * the IP, so it cannot be sidestepped by changing network and does not depend
 * on proxy headers at all.
 */
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  store: new PgRateLimitStore("user-password-reset"),
  message: { error: "rate_limited", detail: "Too many reset emails. Try again later." },
});

const resetBody = z.object({ email: z.string().email() }).strict();

/**
 * Where the emailed reset link should land: THIS dashboard's /reset-password.
 *
 * ⚠️ Only an Origin naming the host this request was served on (or localhost
 * in development) is used. It used to accept any well-formed origin, so the
 * only thing stopping `https://evil.example/reset-password` from going into a
 * colleague's reset email was Supabase's redirect allowlist — a dashboard
 * setting this repo cannot see, where one wildcard would hand a live recovery
 * link to whoever owns that page. The allowlist stays the second check.
 */
export function resetRedirectFor(
  origin: string | undefined,
  ...requestHosts: (string | undefined)[]
): string | undefined {
  if (!origin) return undefined;
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
  const sameHost = requestHosts.some((h) => !!h && u.host.toLowerCase() === h.toLowerCase());
  const localDev = !process.env.VERCEL && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  return sameHost || localDev ? `${u.origin}/reset-password` : undefined;
}

/**
 * POST /api/users/password-reset — asks Supabase to email a reset link.
 *
 * ⚠️ The link is NEVER returned to the caller. `generateLink` would hand back
 * a live recovery token, which is a bearer credential exactly like a Duda SSO
 * URL — anyone holding it becomes that user. `resetPasswordForEmail` sends it
 * to the address itself and returns nothing, so possession of the reset
 * requires possession of the mailbox. Same reason the SSO route logs status
 * codes only.
 *
 * The target must be an existing allowed-domain user: this is a staff admin
 * action, not a public endpoint, and it should not double as a way to probe
 * which addresses exist elsewhere.
 *
 * ⚠️ Only YOUR OWN address, unless you are the super admin (the role and a
 * 2FA session, as requireSuperAdmin). Anyone else gets 403
 * `super_admin_required` (Josh, 2026-11-09). The Users page shows the button
 * only where it will work.
 */
usersRouter.post("/users/password-reset", resetLimiter, async (req, res, next) => {
  const parsed = resetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const own = email === (req.user?.email ?? "").trim().toLowerCase();
  if (!own && !isSuperAdminSession(req.user)) {
    res.status(403).json({
      error: "super_admin_required",
      detail: "You can only send a reset email to yourself. Ask the super admin to reset someone else's password.",
    });
    return;
  }
  const domain = email.split("@")[1] ?? "";
  if (!env.allowedEmailDomains.includes(domain)) {
    res.status(403).json({ error: "forbidden_domain" });
    return;
  }

  try {
    /*
     * ⚠️ `redirectTo` must be an ABSOLUTE URL that is also in Supabase's
     * redirect allowlist. This used to interpolate the Origin header
     * unchecked, so a request without one produced the relative
     * "/reset-password" — Supabase silently discards an unusable redirect and
     * falls back to the project's Site URL, which is how a reset link ended up
     * pointing at http://localhost:3000/. Omitting it is the honest fallback:
     * the Site URL is then a deliberate choice rather than the result of a
     * malformed value.
     */
    const origin = req.header("origin") ?? "";
    // X-Forwarded-Host only on Vercel, where their proxy sets it; anywhere the
    // app is reachable directly it is caller-controlled (see `trust proxy`).
    const redirectTo = resetRedirectFor(
      origin,
      req.get("host"),
      process.env.VERCEL ? req.get("x-forwarded-host") : undefined,
    );
    if (!redirectTo) {
      console.warn(
        `[users] Origin ${JSON.stringify(origin.slice(0, 120))} is not this dashboard — letting Supabase use the project Site URL. ` +
          "The reset link will only land on /reset-password if the Site URL points there.",
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : {},
    );
    if (error) {
      // Logged without the address's token/link — there is none in this flow,
      // but keep the habit.
      console.error("[users] resetPasswordForEmail failed:", error.message);
      res.status(502).json({ error: "email_failed", detail: error.message });
      return;
    }
    console.log(`[users] password reset requested for ${email} by ${req.user?.email}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** The real Supabase and Duda calls behind services/userAdmin.ts. */
const adminDeps: UserAdminDeps = {
  getUser: async (id) => {
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error || !data.user) return null;
    const u = data.user;
    const meta = (u.user_metadata ?? {}) as { first_name?: unknown; last_name?: unknown };
    const role = (u.app_metadata as { role?: unknown } | undefined)?.role;
    return {
      id: u.id,
      email: u.email ?? "",
      role: typeof role === "string" ? role : null,
      firstName: typeof meta.first_name === "string" ? meta.first_name : null,
      lastName: typeof meta.last_name === "string" ? meta.last_name : null,
      disabled: isDisabled(u.banned_until),
    };
  },
  setDisabled: async (id, disabled) => {
    // A ban stops sign-in and token refresh; requireAuth refuses a banned
    // account's open session at once. "none" lifts it.
    const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: disabled ? "876000h" : "none" });
    if (error) throw error;
  },
  hasEditor: async (userId) => (await prisma.dudaEditorAccount.count({ where: { staffUserId: userId } })) > 0,
  grantEditor: (g) => grantEditorAccess(g),
  revokeEditor: (r) => revokeEditorAccess(r),
  clearEditorError: async (userId) => {
    await prisma.userInvite.updateMany({ where: { acceptedUserId: userId }, data: { editorGrantError: null } });
  },
};

usersRouter.post("/users/:id/disable", requireSuperAdmin, disableUserRoute(adminDeps));
usersRouter.post("/users/:id/enable", requireSuperAdmin, enableUserRoute(adminDeps));
usersRouter.post("/users/:id/website-editor", requireSuperAdmin, grantEditorRoute(adminDeps));
usersRouter.delete("/users/:id/website-editor", requireSuperAdmin, revokeEditorRoute(adminDeps));

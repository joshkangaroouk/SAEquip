import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { supabase } from "../supabase.js";
import { hasVerifiedFactor, listUsersWithFactors } from "../services/supabaseUsers.js";
import { PgRateLimitStore } from "../middleware/pgRateLimitStore.js";

export const usersRouter = Router();

/**
 * Staff accounts — READ-ONLY, plus a password-reset trigger.
 *
 * ⚠️ Creating and deleting accounts is deliberately NOT here. `requireAuth`
 * only proves "valid Supabase token + allowed email domain", and
 * ALLOWED_EMAIL_DOMAINS spans both kangaroouk.com and saequip.com — far too
 * coarse to gate account creation. As an HTTP route, any signed-in session
 * could mint itself another account or delete a colleague's. Provisioning is a
 * CLI operation for exactly the same reason the Duda editor provisioning is
 * (see scripts/dudaEditorProvision.ts):
 *
 *   npm run users:create --workspace=backend -- --email <addr> --confirm
 *
 * There is also no role model in this app yet: every authenticated user has
 * the same access. So "admin" is not a flag this endpoint can report, and the
 * page says so rather than implying a hierarchy that does not exist.
 */

/** Shape returned to the dashboard. Deliberately no tokens, no links. */
interface StaffUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  /** TOTP factors that completed enrollment. */
  mfaEnabled: boolean;
  /** Has a Duda editor account mapped (see the Website Editor section). */
  dudaEditor: boolean;
}

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

    const editors = await prisma.dudaEditorAccount.findMany({ select: { staffUserId: true } });
    const editorIds = new Set(editors.map((e) => e.staffUserId));

    const users: StaffUser[] = allUsers
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        emailConfirmed: !!u.email_confirmed_at,
        mfaEnabled: hasVerifiedFactor(u),
        dudaEditor: editorIds.has(u.id),
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    res.json({ users, allowedDomains: env.allowedEmailDomains });
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
 */
usersRouter.post("/users/password-reset", resetLimiter, async (req, res, next) => {
  const parsed = resetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
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
    const redirectTo = /^https?:\/\/[^/]+$/.test(origin) ? `${origin}/reset-password` : undefined;
    if (!redirectTo) {
      console.warn(
        `[users] no usable Origin header (${JSON.stringify(origin)}) — letting Supabase use the project Site URL. ` +
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

import type { Request, Response, NextFunction } from "express";
import { env } from "../env.js";
import { supabase } from "../supabase.js";
import { TWO_FACTOR_ON } from "../services/twoFactor.js";
import { noteSession } from "../services/activity.js";

/**
 * Read claims from an ALREADY-VERIFIED Supabase access token: `aal`, the
 * session id and how the session signed in (`amr`).
 *
 * ⚠️ This decodes without verifying, which is only safe because
 * `supabase.auth.getUser(token)` has already validated the token against the
 * auth server before this is called. Never call it on an unvalidated token —
 * a JWT payload is attacker-controlled until the signature is checked.
 *
 * The claims are not exposed on the user object, so reading the payload is the
 * only way to know whether the session cleared a second factor, and which
 * session a request belongs to (the activity log's "Signed in").
 */
type TokenClaims = { aal: string | null; sessionId: string | null; signInMethod: string | null; signedInAt: number | null };
function tokenClaims(token: string): TokenClaims {
  const none: TokenClaims = { aal: null, sessionId: null, signInMethod: null, signedInAt: null };
  try {
    const payload = token.split(".")[1];
    if (!payload) return none;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as { aal?: unknown; session_id?: unknown; amr?: unknown };
    // `amr`: [{ method: "password", timestamp: <seconds> }, …]; the first is how
    // the session began.
    const first = Array.isArray(claims.amr) ? (claims.amr[0] as { method?: unknown; timestamp?: unknown } | undefined) : undefined;
    return {
      aal: typeof claims.aal === "string" ? claims.aal : null,
      sessionId: typeof claims.session_id === "string" && claims.session_id.length <= 100 ? claims.session_id : null,
      signInMethod: typeof first?.method === "string" ? first.method.slice(0, 40) : null,
      signedInAt: typeof first?.timestamp === "number" ? first.timestamp * 1000 : null,
    };
  } catch {
    return none;
  }
}

/**
 * Requires a valid Supabase access token whose user's email domain is in
 * ALLOWED_EMAIL_DOMAINS. On success, attaches req.user = { id, email, role, aal }.
 *
 * Also refuses (2026-11, with user invites):
 * - a DISABLED account (`banned_until` in the future): 403 `account_disabled`.
 *   The ban also stops new sign-ins and token refresh; this makes it immediate
 *   for a session that is already open.
 * - an account that MUST have two-factor (`app_metadata.mfa_required`: every
 *   invited user, and the super admin) but has no verified factor yet: 403
 *   `mfa_setup_required`, so the dashboard sends them to set it up. Skipping
 *   that page gets them nothing: every route refuses them until it is done.
 *
 * ⚠️ Also enforces two-factor: a user with a VERIFIED factor must present an
 * `aal2` token. This is the half that makes MFA real. Supabase enrols and
 * challenges factors entirely in the browser, and a session that skips the
 * challenge still carries a perfectly valid `aal1` access token — so without
 * a server-side check, a caller could enrol MFA, ignore the prompt and keep
 * using the API exactly as before. Enforcement has to live where the token is
 * trusted, not where the prompt is drawn.
 *
 * Deliberately per-user and opt-in: only an *enrolled and verified* factor
 * raises the bar, so enabling this cannot lock out staff who have not set MFA
 * up yet. Requiring it for everyone would be a separate, announced change.
 *
 * An `unverified` factor is ignored — enrolment leaves one behind until the
 * first code is confirmed, and honouring it would lock the user out
 * mid-enrolment with no way to finish.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const email = data.user.email ?? "";
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  // From here the token is genuine, so a refusal names someone: the activity
  // log records it ("Was refused access"). Anonymous 401s above are bots and
  // stale tabs, and are not logged.
  const who = { id: data.user.id, email };
  if (!domain || !env.allowedEmailDomains.includes(domain)) {
    req.activity?.refuse("forbidden_domain", who);
    res.status(403).json({ error: "forbidden_domain" });
    return;
  }

  const bannedUntil = data.user.banned_until ? Date.parse(data.user.banned_until) : NaN;
  if (bannedUntil > Date.now()) {
    req.activity?.refuse("account_disabled", who);
    res.status(403).json({ error: "account_disabled", detail: "This account has been disabled." });
    return;
  }

  const meta = (data.user.app_metadata ?? {}) as { role?: unknown; mfa_required?: unknown };
  const hasVerifiedFactor = (data.user.factors ?? []).some((f) => f.status === "verified");
  // Not while two-factor is off for the Hub (services/twoFactor.ts).
  if (TWO_FACTOR_ON && meta.mfa_required === true && !hasVerifiedFactor) {
    req.activity?.refuse("mfa_setup_required", who);
    res.status(403).json({
      error: "mfa_setup_required",
      detail: "This account must set up two-factor authentication before it can be used.",
    });
    return;
  }

  const claims = tokenClaims(token);
  const aal = claims.aal;
  if (hasVerifiedFactor && aal !== "aal2") {
    req.activity?.refuse("mfa_required", who);
    // A distinct code so the dashboard can send the user through the second
    // factor rather than showing them a generic "signed out".
    res.status(403).json({
      error: "mfa_required",
      detail: "This account has two-factor authentication enabled. Sign in again and enter your code.",
    });
    return;
  }

  req.user = {
    id: data.user.id,
    email,
    role: typeof meta.role === "string" ? meta.role : null,
    aal,
    sessionId: claims.sessionId,
  };
  // "Signed in" / "session used from a new IP" (services/activity.ts). Bounded
  // and never throws, so it cannot fail the request.
  await noteSession(req, who, claims.sessionId, { method: claims.signInMethod, at: claims.signedInAt });
  next();
}

/**
 * After requireAuth: only the super admin (`app_metadata.role`, set with the
 * `users:admin` CLI and by nothing else), and only from a session that has
 * used its second factor. Inviting people, disabling them and granting
 * Website Editor access all hand out or take away access, so a stolen
 * password alone must not be enough.
 */
/**
 * The same rule as requireSuperAdmin, as a test, for a route that everyone can
 * use but only the super admin can point at SOMEONE ELSE (the password reset).
 */
export function isSuperAdminSession(user: Request["user"]): boolean {
  return user?.role === "super_admin" && (!TWO_FACTOR_ON || user.aal === "aal2");
}

/**
 * ⚠️ While two-factor is off for the Hub (services/twoFactor.ts) this needs
 * the role only: the super admin has no authenticator to sign in with. An
 * account that still has one is held to its code by requireAuth anyway.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "super_admin") {
    req.activity?.refuse("super_admin_required");
    res.status(403).json({ error: "super_admin_required", detail: "Only the super admin can do this." });
    return;
  }
  if (TWO_FACTOR_ON && req.user.aal !== "aal2") {
    req.activity?.refuse("super_admin_required");
    res.status(403).json({
      error: "super_admin_required",
      detail: "Set up two-factor authentication on Security, then sign in again with your code.",
    });
    return;
  }
  next();
}

import type { Request, Response, NextFunction } from "express";
import { env } from "../env.js";
import { supabase } from "../supabase.js";

/**
 * Read the `aal` claim from an ALREADY-VERIFIED Supabase access token.
 *
 * ⚠️ This decodes without verifying, which is only safe because
 * `supabase.auth.getUser(token)` has already validated the token against the
 * auth server before this is called. Never call it on an unvalidated token —
 * a JWT payload is attacker-controlled until the signature is checked.
 *
 * The claim is not exposed on the user object, so reading the payload is the
 * only way to know whether the session cleared a second factor.
 */
function assuranceLevel(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as { aal?: unknown };
    return typeof claims.aal === "string" ? claims.aal : null;
  } catch {
    return null;
  }
}

/**
 * Requires a valid Supabase access token whose user's email domain is in
 * ALLOWED_EMAIL_DOMAINS. On success, attaches req.user = { id, email }.
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
  if (!domain || !env.allowedEmailDomains.includes(domain)) {
    res.status(403).json({ error: "forbidden_domain" });
    return;
  }

  const hasVerifiedFactor = (data.user.factors ?? []).some((f) => f.status === "verified");
  if (hasVerifiedFactor && assuranceLevel(token) !== "aal2") {
    // A distinct code so the dashboard can send the user through the second
    // factor rather than showing them a generic "signed out".
    res.status(403).json({
      error: "mfa_required",
      detail: "This account has two-factor authentication enabled. Sign in again and enter your code.",
    });
    return;
  }

  req.user = { id: data.user.id, email };
  next();
}

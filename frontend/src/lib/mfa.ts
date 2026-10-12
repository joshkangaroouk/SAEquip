import { supabase } from "./supabase";

/**
 * Raise the current session to aal2 with a code from ANY of the user's
 * confirmed authenticators.
 *
 * ⚠️ Every enrolment has its own secret, so a code from the backup device
 * only matches the backup's factor. This used to challenge the FIRST verified
 * factor alone, which made "Add another device" on /security useless as the
 * lockout fallback CLAUDE.md recommends: lose phone A, and every code from
 * phone B was refused. Each factor is tried in turn; the first error is the
 * one reported, since it is the factor most people use.
 *
 * Shared by the login code step and /reset-password, which needs the same
 * step-up because Supabase refuses a password change from an aal1 session
 * once MFA is on.
 */
export async function verifyTotpCode(code: string): Promise<{ error: string | null }> {
  const { data: list, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { error: listError.message };
  const factors = (list.totp ?? []).filter((f) => f.status === "verified");
  if (!factors.length) return { error: "No confirmed authenticator on this account." };

  let firstError: string | null = null;
  for (const factor of factors) {
    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error) {
      firstError ??= challenge.error.message;
      continue;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    if (!error) return { error: null };
    firstError ??= error.message;
  }
  return { error: firstError };
}

/** True when this session has a confirmed factor but has not used it yet. */
export async function needsSecondFactor(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

/** The `aal` claim of an access token, read without verifying it. */
function tokenAal(accessToken: string): string | null {
  try {
    const part = accessToken.split(".")[1] ?? "";
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}

/**
 * A signed-in session that still owes its second factor: the account has a
 * confirmed authenticator but this token is not aal2. The API refuses such a
 * session with `mfa_required`.
 *
 * Synchronous on purpose — the same rule supabase-js's
 * getAuthenticatorAssuranceLevel() applies (factors on the session's user, the
 * token's `aal` claim), but with no lock, so it is safe inside an
 * onAuthStateChange callback and on every render. Display-only: the server
 * verifies the token and enforces aal2 itself.
 */
export function sessionNeedsSecondFactor(
  session: { access_token: string; user: { factors?: { status: string }[] | null } } | null,
): boolean {
  if (!session) return false;
  const confirmed = (session.user.factors ?? []).some((f) => f.status === "verified");
  return confirmed && tokenAal(session.access_token) !== "aal2";
}

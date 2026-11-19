/**
 * What the address said when the page first loaded, read BEFORE the Supabase
 * client consumes it (lib/supabase.ts calls this ahead of `createClient`).
 *
 * Why /reset-password needs it (USERS-AUDIT M3): the page used to show its form
 * for ANY session. supabase-js keeps an existing session when the link in the
 * URL fails ("Don't remove existing session on URL login failure"), so on a
 * shared computer someone opening their own EXPIRED link saw the form, typed a
 * new password, and changed the password of whoever was already signed in.
 * Now the form appears only for the session the recovery link itself created,
 * which this snapshot lets the page prove: the link's access token names its
 * user (`sub`), and the session must be that user.
 *
 * Only the implicit flow is handled, which is the client's default and what
 * Supabase's emailed links use here: `#access_token=…&type=recovery`, or
 * `#error=…&error_code=otp_expired&error_description=…` when the link is dead.
 */
export interface AuthRedirect {
  /** The link was a password-recovery link carrying a token. */
  recovery: boolean;
  /** The user the recovery token was issued for (its `sub`), when readable. */
  recoveryUserId: string | null;
  /** Supabase put an error in the address instead of a token. */
  error: { code: string | null; description: string | null } | null;
}

function params(href: string): URLSearchParams {
  const url = new URL(href);
  const merged = new URLSearchParams(url.search);
  // The fragment wins, as in supabase-js's own parser.
  new URLSearchParams(url.hash.replace(/^#/, "")).forEach((v, k) => merged.set(k, v));
  return merged;
}

/** The `sub` claim of a JWT, without verifying it: only used to compare identities. */
export function jwtSubject(token: string | null): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const claims = JSON.parse(atob(b64)) as { sub?: unknown };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

export function readAuthRedirect(href: string): AuthRedirect {
  let p: URLSearchParams;
  try {
    p = params(href);
  } catch {
    return { recovery: false, recoveryUserId: null, error: null };
  }
  const code = p.get("error_code");
  const description = p.get("error_description");
  const error = p.get("error") || code || description ? { code, description } : null;
  const recovery = !error && p.get("type") === "recovery" && !!p.get("access_token");
  return { recovery, recoveryUserId: recovery ? jwtSubject(p.get("access_token")) : null, error };
}

/** A readable sentence for the error Supabase put in the address. */
export function authRedirectMessage(error: NonNullable<AuthRedirect["error"]>): string {
  if (error.code === "otp_expired") return "This reset link has expired or has already been used. Request a new one.";
  return `This reset link didn't work${error.description ? ` (${error.description})` : ""}. Request a new one.`;
}

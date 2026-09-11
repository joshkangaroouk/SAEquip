import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase.js";

/**
 * Supabase admin user lookups that actually include MFA factors.
 *
 * ⚠️ `auth.admin.listUsers()` DOES NOT RETURN `factors` — the key is absent
 * from every row, not merely empty. Only `getUserById()` includes them. That
 * is silent and reads as "nobody has MFA": the Users page showed Two-factor
 * "Off" for an account with a verified TOTP factor, `users:create --check`
 * reported "not enrolled", and — the dangerous one — `users:mfa` would have
 * told an admin there were no factors to delete, which is the ONLY way back
 * in for someone locked out by a lost authenticator.
 *
 * Everything that needs factors goes through here, so the quirk is known in
 * one place rather than rediscovered per caller.
 */

/** Users whose email domain is allowed, each re-fetched so `factors` is real. */
export async function listUsersWithFactors(allowedDomains: string[]): Promise<User[]> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;

  const relevant = data.users.filter((u) => {
    const domain = (u.email ?? "").split("@")[1]?.toLowerCase() ?? "";
    return domain && allowedDomains.includes(domain);
  });

  /*
   * One extra request per user. It is an N+1, and deliberately accepted: the
   * staff list is a handful of people, these run in parallel, and the
   * alternative is a page that lies about a security control. Revisit if the
   * team ever grows past a few dozen.
   */
  const full = await Promise.all(
    relevant.map(async (u) => {
      const { data: one, error: err } = await supabase.auth.admin.getUserById(u.id);
      // Fall back to the listing row rather than dropping the user: a missing
      // factor list is a display bug, an absent user looks like a deleted one.
      if (err || !one?.user) return u;
      return one.user;
    }),
  );
  return full;
}

/** One user by email, with factors. Null when there is no such account. */
export async function findUserWithFactors(email: string): Promise<User | null> {
  const target = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
  if (!hit) return null;
  const { data: one, error: err } = await supabase.auth.admin.getUserById(hit.id);
  return err || !one?.user ? hit : one.user;
}

export const hasVerifiedFactor = (u: User): boolean =>
  (u.factors ?? []).some((f) => f.status === "verified");

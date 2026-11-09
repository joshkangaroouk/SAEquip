import { createHash } from "node:crypto";

/**
 * Password rules for staff accounts: the ONE copy, used by the `users:create`
 * CLI and by accepting an invite (2026-11). `frontend/src/lib/passwordPolicy.ts`
 * mirrors the rules for the live checklist; keep the two in step.
 *
 * Refuses the passwords that make "extremely secure" a fiction.
 */
export function assessPassword(pw: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (pw.length < 12) problems.push(`only ${pw.length} characters — 12 is the practical minimum, 16+ is better`);
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) problems.push("no mix of upper and lower case");
  if (!/\d/.test(pw)) problems.push("no digit");
  if (!/[^A-Za-z0-9]/.test(pw)) problems.push("no symbol");
  // A dictionary word plus a trailing digit or two is the single most common
  // human password shape, and the first thing any credential-stuffing list
  // tries. Length alone does not rescue it.
  if (/^[A-Za-z]+\d{0,3}[!?.]?$/.test(pw)) problems.push("word-plus-digits shape — the first pattern any cracking list tries");
  return { ok: problems.length === 0, problems };
}

/**
 * Whether the password appears in a known breach, from the Pwned Passwords
 * range API: only the first 5 characters of its SHA-1 leave this server, and
 * the match is made here (k-anonymity), so the password itself is never sent.
 *
 * Needed because an invited account is created with Supabase's ADMIN API,
 * which may skip the project's own leaked-password check.
 *
 * Fails OPEN (false) after 2 seconds or on any error: a third-party outage
 * must not stop someone creating their account, and the rules above still
 * apply.
 */
export async function isBreachedPassword(pw: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const sha1 = createHash("sha1").update(pw).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetcher(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

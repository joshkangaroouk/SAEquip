/**
 * Password rules, mirrored from `backend/src/scripts/createStaffUser.ts`.
 *
 * ⚠️ This is a UX aid, NOT the enforcement point. Anything typed in a browser
 * can be bypassed, so the real floor is Supabase's own minimum length and
 * leaked-password protection (Dashboard → Authentication → Policies). Keep the
 * two in step: a rule shown here but not configured there is theatre.
 */
export interface PasswordVerdict {
  ok: boolean;
  problems: string[];
}

export function assessPassword(pw: string): PasswordVerdict {
  const problems: string[] = [];
  if (pw.length < 12) problems.push("At least 12 characters (16 or more is better)");
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) problems.push("Mix upper and lower case");
  if (!/\d/.test(pw)) problems.push("Include a digit");
  if (!/[^A-Za-z0-9]/.test(pw)) problems.push("Include a symbol");
  // A dictionary word with a digit or two appended is the most common human
  // password shape and the first thing a credential-stuffing list tries.
  if (/^[A-Za-z]+\d{0,3}[!?.]?$/.test(pw)) {
    problems.push("Avoid a word with digits on the end — that pattern is guessed first");
  }
  return { ok: problems.length === 0, problems };
}

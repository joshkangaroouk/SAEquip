/**
 * Initials for an avatar, from the email's local part (02a Q19): a separator
 * gives two initials (josh.wright -> JW), otherwise the first two letters
 * (josh -> JO). Falls back to the brand mark when there's no email.
 */
export function initialsFrom(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0];
  if (!local) return "SA";
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

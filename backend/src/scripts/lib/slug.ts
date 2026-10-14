/**
 * A category's clean slug: "Confined-Space Ventilation" → "confined-space-ventilation".
 * "&" is dropped, like the existing slugs. Pure, so scripts can share it without
 * importing another script (which would run that script's main()).
 */
export function slugFor(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

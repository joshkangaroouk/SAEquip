/**
 * The languages the widgets can speak, and how a raw language tag maps onto one.
 *
 * Import-free on purpose: the public routes use it, and they are in the
 * serverless function's import graph (see "Deploy safety checks" in CLAUDE.md).
 *
 * The widget (public-widget/widget.js) holds the same list and the same
 * normalisation rules — it cannot import this file, so `widget:test` reads
 * both and fails if they drift.
 */
export const LOCALES = ["en", "ar", "zh", "fr", "de", "pt-br", "es"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * A raw tag ("en-GB", "zh-Hans", "pt", "PT-BR") → one of LOCALES, or null.
 *
 * Duda's default language here is `en-gb`, which is plain English to us. Only
 * Simplified Chinese is supported: `zh-tw` / `zh-hant` are deliberately NOT
 * folded into `zh`, which would show Traditional readers Simplified text.
 */
export function normaliseLocale(raw: unknown): Locale | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/_/g, "-");
  if (!t) return null;
  if (t === "zh-tw" || t === "zh-hk" || t === "zh-mo" || t.startsWith("zh-hant")) return null;
  const base = t.split("-")[0];
  if (base === "en") return "en";
  if (base === "zh") return "zh";
  if (base === "pt") return "pt-br";
  return (LOCALES as readonly string[]).includes(base) ? (base as Locale) : null;
}

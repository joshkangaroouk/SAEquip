import { createHash } from "node:crypto";

/**
 * How English text becomes a translation key, and which text needs none.
 *
 * Import-free apart from node:crypto, so the public routes can use it.
 */

/** NFC, trimmed, runs of whitespace collapsed — the form a key is made from. */
export function normaliseSource(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** The translation key for an English string. */
export function sourceHash(s: string): string {
  return createHash("sha256").update(normaliseSource(s)).digest("hex");
}

/**
 * Short words that ARE worth translating — without this list, the "three
 * letters or fewer is a code" rule below would leave "Yes" in English.
 */
const SHORT_WORDS = new Set([
  "yes", "no", "on", "off", "red", "low", "all", "any", "per", "dry", "wet", "hot", "max", "min",
  // Joining words, so "-20°C to +50°C" is translated rather than left half English.
  "to", "and", "or", "up", "at", "of", "in", "for", "via",
]);

/**
 * True when a string carries no words to translate and is shown as it is:
 * protection codes ("Ex db eb ib mb pb IIB T4 Gb"), measurements ("2560m3/hr"),
 * ratings ("IP65"), certification marks. Such strings get no translation row at all and simply
 * fall back to English, which is what they are in every language.
 *
 * The rule: drop every token that contains a digit, is ALL CAPS, or is three
 * letters or fewer (codes, units, marks — unless it is a known short word);
 * if no word of four or more letters is left, there is nothing to translate.
 */
export function isPassThrough(s: string): boolean {
  const tokens = normaliseSource(s).split(/[\s/,;:()\[\]–—-]+/).filter(Boolean);
  if (!tokens.length) return true;
  return !tokens.some((t) => {
    if (/\d/.test(t)) return false;
    const letters = t.replace(/[^\p{L}]/gu, "");
    if (!letters) return false;
    if (SHORT_WORDS.has(letters.toLowerCase())) return true;
    // ALL-CAPS is a mark or code (ATEX, UKEX, INMETRO), not a word. Spec
    // labels were title-cased at import, so real words are not caught here.
    if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return false;
    return letters.length >= 4;
  });
}

/** Arabic-Indic and full-width digits → ASCII, so "٣" and "3" compare equal. */
export function asciiDigits(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

import type { TranslationKind } from "@prisma/client";
import { asciiDigits, normaliseSource } from "./normalise.js";

/**
 * Whether a machine translation is safe to show, whoever produced it.
 *
 * ⚠️ This is hazardous-area equipment: "Zone 1" becoming "Zone 2", or a
 * temperature or rating changing, is the failure that matters. Every NUMBER,
 * certification mark and acronym in the English must survive exactly. A
 * translation that fails is rejected and the English is shown instead —
 * English is always safe; a wrong figure never is.
 *
 * Import-free, shared by the import script, the dashboard's save, and tests.
 */

/** Marks and names that are never translated, matched as whole words. */
const GLOSSARY = [
  "ATEX", "IECEx", "UKEX", "UKCA", "INMETRO", "SAEquip",
  "Cyclone", "Endure", "Flexiheat", "Lumin", "Powernet",
];

export type Verdict = { ok: true } | { ok: false; reason: string };

function digitRuns(s: string): string[] {
  return asciiDigits(s).match(/\d+(?:[.,]\d+)?/g) ?? [];
}

/** All-caps tokens of three or more characters (LED, PVC, IP65, SAPH18440). */
function acronyms(s: string): string[] {
  return (s.match(/\b[A-Z][A-Z0-9]{2,}\b/g) ?? []).filter((t) => /[A-Z].*[A-Z]/.test(t));
}

function tagSequence(html: string): string {
  return (html.match(/<\/?[a-z][a-z0-9]*/gi) ?? []).map((t) => t.toLowerCase()).join(" ");
}

function hrefs(html: string): string {
  return (html.match(/href\s*=\s*"[^"]*"/gi) ?? []).join(" ");
}

export function validateTranslation(kind: TranslationKind, source: string, translated: string): Verdict {
  const src = normaliseSource(source);
  const out = translated.normalize("NFC").trim();
  if (!out) return { ok: false, reason: "empty" };

  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(out)) return { ok: false, reason: "control characters" };

  // Chinese is far shorter than English; German longer. Wide bounds, which
  // still catch a translation that dropped a sentence or doubled one.
  const ratio = out.length / Math.max(src.length, 1);
  if (src.length >= 12 && (ratio < 0.15 || ratio > 4)) return { ok: false, reason: `length ratio ${ratio.toFixed(2)}` };

  const outDigits = new Set(digitRuns(out));
  for (const d of new Set(digitRuns(src))) {
    if (!outDigits.has(d)) return { ok: false, reason: `number "${d}" missing` };
  }

  for (const term of GLOSSARY) {
    const re = new RegExp(`\\b${term}\\b`);
    if (re.test(src) && !re.test(out)) return { ok: false, reason: `"${term}" missing` };
  }
  for (const a of new Set(acronyms(src))) {
    if (!out.includes(a)) return { ok: false, reason: `"${a}" missing` };
  }

  if (kind === "DESCRIPTION") {
    // Same tags in the same order, and the same links: a translation may
    // change words, never structure or where a link goes. The widget's
    // safeProse() is still the boundary for anything that gets past this.
    if (tagSequence(out) !== tagSequence(src)) return { ok: false, reason: "HTML tags changed" };
    if (hrefs(out) !== hrefs(src)) return { ok: false, reason: "links changed" };
  } else {
    if (/[<>]/.test(out) && !/[<>]/.test(src)) return { ok: false, reason: "markup added" };
    if (/https?:\/\//i.test(out) && !/https?:\/\//i.test(src)) return { ok: false, reason: "URL added" };
    if (/\n/.test(out) && !/\n/.test(source)) return { ok: false, reason: "line break added" };
  }
  return { ok: true };
}

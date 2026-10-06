import type { TranslationKind, TranslationOrigin } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { isPassThrough, normaliseSource, sourceHash } from "./normalise.js";
import { validateTranslation } from "./validate.js";
import type { Locale } from "./locales.js";

export interface IncomingTranslation {
  kind: TranslationKind;
  sourceText: string;
  text: string;
}

export interface SaveResult {
  sourceHash: string;
  status: "saved" | "kept-staff" | "rejected" | "pass-through" | "unchanged";
  reason?: string;
}

/**
 * Save translations — the ONE writer, used by the mass import, the dashboard's
 * translate-on-save and the Translations page, so the rules cannot drift:
 *
 * - Every translation is validated (services/i18n/validate.ts) first.
 * - ⚠️ A STAFF translation is never replaced by a machine one. A machine
 *   result for text staff have corrected is reported as "kept-staff".
 * - A machine translation that fails validation is stored with `text: null`
 *   and the reason, so it shows as rejected and the English is served. A
 *   STAFF one that fails is refused outright and nothing is stored: a person
 *   can fix their own input.
 * - Pass-through text (codes, measurements) is never stored at all.
 */
export async function saveTranslations(
  locale: Locale,
  items: IncomingTranslation[],
  opts: { origin: TranslationOrigin; engine?: string; updatedBy?: string },
): Promise<SaveResult[]> {
  const results: SaveResult[] = [];
  for (const item of items) {
    const sourceText = normaliseSource(item.sourceText);
    const hash = sourceHash(sourceText);
    if (!sourceText || isPassThrough(sourceText)) {
      results.push({ sourceHash: hash, status: "pass-through" });
      continue;
    }
    const verdict = validateTranslation(item.kind, sourceText, item.text);
    const where = { locale_kind_sourceHash: { locale, kind: item.kind, sourceHash: hash } };
    const existing = await prisma.translation.findUnique({ where });

    if (opts.origin === "MT" && existing?.origin === "STAFF") {
      results.push({ sourceHash: hash, status: "kept-staff" });
      continue;
    }
    if (!verdict.ok) {
      if (opts.origin === "STAFF") {
        results.push({ sourceHash: hash, status: "rejected", reason: verdict.reason });
        continue;
      }
      await prisma.translation.upsert({
        where,
        create: { locale, kind: item.kind, sourceHash: hash, sourceText, text: null, origin: "MT", engine: opts.engine, lastError: verdict.reason },
        update: { text: null, engine: opts.engine, lastError: verdict.reason },
      });
      results.push({ sourceHash: hash, status: "rejected", reason: verdict.reason });
      continue;
    }
    const text = item.text.normalize("NFC").trim();
    if (existing && existing.text === text && existing.origin === opts.origin) {
      results.push({ sourceHash: hash, status: "unchanged" });
      continue;
    }
    await prisma.translation.upsert({
      where,
      create: { locale, kind: item.kind, sourceHash: hash, sourceText, text, origin: opts.origin, engine: opts.engine, updatedBy: opts.updatedBy },
      update: { text, origin: opts.origin, engine: opts.engine, updatedBy: opts.updatedBy ?? null, lastError: null },
    });
    results.push({ sourceHash: hash, status: "saved" });
  }
  return results;
}

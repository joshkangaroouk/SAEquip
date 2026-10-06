import { Router } from "express";
import { z } from "zod";
import { TranslationKind } from "@prisma/client";
import { prisma } from "../prisma.js";
import { LOCALES, normaliseLocale, type Locale } from "../services/i18n/locales.js";
import { collectSources } from "../services/i18n/sources.js";
import { saveTranslations } from "../services/i18n/store.js";
import { clearOverlayCache } from "../services/i18n/overlay.js";
import { harvestDuda, siteLanguages } from "../services/i18n/dudaHarvest.js";

/**
 * Translations admin (behind requireAuth). See "Languages" in CLAUDE.md.
 *
 * The dashboard's translate-on-save runs Chrome's on-device translator in the
 * STAFF member's browser, then sends the results here. That makes them staff
 * input like any other edit: authenticated, and validated by the same rules as
 * every other translation (services/i18n/validate.ts) before anything is kept.
 */
export const translationsRouter = Router();

const TRANSLATED = LOCALES.filter((l) => l !== "en") as Locale[];

/**
 * GET /api/translations/sources?locale=ar[&productId=<dudaId>]
 * The English that needs translating, and each string's translation state in
 * that language: what translate-on-save and the Translations page work from.
 */
translationsRouter.get("/translations/sources", async (req, res, next) => {
  const locale = normaliseLocale(req.query.locale);
  if (!locale || locale === "en") {
    res.status(400).json({ error: "bad_locale", detail: `locale must be one of ${TRANSLATED.join(", ")}` });
    return;
  }
  try {
    const productId = typeof req.query.productId === "string" && req.query.productId ? req.query.productId : undefined;
    const sources = await collectSources({ dudaProductId: productId });
    const rows = await prisma.translation.findMany({
      where: { locale, sourceHash: { in: sources.map((s) => s.sourceHash) } },
      select: { kind: true, sourceHash: true, text: true, origin: true, lastError: true, updatedAt: true },
    });
    const byKey = new Map(rows.map((r) => [`${r.kind}:${r.sourceHash}`, r]));
    res.json({
      locale,
      items: sources.map((s) => {
        const t = byKey.get(`${s.kind}:${s.sourceHash}`);
        return {
          kind: s.kind,
          sourceText: s.sourceText,
          sourceHash: s.sourceHash,
          productIds: s.productIds,
          text: t?.text ?? null,
          origin: t?.origin ?? null,
          status: !t ? "missing" : t.text === null ? "rejected" : t.origin === "STAFF" ? "staff" : "machine",
          lastError: t?.lastError ?? null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

const batchSchema = z
  .object({
    locale: z.enum(LOCALES),
    origin: z.enum(["MT", "STAFF"]),
    /** "chrome" for translate-on-save; omitted for a staff edit. */
    engine: z.string().max(40).optional(),
    items: z
      .array(
        z
          .object({
            kind: z.nativeEnum(TranslationKind),
            sourceText: z.string().min(1).max(20000),
            text: z.string().max(40000),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

/**
 * PUT /api/translations/batch — save translations through the one writer, so
 * a machine result can never replace a staff correction and nothing unsafe is
 * kept (see saveTranslations).
 */
translationsRouter.put("/translations/batch", async (req, res, next) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const { locale, origin, engine, items } = parsed.data;
  if (locale === "en") {
    res.status(400).json({ error: "bad_locale", detail: "English is the source, not a translation" });
    return;
  }
  try {
    const results = await saveTranslations(locale, items, {
      origin,
      engine: origin === "MT" ? engine ?? "chrome" : undefined,
      updatedBy: origin === "STAFF" ? req.user?.email : undefined,
    });
    clearOverlayCache(); // this instance shows the change at once; others within a minute
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/translations/duda/refresh {locale?} — re-copy Duda's translated
 * product names and category titles (the "Refresh from Duda" button). One
 * language per call keeps it inside the function's time limit.
 */
translationsRouter.post("/translations/duda/refresh", async (req, res, next) => {
  try {
    const wanted = normaliseLocale(req.body?.locale);
    const langs = (await siteLanguages()).filter((l) => !wanted || l.locale === wanted);
    if (!langs.length) {
      res.status(400).json({ error: "no_language", detail: "That language is not on the Duda site." });
      return;
    }
    const report = await harvestDuda(langs[0], { confirm: true });
    clearOverlayCache();
    res.json({ report, remaining: langs.slice(1).map((l) => l.locale) });
  } catch (err) {
    next(err);
  }
});

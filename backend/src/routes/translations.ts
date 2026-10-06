import { Router } from "express";
import { z } from "zod";
import { TranslationKind } from "@prisma/client";
import { prisma } from "../prisma.js";
import { LOCALES, normaliseLocale, type Locale } from "../services/i18n/locales.js";
import { collectSources } from "../services/i18n/sources.js";
import { saveTranslations } from "../services/i18n/store.js";
import { clearOverlayCache } from "../services/i18n/overlay.js";
import { harvestDuda, siteLanguages } from "../services/i18n/dudaHarvest.js";
import { LISTABLE } from "../services/hubProduct.js";

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
    // Names for the "used on" column — one query, keyed by the ids in `items`.
    const ids = [...new Set(sources.flatMap((s) => s.productIds))];
    const names = await prisma.hubProduct.findMany({
      where: { dudaProductId: { in: ids } },
      select: { dudaProductId: true, name: true },
    });
    res.json({
      locale,
      products: Object.fromEntries(names.map((n) => [n.dudaProductId, n.name ?? n.dudaProductId])),
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

/**
 * GET /api/translations/duda?locale=ar — the product names and category titles
 * copied from Duda's own translations, beside today's English. Read-only here:
 * they are edited in Duda (Store → Languages) and copied with "Refresh".
 * `stale` means the English has changed since the copy was taken.
 */
translationsRouter.get("/translations/duda", async (req, res, next) => {
  const locale = normaliseLocale(req.query.locale);
  if (!locale || locale === "en") {
    res.status(400).json({ error: "bad_locale", detail: `locale must be one of ${TRANSLATED.join(", ")}` });
    return;
  }
  try {
    const [rows, products, categories] = await Promise.all([
      prisma.dudaTranslation.findMany({ where: { locale } }),
      // Hidden products have no published page to copy a name from.
      prisma.hubProduct.findMany({ where: LISTABLE, select: { dudaProductId: true, name: true } }),
      prisma.categoryMirror.findMany({ select: { dudaCategoryId: true, title: true } }),
    ]);
    const english = new Map<string, string>([
      ...products.map((p) => [`PRODUCT:${p.dudaProductId}`, p.name ?? ""] as [string, string]),
      ...categories.map((c) => [`CATEGORY:${c.dudaCategoryId}`, c.title] as [string, string]),
    ]);
    const byKey = new Map(rows.map((r) => [`${r.entity}:${r.dudaId}`, r]));
    // Every product and category, translated or not, so a gap is visible.
    const items = [...english.entries()]
      .filter(([, en]) => en)
      .map(([key, en]) => {
        const [entity, dudaId] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
        const r = byKey.get(key);
        return {
          entity,
          dudaId,
          english: en,
          text: r?.text ?? null,
          stale: r ? r.sourceText !== en : false,
          fetchedAt: r?.fetchedAt ?? null,
        };
      })
      .sort((a, b) => a.entity.localeCompare(b.entity) || a.english.localeCompare(b.english));
    res.json({ locale, items });
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

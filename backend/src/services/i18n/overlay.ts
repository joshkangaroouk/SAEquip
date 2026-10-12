import type { TranslationKind } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { isPassThrough, sourceHash } from "./normalise.js";
import { normaliseLocale, type Locale } from "./locales.js";

/**
 * The translated view of public payloads.
 *
 * ⚠️ Read-only and FAIL-OPEN: anything missing, and any error at all, gives
 * the English. A translation table that cannot load must never cost a visitor
 * the product page.
 *
 * Each language's tables are held in memory for 60 seconds per serverless
 * instance (a few hundred KB each), so after warm-up the hot content endpoint
 * does no extra query. A staff edit therefore shows within about a minute,
 * plus the edge cache on the listing endpoints.
 */

export interface Tables {
  locale: Locale;
  /** `${kind}:${sourceHash}` → translated text */
  text: Map<string, string>;
  /** dudaProductId → Duda's translated product name */
  product: Map<string, string>;
  /** dudaCategoryId → Duda's translated category title */
  category: Map<string, string>;
}

const TTL_MS = 60_000;
/**
 * How long a request waits for a language's tables before answering in
 * English. ⚠️ Fail-open covered an ERROR but not a HANG: a translated product
 * request once took 57s (of the function's 60) while every other language
 * answered in under 0.2s, consistent with a stalled table load. The load
 * itself carries on and is cached for the next request; only this request
 * stops waiting.
 */
const LOAD_TIMEOUT_MS = 2_500;
const cache = new Map<Locale, { at: number; tables: Promise<Tables | null> }>();

/** `?lang=` → a translated locale, or null for English / unsupported / absent. */
export function parseLang(raw: unknown): Locale | null {
  const l = normaliseLocale(raw);
  return l && l !== "en" ? l : null;
}

async function load(locale: Locale): Promise<Tables | null> {
  try {
    const [rows, duda] = await Promise.all([
      prisma.translation.findMany({ where: { locale, text: { not: null } }, select: { kind: true, sourceHash: true, text: true } }),
      // Options and choices live here too, for the quote basket (see quoteLabels).
      prisma.dudaTranslation.findMany({
        where: { locale, entity: { in: ["PRODUCT", "CATEGORY"] } },
        select: { entity: true, dudaId: true, text: true },
      }),
    ]);
    const tables: Tables = { locale, text: new Map(), product: new Map(), category: new Map() };
    for (const r of rows) tables.text.set(`${r.kind}:${r.sourceHash}`, r.text!);
    for (const d of duda) (d.entity === "PRODUCT" ? tables.product : tables.category).set(d.dudaId, d.text);
    return tables;
  } catch (err) {
    console.warn(`[i18n] could not load ${locale} translations — serving English`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** The tables for a language, or null (serve English). Never throws. */
export async function tablesFor(locale: Locale | null): Promise<Tables | null> {
  if (!locale) return null;
  const hit = cache.get(locale);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tables;
  const tables = load(locale);
  cache.set(locale, { at: Date.now(), tables });
  // A failed load is NOT remembered: one database blip must not mean a
  // minute of English on every translated page.
  void tables.then((v) => {
    if (!v && cache.get(locale)?.tables === tables) cache.delete(locale);
  });
  return withinTimeout(tables, locale);
}

function withinTimeout(tables: Promise<Tables | null>, locale: Locale): Promise<Tables | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[i18n] ${locale} translations took over ${LOAD_TIMEOUT_MS}ms — serving English`);
      resolve(null);
    }, LOAD_TIMEOUT_MS);
  });
  return Promise.race([tables, late]).finally(() => clearTimeout(timer));
}

/**
 * The Cache-Control for a public listing. ⚠️ A TRANSLATED request answered in
 * English (tables failed or were too slow) is `no-store`: the language is in
 * the URL, so the edge would otherwise serve that English to every visitor of
 * the French page for a minute.
 */
export function overlayCacheControl(langRaw: unknown, tables: Tables | null, normal: string): string {
  return parseLang(langRaw) && !tables ? "no-store" : normal;
}

/** Hub-only text in the page's language, or the English unchanged. */
export function tr(t: Tables | null, kind: TranslationKind, english: string | null | undefined): string {
  const en = english ?? "";
  if (!t || !en || isPassThrough(en)) return en;
  return t.text.get(`${kind}:${sourceHash(en)}`) ?? en;
}

export function productName(t: Tables | null, dudaProductId: string | null | undefined, english: string): string {
  return (t && dudaProductId && t.product.get(dudaProductId)) || english;
}

export function categoryTitle(t: Tables | null, dudaCategoryId: string, english: string): string {
  return (t && t.category.get(dudaCategoryId)) || english;
}

/** Sorting in the page's language, so Arabic or Chinese names order sensibly. */
export function collator(t: Tables | null): Intl.Collator {
  try {
    return new Intl.Collator(t ? t.locale : "en", { sensitivity: "base", numeric: true });
  } catch {
    return new Intl.Collator("en", { sensitivity: "base", numeric: true });
  }
}

/** For tests and the admin page: forget the cached tables. */
export function clearOverlayCache() {
  cache.clear();
}

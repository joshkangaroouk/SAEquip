import { prisma } from "../../prisma.js";
import { env } from "../../env.js";
import { duda } from "../duda.js";
import { LISTABLE } from "../hubProduct.js";
import { normaliseLocale, type Locale } from "./locales.js";

/**
 * Copy Duda's OWN translations of product names and category titles into the
 * Hub, so our cards and listings say exactly what Duda's product pages say.
 *
 * ⚠️ Duda's REST API is English-only — every language parameter is ignored
 * (probed 2026-10-06) — so the source is the PUBLISHED page: schema.org
 * JSON-LD carries the translated product name, and the BreadcrumbList carries
 * translated category titles with ids like "/ar/category/<slug>". Category
 * pages not reached through any breadcrumb fall back to their <title>.
 *
 * Import-free parsing (a regex and JSON.parse): jsdom and sanitize-html both
 * break the serverless function at load.
 *
 * ⚠️ A failed fetch or parse writes NOTHING for that item, so a bad run can
 * never replace a good translation with an empty or wrong one.
 */

const MAX_LEN = 300;

/** Case and spacing do not make a translation. */
const sameText = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** Every JSON-LD object on a page, @graph flattened; unparsable blocks skipped. */
export function parseJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const v = JSON.parse(m[1]);
      for (const item of Array.isArray(v) ? v : [v]) {
        if (item && typeof item === "object") {
          out.push(item);
          const graph = (item as { "@graph"?: unknown })["@graph"];
          if (Array.isArray(graph)) for (const g of graph) if (g && typeof g === "object") out.push(g);
        }
      }
    } catch {
      /* one broken block must not hide the others */
    }
  }
  return out;
}

/** A harvested value is plain text, non-empty and short — or it is not used. */
export function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return t && t.length <= MAX_LEN && !/[<>]/.test(t) ? t : null;
}

export function productNameFromHtml(html: string): string | null {
  const p = parseJsonLd(html).find((o) => o["@type"] === "Product");
  return p ? cleanText(p.name) : null;
}

/** Category slug → translated title, from a page's breadcrumbs. */
export function categoriesFromHtml(html: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const o of parseJsonLd(html)) {
    if (o["@type"] !== "BreadcrumbList" || !Array.isArray(o.itemListElement)) continue;
    for (const el of o.itemListElement as Array<{ item?: { name?: unknown; id?: unknown; "@id"?: unknown } }>) {
      const id = String(el?.item?.id ?? el?.item?.["@id"] ?? "");
      const slug = /\/category\/([^/?#]+)/.exec(id)?.[1];
      const name = cleanText(el?.item?.name);
      if (slug && name && !found.has(slug)) found.set(slug, name);
    }
  }
  return found;
}

/** A category page's <title>, without any " | Site" suffix. */
/**
 * A category page's OWN name: the last entry of its breadcrumbs, which is the
 * page itself. ⚠️ Preferred over the breadcrumbs on PRODUCT pages: measured on
 * the French site (2026-10-06), a product page's breadcrumbs still said
 * "Products" and "Climate Control and Heating" in English while the category
 * pages themselves said "Produits".
 */
export function categoryNameFromHtml(html: string): string | null {
  for (const o of parseJsonLd(html)) {
    if (o["@type"] !== "BreadcrumbList" || !Array.isArray(o.itemListElement)) continue;
    const items = [...(o.itemListElement as Array<{ position?: number; item?: { name?: unknown } }>)].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    const name = cleanText(items[items.length - 1]?.item?.name);
    if (name && items.length > 1) return name;
  }
  return titleFromHtml(html);
}

export function titleFromHtml(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? cleanText(m[1].split("|")[0]) : null;
}

async function fetchPage(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "SAEquip-Hub/translation-sync" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((res) => setTimeout(res, 800));
    }
  }
}

/** Run `fn` over `items`, `n` at a time. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

/** The site's translated languages: our locale and Duda's code (its URL prefix). */
export async function siteLanguages(): Promise<{ locale: Locale; code: string }[]> {
  const { additional } = await duda.getSiteLanguages();
  const out: { locale: Locale; code: string }[] = [];
  for (const code of additional) {
    const locale = normaliseLocale(code);
    if (locale && locale !== "en") out.push({ locale, code });
  }
  return out;
}

export interface HarvestReport {
  locale: Locale;
  code: string;
  /** found: a name was read; translated: it differs from the English. */
  products: { total: number; found: number; translated: number; failed: string[] };
  categories: { total: number; found: number; translated: number; failed: string[] };
  samples: string[];
  written: number;
}

/**
 * Harvest one language. Dry run unless `confirm`. `only` limits it to one
 * product slug (and the categories its breadcrumbs name).
 */
export async function harvestDuda(
  lang: { locale: Locale; code: string },
  opts: { confirm: boolean; only?: string; concurrency?: number },
): Promise<HarvestReport> {
  const origin = env.PUBLIC_SITE_ORIGIN.replace(/\/$/, "");
  const products = await prisma.hubProduct.findMany({
    where: { slug: opts.only ? opts.only : { not: null }, ...LISTABLE },
    select: { dudaProductId: true, slug: true, name: true },
  });
  const cats = await prisma.categoryMirror.findMany({ select: { dudaCategoryId: true, slug: true, title: true } });
  const catBySlug = new Map(cats.filter((c) => c.slug).map((c) => [c.slug!.toLowerCase(), c]));

  const report: HarvestReport = {
    locale: lang.locale,
    code: lang.code,
    products: { total: products.length, found: 0, translated: 0, failed: [] },
    categories: { total: opts.only ? 0 : cats.length, found: 0, translated: 0, failed: [] },
    samples: [],
    written: 0,
  };
  const productNames = new Map<string, { text: string; en: string }>();
  const catNames = new Map<string, { text: string; en: string }>();

  // Category pages first: a category's own page is the authority for its
  // name (see categoryNameFromHtml). Product breadcrumbs only fill a gap.
  if (!opts.only) {
    await pool(cats.filter((c) => c.slug), opts.concurrency ?? 6, async (c) => {
      try {
        const name = categoryNameFromHtml(await fetchPage(`${origin}/${lang.code}/category/${encodeURIComponent(c.slug!)}`));
        if (name) catNames.set(c.dudaCategoryId, { text: name, en: c.title });
      } catch {
        /* a product page's breadcrumbs may still supply it, below */
      }
    });
  }

  await pool(products, opts.concurrency ?? 6, async (p) => {
    try {
      const html = await fetchPage(`${origin}/${lang.code}/product/${encodeURIComponent(p.slug!)}`);
      const name = productNameFromHtml(html);
      if (name) productNames.set(p.dudaProductId, { text: name, en: p.name ?? "" });
      else report.products.failed.push(`${p.slug}: no Product name in the page`);
      for (const [slug, title] of categoriesFromHtml(html)) {
        const c = catBySlug.get(slug.toLowerCase());
        if (c && !catNames.has(c.dudaCategoryId)) catNames.set(c.dudaCategoryId, { text: title, en: c.title });
      }
    } catch (e) {
      report.products.failed.push(`${p.slug}: ${e instanceof Error ? e.message : e}`);
    }
  });
  if (!opts.only) {
    for (const c of cats) if (c.slug && !catNames.has(c.dudaCategoryId)) report.categories.failed.push(`${c.slug}: no name on its page or in any breadcrumb`);
  }

  // ⚠️ A name Duda has not translated comes back as the ENGLISH (measured: a
  // freshly added Chinese site published all 96 names and 23 titles in
  // English). Storing that as a "translation" made the Names tab report a
  // language as done when nothing had been translated, so it is not stored —
  // and a row stored earlier is removed. The page shows the English either way.
  const differs = (v: { text: string; en: string }) => sameText(v.text) !== sameText(v.en);
  report.products.found = productNames.size;
  report.categories.found = catNames.size;
  report.products.translated = [...productNames.values()].filter(differs).length;
  report.categories.translated = [...catNames.values()].filter(differs).length;
  for (const [, v] of [...productNames].filter(([, v]) => differs(v)).slice(0, 3)) report.samples.push(`${v.en} → ${v.text}`);
  for (const [, v] of [...catNames].filter(([, v]) => differs(v)).slice(0, 2)) report.samples.push(`${v.en} → ${v.text}`);

  if (opts.confirm) {
    const rows = [
      ...[...productNames].map(([dudaId, v]) => ({ entity: "PRODUCT", dudaId, ...v })),
      ...[...catNames].map(([dudaId, v]) => ({ entity: "CATEGORY", dudaId, ...v })),
    ];
    for (const r of rows) {
      const where = { locale_entity_dudaId: { locale: lang.locale, entity: r.entity, dudaId: r.dudaId } };
      if (!differs(r)) {
        await prisma.dudaTranslation.deleteMany({ where: where.locale_entity_dudaId });
        continue;
      }
      await prisma.dudaTranslation.upsert({
        where,
        create: { locale: lang.locale, entity: r.entity, dudaId: r.dudaId, text: r.text, sourceText: r.en },
        update: { text: r.text, sourceText: r.en },
      });
      report.written++;
    }
  }
  return report;
}

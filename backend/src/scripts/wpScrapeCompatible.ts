import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";

/**
 * Scrape the "Compatible Products & Accessories" slider from the live
 * WordPress site, once, before it is decommissioned.
 *
 *   npm run wp:scrape-compatible --workspace=backend
 *   npm run wp:scrape-compatible --workspace=backend -- --only ex-heater
 *
 * ⚠️ WHY A SCRAPER AND NOT THE CSV. The export has a
 * `Meta: compatible_products` column and it is EMPTY for all 584 rows. The
 * `Meta: _compatible_products` mirror holds only ACF's field key
 * (`field_62aa62a4e4a17`) for 193 rows, which says the field exists and
 * nothing about its value: ACF relationship fields store serialised post-ID
 * arrays and this exporter dropped them. So the live pages are the ONLY place
 * this data exists.
 *
 * ⚠️ NOT WooCommerce `Cross-sells`, which is populated (29 products) and looks
 * plausible but is a DIFFERENT, smaller set — EX Heater cross-sells 5 items
 * while its live slider shows 6, and EX Air Mover cross-sells 5 against 8
 * live. Importing cross-sells would have quietly produced a
 * wrong-but-believable result.
 *
 * Writes `migration/compatible-products.json` keyed by Duda slug, so the
 * import step is a pure read of a reviewable file rather than a second scrape.
 */

const MIGRATION_DIR = path.resolve(process.cwd(), "..", "migration");
const OUT = path.join(MIGRATION_DIR, "compatible-products.json");
const WP = "https://saequip.com";
const SITEMAP = `${WP}/product-sitemap.xml`;
const DELAY_MS = 350; // courtesy pacing against someone else's live server

const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Uppercase alphanumerics only — survives case, punctuation and entity drift. */
const norm = (s: string) => s.toUpperCase().replace(/&AMP;/g, "&").replace(/[^A-Z0-9]/g, "");

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "SAEquip-Hub-migration/1.0 (one-off content migration)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * The compatible-products slider only.
 *
 * Bounded to the productSwiper's own swiper-wrapper. An earlier attempt
 * window-scanned a fixed number of characters after the heading and silently
 * absorbed products from the NEXT carousel — it reported 6 items for a
 * product with 5 and looked entirely reasonable.
 */
function extractSlider(doc: string): { slug: string; title: string }[] | null {
  const i = doc.indexOf('class="swiper productSwiper"');
  if (i < 0) return null;
  const w = doc.indexOf('class="swiper-wrapper"', i);
  if (w < 0) return [];
  const ends = [doc.indexOf("swiper-button", w), doc.indexOf('class="section-', w + 400), doc.indexOf("</section>", w)]
    .filter((x) => x > 0);
  const seg = doc.slice(w, ends.length ? Math.min(...ends) : w + 30_000);

  const out: { slug: string; title: string }[] = [];
  for (const slide of seg.split('<div class="swiper-slide"').slice(1)) {
    const href = slide.match(/href="https:\/\/saequip\.com\/product\/([^"/?#]+)/);
    if (!href) continue;
    const h = slide.match(/<(h[2-5])[^>]*>([\s\S]*?)<\/\1>/);
    const title = h ? h[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    if (!out.some((o) => o.slug === href[1])) out.push({ slug: href[1], title });
  }
  return out;
}

async function main() {
  mkdirSync(MIGRATION_DIR, { recursive: true });

  // Only products with a slug: a slug is how both the WP URL and the Duda
  // page are addressed, so a null one cannot participate either way.
  const all = await prisma.hubProduct.findMany({ select: { name: true, slug: true } });
  const hub = all.filter((h): h is { name: string; slug: string } => !!h.slug);
  if (hub.length !== all.length) {
    console.log(`  ⚠ ignoring ${all.length - hub.length} product(s) with no slug`);
  }
  const byName = new Map(hub.map((h) => [norm(h.name), h.slug]));
  const bySlug = new Map(hub.map((h) => [h.slug, h]));
  console.log(`\n${hub.length} Hub products`);

  // WP slug -> Duda slug. Built from the sitemap: 13 of the 96 differ, because
  // Duda re-slugged from the product NAME while WordPress kept historical
  // slugs like "ex-splitter-box" and "-2" suffixes from re-created posts.
  const sm = (await get(SITEMAP)) ?? "";
  const wpSlugs = [...sm.matchAll(/<loc>[^<]*\/product\/([^<\/]+)\/?<\/loc>/g)].map((m) => m[1]);
  console.log(`${wpSlugs.length} WP product slugs in the sitemap`);

  /*
   * WP slugs whose page title can no longer match a Duda product name.
   *
   * The import renamed `COMPACT FILTRATION UNIT` to `COMPACT FILTRATION UNIT
   * (SAECFU)` to get past Duda's case-insensitive duplicate-TITLE rule (it
   * collided with `Compact Filtration Unit`, SACFU). So its WP title now
   * normalises to the OTHER product's name, and without this the two collapse
   * onto one slug and the SAECFU page is never fetched.
   */
  const WP_SLUG_OVERRIDES: Record<string, string> = {
    "compact-filtration-unit-2": "compact-filtration-unit-saecfu",
  };

  const wpToDuda = new Map<string, string>();
  const unmapped: string[] = [];
  for (const ws of wpSlugs) {
    const override = WP_SLUG_OVERRIDES[ws];
    if (override) {
      wpToDuda.set(ws, override);
      continue;
    }
    if (bySlug.has(ws)) {
      wpToDuda.set(ws, ws);
      continue;
    }
    const doc = await get(`${WP}/product/${ws}/`);
    const t = doc?.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const title = t.split(" - EX Electrical")[0].split(" &#8211;")[0].trim();
    const hit = byName.get(norm(title));
    if (hit) wpToDuda.set(ws, hit);
    else unmapped.push(`${ws} ("${title}")`);
    await sleep(DELAY_MS);
  }
  console.log(`mapped ${wpToDuda.size}/${wpSlugs.length} WP slugs to Duda slugs`);
  if (unmapped.length) {
    console.log("  ⚠ could not map:");
    for (const u of unmapped) console.log(`     ${u}`);
  }

  const dudaToWp = new Map<string, string>();
  for (const [ws, ds] of wpToDuda) dudaToWp.set(ds, ws);

  const only = arg("only");
  const targets = hub.filter((h) => !only || h.slug === only);

  const result: Record<string, { name: string; items: { slug: string; title: string }[] }> = {};
  let withSection = 0, noSection = 0, totalItems = 0, missingPage = 0;
  const unresolvedItems: string[] = [];

  console.log(`\nScraping ${targets.length} product page(s)…\n`);
  for (const p of targets) {
    const wpSlug = dudaToWp.get(p.slug) ?? p.slug;
    const doc = await get(`${WP}/product/${wpSlug}/`);
    if (!doc) {
      missingPage++;
      console.log(`  ✗ ${p.slug.padEnd(44)} page not reachable (${wpSlug})`);
      await sleep(DELAY_MS);
      continue;
    }
    const items = extractSlider(doc);
    if (items === null) {
      noSection++;
      await sleep(DELAY_MS);
      continue;
    }

    // Map each slide back onto a Duda slug; anything that does not resolve is
    // a product that is not in the Duda catalogue (several were private in
    // WordPress) and is reported rather than dropped silently.
    const resolved: { slug: string; title: string }[] = [];
    for (const it of items) {
      const duda = wpToDuda.get(it.slug) ?? (bySlug.has(it.slug) ? it.slug : null);
      if (duda) resolved.push({ slug: duda, title: it.title });
      else unresolvedItems.push(`${p.slug} → ${it.slug} ("${it.title}")`);
    }

    if (resolved.length) {
      withSection++;
      totalItems += resolved.length;
      result[p.slug] = { name: p.name, items: resolved };
      console.log(`  ✓ ${p.slug.padEnd(44)} ${resolved.length} item(s)`);
    } else {
      noSection++;
    }
    await sleep(DELAY_MS);
  }

  /*
   * ⚠️ Never write the aggregate file during a --only run. It writes the whole
   * map, so a scoped run would replace 286 scraped links with the one or two
   * it looked at — and `--only nothing` (a typo) truncated it to `{}` exactly
   * once, which is why this guard exists.
   */
  if (only) {
    console.log(`\n  --only run: ${OUT} left untouched\n`);
  } else {
    writeFileSync(OUT, JSON.stringify(result, null, 1));
  }
  console.log(`\n=== SCRAPE ===`);
  console.log(`  products with a slider : ${withSection}`);
  console.log(`  products with none     : ${noSection}`);
  console.log(`  pages not reachable    : ${missingPage}`);
  console.log(`  total links            : ${totalItems}`);
  if (unresolvedItems.length) {
    console.log(`\n  ⚠ ${unresolvedItems.length} slide(s) point at a product NOT in the Duda catalogue:`);
    for (const u of unresolvedItems.slice(0, 20)) console.log(`     ${u}`);
    if (unresolvedItems.length > 20) console.log(`     … and ${unresolvedItems.length - 20} more`);
  }
  console.log(`\n  written to ${OUT}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

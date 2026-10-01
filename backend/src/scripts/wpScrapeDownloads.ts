import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { acfRepeater, parsePublishedProducts } from "../services/wooImport.js";

/**
 * Scrape every product's downloads from the live WordPress site, once, before
 * it is decommissioned.
 *
 *   npm run wp:scrape-downloads --workspace=backend
 *   npm run wp:scrape-downloads --workspace=backend -- --only 7481,8311
 *
 * Writes `migration/downloads.json`, which `downloads:import` then reads — the
 * same scrape-then-import split as compatible products, so the import is a
 * pure read of a reviewable file and does not depend on a third-party site
 * being up at the moment it runs.
 *
 * ⚠️ WHY A SCRAPER AND NOT THE CSV. `Meta: downloads_<n>_download_file` holds
 * WordPress ATTACHMENT IDs (`13877`), with no URL, title or type. The six
 * named fields (`download_datasheet`, `_user_manual`, `_brochure`,
 * `_iecex_cert`, `_ex_cert`, `_inmetro`) are empty for every product — only
 * their ACF field keys survive. The live page is the one place that pairs a
 * file with the label a visitor actually saw.
 *
 * ⚠️ WHY NOT THE REST API ALONE. `/wp-json/wp/v2/media/<id>` resolves 120 of
 * the 126 attachments; the other 6 return 401 (their metadata is hidden from
 * anonymous requests) even though the files themselves download fine. Its
 * titles are raw filenames, not what visitors saw. So REST is a CROSS-CHECK
 * here: every attachment it can resolve must appear on the product's page.
 *
 * Read-only to the Hub and to Duda.
 */

const MIGRATION_DIR = path.resolve(process.cwd(), "..", "migration");
const CSV = path.join(MIGRATION_DIR, "wc-export-2026-09-07.csv");
const OUT = path.join(MIGRATION_DIR, "downloads.json");
const WP = "https://saequip.com";
const UA = { "User-Agent": "SAEquip-Hub-migration/1.0 (one-off content migration)" };
/** Courtesy pacing against someone else's live server. */
const DELAY_MS = 350;
const MAX_ATTEMPTS = 4;
/** The file bucket's ceiling (storage.ts MAX_BYTES.file). */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * The visitor-facing label → the title stored on the Download.
 *
 * ⚠️ A CLOSED set, surveyed across all 59 product pages (2026-10-01). An
 * unknown label is a hard failure rather than a guess: these name compliance
 * documents on hazardous-area equipment, and filing one under the wrong mark
 * is the worst thing to get quietly wrong. IECEx is the scheme's own casing.
 */
const LABELS: Record<string, string> = {
  DATASHEET: "Datasheet",
  "USER MANUAL": "User Manual",
  "ATEX CERTIFICATE": "ATEX Certificate",
  "IECEX CERTIFICATE": "IECEx Certificate",
  "UKEX CERTIFICATE": "UKEX Certificate",
  "INMETRO CERTIFICATE": "INMETRO Certificate",
  CERTIFICATE: "Certificate",
};

export interface ScrapedDownload {
  /** The label exactly as the page showed it. */
  label: string;
  /** What the Hub stores, from LABELS. */
  title: string;
  url: string;
  /** Null for the 6 attachments the REST API will not describe. */
  attachmentId: string | null;
  sizeBytes: number;
}

const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Same file, whichever way WordPress spelled the scheme or the encoding. */
const normUrl = (u: string) => decodeURI(u.trim()).replace(/^http:\/\//, "https://");

/**
 * Fetch with bounded retry and backoff.
 *
 * ⚠️ A failure THROWS. The read-only survey that preceded this script had one
 * page fetch fail transiently and come back empty, which — recorded as data —
 * would have said "this product has no downloads" and silently dropped five
 * files. An absence must never be inferred from an error.
 */
async function fetchWithRetry(url: string, init: RequestInit = {}): Promise<Response> {
  let last = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: UA, signal: AbortSignal.timeout(30_000), ...init });
      // 401/404 are answers, not transient faults — return them for the caller to judge.
      if (res.ok || res.status === 401 || res.status === 404) return res;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(1_000 * attempt);
  }
  throw new Error(`${url} failed after ${MAX_ATTEMPTS} attempts (${last})`);
}

/**
 * Every download on one product page, in page order.
 *
 * ⚠️ BOUNDED to each item's own markup. A download is an
 * `<li class="col-lg-6">` inside `woocommerce-product-details__downloads`,
 * holding the label button and its own Contact Form 7 modal; each item is cut
 * at its first `</form>`. Splitting on the `<li>` alone lets the LAST item run
 * on into the compatible-products carousel 26KB later — the same failure that
 * once had the compatible scraper absorbing the next carousel's cards.
 *
 * ⚠️ Anchored on the INPUT's value. `name="your-download"` also matches the
 * CF7 wrapper's `data-name="your-download"`, so it appears twice per download.
 */
function extractDownloads(doc: string): { label: string; url: string }[] {
  const marker = 'class="woocommerce-product-details__downloads"';
  const count = doc.split(marker).length - 1;
  const inputs = (doc.match(/<input[^>]*name="your-download"[^>]*value="[^"]+"/g) ?? []).length;
  if (count === 0) {
    if (inputs) throw new Error(`${inputs} download input(s) but no downloads section`);
    return [];
  }
  if (count > 1) throw new Error(`${count} downloads sections on one page`);

  const items = doc.slice(doc.indexOf(marker)).split('<li class="col-lg-6"').slice(1);
  const out: { label: string; url: string }[] = [];
  for (const raw of items) {
    const end = raw.indexOf("</form>");
    if (end < 0) throw new Error("a download item with no form");
    const item = raw.slice(0, end);
    const labels = [...item.matchAll(/<a[^>]*class="article-preview__btn"[^>]*>([\s\S]*?)<\/a>/g)];
    const urls = [...item.matchAll(/<input[^>]*name="your-download"[^>]*value="([^"]+)"/g)];
    if (labels.length !== 1 || urls.length !== 1) {
      throw new Error(`an item with ${labels.length} label(s) and ${urls.length} file(s)`);
    }
    const label = labels[0][1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    out.push({ label, url: urls[0][1] });
  }
  // Every input on the page must be one we attributed to an item, or some
  // download sits outside the section and would go missing.
  if (out.length !== inputs) throw new Error(`${out.length} item(s) parsed but ${inputs} download input(s) on the page`);
  return out;
}

async function main() {
  const only = arg("only")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const products = parsePublishedProducts(readFileSync(CSV, "utf8"))
    .map((p) => ({ p, ids: acfRepeater(p.raw, "downloads", "download_file") }))
    .filter(({ p, ids }) => ids.length && (!only || only.includes(p.wpId)));

  console.log(`\nScraping downloads for ${products.length} product(s)${only ? " (--only — the aggregate file is NOT written)" : ""}\n`);

  const errors: string[] = [];
  const result: Record<string, { name: string; items: ScrapedDownload[] }> = {};
  const mediaCache = new Map<string, string | null>();
  const sizeCache = new Map<string, number>();

  for (const { p, ids } of products) {
    const tag = `wp#${p.wpId} ${p.name}`;
    try {
      const linkRes = await fetchWithRetry(`${WP}/wp-json/wp/v2/product/${p.wpId}?_fields=link`);
      if (!linkRes.ok) throw new Error(`product ${p.wpId} → HTTP ${linkRes.status}`);
      // By wpId, never by slug or title — 13 WordPress slugs differ from Duda's.
      const link = ((await linkRes.json()) as { link?: string }).link;
      if (!link) throw new Error("the REST API returned no page link");

      const pageRes = await fetchWithRetry(link);
      if (!pageRes.ok) throw new Error(`page → HTTP ${pageRes.status}`);
      const found = extractDownloads(await pageRes.text());

      if (found.length !== ids.length) {
        throw new Error(`the CSV lists ${ids.length} download(s) but the page shows ${found.length}`);
      }

      // Cross-check: every attachment the REST API CAN resolve must be on the page.
      const pageUrls = new Map(found.map((f) => [normUrl(f.url), f]));
      const attachmentOf = new Map<string, string>();
      for (const id of ids) {
        if (!mediaCache.has(id)) {
          const r = await fetchWithRetry(`${WP}/wp-json/wp/v2/media/${id}?_fields=source_url`);
          mediaCache.set(id, r.ok ? normUrl(((await r.json()) as { source_url: string }).source_url) : null);
        }
        const src = mediaCache.get(id);
        if (src == null) continue; // one of the 401s — the count check above still covers it
        if (!pageUrls.has(src)) throw new Error(`attachment ${id} (${src.split("/").pop()}) is in the CSV but not on the page`);
        attachmentOf.set(src, id);
      }

      const items: ScrapedDownload[] = [];
      for (const f of found) {
        const title = LABELS[f.label];
        if (!title) throw new Error(`unknown label "${f.label}" — add it to LABELS deliberately`);
        const url = normUrl(f.url);
        if (!sizeCache.has(url)) {
          const head = await fetchWithRetry(url, { method: "HEAD" });
          const type = head.headers.get("content-type") ?? "";
          const len = Number(head.headers.get("content-length"));
          if (!head.ok) throw new Error(`${url.split("/").pop()} → HTTP ${head.status}`);
          if (!/application\/pdf/i.test(type)) throw new Error(`${url.split("/").pop()} is ${type || "untyped"}, not a PDF`);
          if (!Number.isFinite(len) || len <= 0) throw new Error(`${url.split("/").pop()} reports no content-length`);
          if (len > MAX_FILE_BYTES) throw new Error(`${url.split("/").pop()} is ${(len / 1048576).toFixed(1)}MB, over the 25MB file limit`);
          sizeCache.set(url, len);
        }
        items.push({ label: f.label, title, url, attachmentId: attachmentOf.get(url) ?? null, sizeBytes: sizeCache.get(url)! });
      }

      result[p.wpId] = { name: p.name, items };
      console.log(`  ✓ ${tag.slice(0, 54).padEnd(56)} ${items.map((i) => i.title).join(" · ")}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${tag}: ${msg}`);
      console.log(`  ✗ ${tag.slice(0, 54).padEnd(56)} ${msg}`);
    }
    await sleep(DELAY_MS);
  }

  const all = Object.values(result).flatMap((r) => r.items);
  const unique = new Set(all.map((i) => i.url));
  const bytes = [...unique].reduce((n, u) => n + (sizeCache.get(u) ?? 0), 0);
  const labelCounts = new Map<string, number>();
  for (const i of all) labelCounts.set(i.title, (labelCounts.get(i.title) ?? 0) + 1);

  console.log(`\n=== DOWNLOADS SCRAPE ===`);
  console.log(`  products        : ${Object.keys(result).length} of ${products.length}`);
  console.log(`  downloads       : ${all.length}`);
  console.log(`  unique files    : ${unique.size}  (${(bytes / 1048576).toFixed(1)}MB)`);
  console.log(`  via REST cross-check: ${all.filter((i) => i.attachmentId).length}   page-only: ${all.filter((i) => !i.attachmentId).length}`);
  for (const [t, n] of [...labelCounts].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(3)}  ${t}`);
  console.log(`  failed          : ${errors.length}`);
  for (const e of errors) console.log(`     ${e}`);

  /*
   * ⚠️ Nothing is written if ANY product failed. A partial file would be read
   * by the import as the complete truth, and the products missing from it
   * would simply never get their downloads — with no error anywhere.
   */
  if (errors.length) {
    console.log(`\n  ✗ ${OUT} NOT written — fix or re-run the failures above.\n`);
    process.exit(1);
  }
  // ⚠️ A scoped run never writes the aggregate: it would replace the whole map
  // with the handful it looked at (`--only` once truncated the compatible map to {}).
  if (only) {
    console.log(`\n  (--only: nothing written)\n`);
    return;
  }
  mkdirSync(MIGRATION_DIR, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), source: WP, products: result }, null, 2) + "\n",
  );
  console.log(`\n  ✓ wrote ${OUT}\n`);
}

main().catch((err) => {
  console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});

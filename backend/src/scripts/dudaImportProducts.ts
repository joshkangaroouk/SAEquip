/**
 * Stage 1 of the WordPress → Duda catalogue migration: create every published
 * product with its title, SKU and full image gallery. Nothing else — no
 * descriptions, no SEO, no options, no Hub content. Those are later stages.
 *
 * Dry run (default — parses, validates, HEAD-checks every image, writes nothing):
 *   npm run duda:import-products --workspace=backend
 *
 * Import, in verified batches:
 *   npm run duda:import-products --workspace=backend -- --confirm
 *   npm run duda:import-products --workspace=backend -- --confirm --limit 3
 *
 * Re-check the store against the CSV (read-only):
 *   npm run duda:import-products --workspace=backend -- --verify
 *
 * Retry only what failed last run:
 *   npm run duda:import-products --workspace=backend -- --confirm --retry-failed
 *
 * Re-apply images to specific products already marked done (scope it — see --force):
 *   npm run duda:import-products --workspace=backend -- --confirm --force --only 12880,13045
 *
 * Products with no image in WordPress get frontend/public/saequip-no-image.jpg,
 * staged via Supabase so Duda can fetch and re-host it. --no-fallback opts out.
 *
 * Undo (deletes only products THIS script created, per the ledger):
 *   npm run duda:import-products --workspace=backend -- --rollback --confirm
 *
 * ── Why this script writes files, unlike every other script here ──
 * `POST /ecommerce/products` is not idempotent, so a re-run without memory of
 * what already exists would duplicate products. `migration/ledger.json` maps
 * WordPress ID → Duda product id and is written immediately on each create, so
 * a crash mid-run is always resumable. `migration/` is gitignored.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { duda, DudaApiError } from "../services/duda.js";
import { syncHubProduct } from "../services/hubProduct.js";
import { publicImageUrl, uploadObject } from "../services/storage.js";
import { prisma } from "../prisma.js";
import {
  parsePublishedProducts,
  reportIntegrity,
  isIngestableUrl,
  type WooProduct,
} from "../services/wooImport.js";

/**
 * Products this script must never touch, by Duda id.
 *
 * Empty by design now: it originally held the hand-built EX Heater, whose 2
 * curated images `updateProductImages` (a FULL gallery replacement) would have
 * overwritten — but that product has since been deliberately replaced with the
 * CSV's version, so the entry would only protect a dead id.
 *
 * Kept as a mechanism, not a leftover: add an id here before any run that
 * could clobber a product someone has curated by hand. Note a deny-list alone
 * is not enough for a product that is also IN the CSV — see adoptExisting().
 */
const DENY_DUDA_IDS = new Set<string>();

/** Repo-root-relative working dir (script runs with cwd = backend/). */
const MIGRATION_DIR = path.resolve(process.cwd(), "..", "migration");
const DEFAULT_CSV = path.join(MIGRATION_DIR, "wc-export-2026-09-07.csv");
const LEDGER_PATH = path.join(MIGRATION_DIR, "ledger.json");
const IMAGE_DIR = path.join(MIGRATION_DIR, "images");

/** Duda's CDN host. An image only truly "lives in Duda" once it's here. */
const DUDA_CDN = "irp.cdn-website.com";

/**
 * Placeholder for the 5 products WordPress has no image for. Duda ingests by
 * fetching a URL, so the file is uploaded to the PUBLIC `product-media` bucket
 * once and that URL is handed to Duda — the same staging route the dashboard's
 * own image upload uses. Duda then re-hosts its own copy per product, so the
 * gallery still ends up entirely on Duda's CDN.
 *
 * Deliberately no `MediaAsset` row: the Media Centre's image list feeds the
 * logo picker, and a placeholder is not a logo.
 */
const FALLBACK_SOURCE = path.resolve(process.cwd(), "..", "frontend", "public", "saequip-no-image.jpg");
/** Deterministic path so repeat runs reuse the same upload instead of piling up copies. */
const FALLBACK_STORAGE_PATH = "images/saequip-no-image.jpg";

/** Duda fetches each image during the PATCH, so scale the wait to gallery size. */
const IMAGE_TIMEOUT_BASE_MS = 30_000;
const IMAGE_TIMEOUT_PER_IMAGE_MS = 15_000;
const CREATE_TIMEOUT_MS = 30_000;

/** Gentle pacing — services/duda.ts has no rate-limit handling of its own. */
const DELAY_BETWEEN_PRODUCTS_MS = 400;
const DELAY_BETWEEN_BATCHES_MS = 1_500;
const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------- argv helpers

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------- ledger

interface LedgerEntry {
  wpId: string;
  dudaProductId: string;
  name: string;
  sku: string;
  createdAt: string;
  /** Set once the gallery is confirmed re-hosted on Duda's CDN. */
  imagesDone?: boolean;
  expectedImages?: number;
  lastError?: string;
  /** True when matched to a pre-existing Duda product rather than created. */
  adopted?: boolean;
  /** True once a HubProduct row exists (needed for slug lookup + stages 2-3). */
  hubSynced?: boolean;
  /** Set when Duda's title/slug constraints forced a suffixed name. */
  renamedTo?: string;
  /** Set when WordPress had no image and the placeholder was used instead. */
  usedFallbackImage?: boolean;
}
type Ledger = Record<string, LedgerEntry>;

function loadLedger(): Ledger {
  if (!existsSync(LEDGER_PATH)) return {};
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as Ledger;
  } catch (err) {
    fail(`ledger.json is unreadable (${err instanceof Error ? err.message : "?"}). Move it aside rather than deleting it — it maps WP ids to live Duda products.`);
  }
}

function saveLedger(ledger: Ledger): void {
  mkdirSync(MIGRATION_DIR, { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

// ------------------------------------------------------------------ operations

/** HEAD-check so a dead URL is caught BEFORE it becomes a gappy live gallery. */
async function urlReachable(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "SAEquip-migration/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    return { ok: res.ok, detail: res.ok ? `${res.status}` : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch failed" };
  }
}

/**
 * Keep a local copy of each unique image. Insurance: once WordPress is gone,
 * this archive is the only way to re-feed a gallery that failed to ingest.
 */
async function archiveImage(url: string): Promise<void> {
  const name = decodeURIComponent(url.split("/").pop() ?? "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!name) return;
  const dest = path.join(IMAGE_DIR, name);
  if (existsSync(dest)) return;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SAEquip-migration/1.0" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok || !res.body) return;
    mkdirSync(IMAGE_DIR, { recursive: true });
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  } catch {
    // Archiving is best-effort; never let it block the actual import.
  }
}

/**
 * Upload the placeholder once and return its public URL.
 *
 * `uploadObject` uses `upsert: false`, so a second run throws "already
 * exists" — which is success, not failure, since the path is deterministic and
 * the file never changes. Memoised so 5 products cost one upload attempt.
 */
let fallbackUrlPromise: Promise<string> | null = null;
function fallbackImageUrl(): Promise<string> {
  fallbackUrlPromise ??= (async () => {
    if (!existsSync(FALLBACK_SOURCE)) {
      throw new Error(
        `fallback image missing at ${FALLBACK_SOURCE} — add it, or pass --no-fallback to import image-less products with an empty gallery`,
      );
    }
    try {
      await uploadObject("image", FALLBACK_STORAGE_PATH, readFileSync(FALLBACK_SOURCE), "image/jpeg");
      console.log(`  • uploaded fallback image → ${FALLBACK_STORAGE_PATH}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|duplicate/i.test(msg)) throw err;
      console.log(`  • reusing existing fallback image at ${FALLBACK_STORAGE_PATH}`);
    }
    const url = publicImageUrl(FALLBACK_STORAGE_PATH);
    // Duda will fetch this itself, so prove it's reachable before relying on it.
    const { ok, detail } = await urlReachable(url);
    if (!ok) throw new Error(`fallback image is not publicly reachable (${detail}): ${url}`);
    return url;
  })();
  return fallbackUrlPromise;
}

/** Gallery URLs for a product: its own images, or the placeholder. */
async function galleryFor(p: WooProduct): Promise<string[]> {
  if (p.images.length > 0) return p.images;
  if (flag("no-fallback")) return [];
  return [await fallbackImageUrl()];
}

/** How many images this product should end up with in Duda. */
function expectedImageCount(p: WooProduct): number {
  if (p.images.length > 0) return p.images.length;
  return flag("no-fallback") ? 0 : 1;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof DudaApiError) return err.status === 429 || err.status >= 500;
  // AbortError (timeout) and network faults are worth another go.
  return true;
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS) break;
      const backoff = 2_000 * attempt;
      console.log(`      ↻ ${label} failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${backoff / 1000}s`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

/** True once every gallery URL is on Duda's CDN — i.e. Duda owns the files. */
function galleryLivesInDuda(images: { url: string }[]): boolean {
  return images.length > 0 && images.every((i) => i.url.includes(DUDA_CDN));
}

// ------------------------------------------------------------------- dry run

async function dryRun(products: WooProduct[]): Promise<void> {
  const rep = reportIntegrity(products);

  console.log(`\n=== SOURCE DATA (${rep.total} published products) ===\n`);
  console.log(`  images: ${rep.totalImageRefs} references, ${rep.uniqueImageUrls.length} unique`);
  const fallbackNote = flag("no-fallback")
    ? "will import with an empty gallery (--no-fallback)"
    : `will get the placeholder ${FALLBACK_STORAGE_PATH}`;
  console.log(`  products with no image: ${rep.noImages.length} — ${fallbackNote}`);
  for (const p of rep.noImages) console.log(`     ${p.sku || "(no sku)"} — ${p.name}`);

  console.log(`\n  malformed image URLs: ${rep.malformedImageUrls.length}`);
  for (const u of rep.malformedImageUrls) console.log(`     ${u}`);

  console.log(`\n  MISSING SKU (${rep.missingSku.length}) — will import, needs a SKU assigning after:`);
  for (const p of rep.missingSku) console.log(`     wp#${p.wpId}  ${p.name}`);

  const dupes = Object.entries(rep.duplicateSkus);
  console.log(`\n  DUPLICATE SKUs (${dupes.length}) — will import; fix in Duda after:`);
  for (const [sku, list] of dupes) {
    console.log(`     ${sku}:`);
    for (const p of list) console.log(`        wp#${p.wpId}  ${p.name}`);
  }

  // Store headroom.
  const store = await duda.getStore();
  const existing = await duda.listAllProducts();
  const max = store.features?.max_products ?? 0;
  console.log(`\n=== DUDA STORE ===\n`);
  console.log(`  existing products: ${existing.length}`);
  console.log(`  max_products: ${max}`);
  console.log(`  after import: ${existing.length + rep.total} / ${max}` +
    (existing.length + rep.total > max ? "   *** EXCEEDS CAP ***" : "   ok"));

  // Image reachability — the whole import depends on this.
  console.log(`\n=== IMAGE REACHABILITY (${rep.uniqueImageUrls.length} unique URLs) ===\n`);
  const dead: string[] = [];
  let checked = 0;
  for (const url of rep.uniqueImageUrls) {
    const { ok, detail } = await urlReachable(url);
    checked++;
    if (!ok) {
      dead.push(`${url} — ${detail}`);
      console.log(`  DEAD  ${url} — ${detail}`);
    }
    if (checked % 50 === 0) console.log(`  …checked ${checked}/${rep.uniqueImageUrls.length}`);
  }
  console.log(`\n  reachable: ${rep.uniqueImageUrls.length - dead.length}/${rep.uniqueImageUrls.length}`);
  if (dead.length) {
    console.log(`\n  *** ${dead.length} UNREACHABLE — these galleries would import incomplete. ***`);
  }

  const reportPath = path.join(MIGRATION_DIR, `report-dryrun-${Date.now()}.json`);
  mkdirSync(MIGRATION_DIR, { recursive: true });
  writeFileSync(reportPath, JSON.stringify({
    total: rep.total,
    missingSku: rep.missingSku.map((p) => ({ wpId: p.wpId, name: p.name })),
    duplicateSkus: Object.fromEntries(dupes.map(([s, l]) => [s, l.map((p) => ({ wpId: p.wpId, name: p.name }))])),
    noImages: rep.noImages.map((p) => ({ wpId: p.wpId, sku: p.sku, name: p.name })),
    uniqueImages: rep.uniqueImageUrls.length,
    deadImages: dead,
  }, null, 2));

  console.log(`\n  report written: ${reportPath}`);
  console.log(`\nNothing was written to Duda. Re-run with --confirm to import.\n`);
}

// --------------------------------------------------------------------- import

/**
 * Reconcile the CSV against what Duda already holds, BEFORE creating anything.
 *
 * Two jobs, both about not creating duplicates:
 *
 *  - EX Heater is in this CSV (wp#7481 / SAPH18440) and already exists in Duda,
 *    hand-curated with a 3D model. Without this, its CSV row has no ledger
 *    entry, so the importer would happily create a SECOND "EX Heater" — the
 *    deny-list alone can't help, because it only knows a Duda id and the
 *    duplicate wouldn't have one until after it was created.
 *  - More generally, if the ledger is ever lost, matching on SKU lets a re-run
 *    adopt what it already made instead of doubling the catalogue.
 *
 * Deny-listed products are additionally marked done, so they're skipped
 * entirely rather than having their curated galleries overwritten.
 */
function adoptExisting(
  products: WooProduct[],
  existing: { id: string; sku?: string | null; name?: string | null }[],
  ledger: Ledger,
): { adopted: number; denied: string[] } {
  const bySku = new Map<string, { id: string; name?: string | null }>();
  for (const e of existing) {
    const sku = (e.sku ?? "").trim();
    if (sku) bySku.set(sku, e);
  }

  let adopted = 0;
  const denied: string[] = [];

  for (const p of products) {
    if (ledger[p.wpId] || !p.sku) continue;
    const match = bySku.get(p.sku);
    if (!match) continue;

    ledger[p.wpId] = {
      wpId: p.wpId,
      dudaProductId: match.id,
      name: p.name,
      sku: p.sku,
      createdAt: new Date().toISOString(),
      expectedImages: p.images.length,
      adopted: true,
    };
    adopted++;

    if (DENY_DUDA_IDS.has(match.id)) {
      // Already correct and curated by hand — treat as finished, don't touch.
      ledger[p.wpId].imagesDone = true;
      ledger[p.wpId].expectedImages = undefined;
      denied.push(`${p.sku} ${p.name} → ${match.id}`);
    }
  }

  if (adopted) saveLedger(ledger);
  return { adopted, denied };
}

async function importProducts(products: WooProduct[], batchSize: number): Promise<void> {
  const ledger = loadLedger();

  // Pre-flight the store cap, same guard the HTTP create route applies.
  const store = await duda.getStore();
  const existing = await duda.listAllProducts();
  const max = store.features?.max_products ?? Number.MAX_SAFE_INTEGER;

  const { adopted, denied } = adoptExisting(products, existing, ledger);
  if (adopted) console.log(`\n  adopted ${adopted} product(s) that already exist in Duda (matched on SKU)`);
  for (const d of denied) console.log(`  ⊘ deny-listed, leaving untouched: ${d}`);

  // --force re-runs the image PATCH for products already marked done. Scope it
  // with --only: re-PATCHing a saequip.com URL makes Duda fetch and re-host the
  // file AGAIN, leaving a duplicate on its CDN, so a blanket --force is waste.
  const todo = flag("force")
    ? products
    : products.filter((p) => !ledger[p.wpId]?.imagesDone);
  if (existing.length + todo.length > max) {
    fail(`Would exceed max_products (${existing.length} existing + ${todo.length} to import > ${max}).`);
  }

  console.log(`\n${products.length} product(s) selected; ${todo.length} still need work.`);
  console.log(`Batch size ${batchSize}. Each batch is verified before the next starts.\n`);

  const failures: { wpId: string; name: string; error: string }[] = [];
  const batches: WooProduct[][] = [];
  for (let i = 0; i < todo.length; i += batchSize) batches.push(todo.slice(i, i + batchSize));

  for (const [bi, batch] of batches.entries()) {
    console.log(`\n─── batch ${bi + 1}/${batches.length} (${batch.length} products) ───`);

    for (const p of batch) {
      const label = `${p.sku || "(no sku)"} ${p.name}`.slice(0, 58);
      try {
        await importOne(p, ledger);
        console.log(`  ✓ ${label}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 180) : String(err);
        failures.push({ wpId: p.wpId, name: p.name, error: msg });
        if (ledger[p.wpId]) {
          ledger[p.wpId].lastError = msg;
          saveLedger(ledger);
        }
        console.log(`  ✗ ${label}\n      ${msg}`);
      }
      await sleep(DELAY_BETWEEN_PRODUCTS_MS);
    }

    // Verify this batch before moving on, so a systemic problem stops the run
    // early rather than after 96 products.
    const bad = await verifyBatch(batch, ledger);
    if (bad.length) {
      console.log(`\n  ⚠ ${bad.length} product(s) in this batch did not verify:`);
      for (const b of bad) console.log(`      ${b}`);
      if (bad.length === batch.length) {
        saveLedger(ledger);
        fail(`Every product in batch ${bi + 1} failed verification — stopping rather than continuing. Fix the cause, then re-run with --confirm --retry-failed.`);
      }
    } else {
      console.log(`  ✓ batch verified — all galleries re-hosted on ${DUDA_CDN}`);
    }

    saveLedger(ledger);
    if (bi < batches.length - 1) await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  saveLedger(ledger);

  console.log(`\n=== DONE ===`);
  console.log(`  imported/updated: ${todo.length - failures.length}`);
  console.log(`  failed: ${failures.length}`);
  for (const f of failures) console.log(`     wp#${f.wpId} ${f.name}: ${f.error}`);
  if (slugCollisions.length) {
    console.log(`\n  name collisions resolved by suffixing the SKU (${slugCollisions.length}) — Duda forbids duplicate titles, so these need a human decision on the final name:`);
    for (const s of slugCollisions) console.log(`     ${s.sku || "(no sku)"} "${s.name}" → /${s.slug}`);
  }
  if (failures.length) console.log(`\n  Re-run with --confirm --retry-failed to retry just these.`);
  console.log(`\n  ledger: ${LEDGER_PATH}\n`);
}

/** Mirrors how Duda slugs a product name, for building a disambiguated one. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Create a product, disambiguating names that Duda's catalogue won't accept.
 *
 * Duda enforces TWO uniqueness constraints across a catalogue, both discovered
 * the hard way here:
 *   - `seo.product_url` (auto-derived from the name) → `400 "Duplicate product url"`
 *   - the product **title** itself → `400 "Products in catalog can't have duplicate titles"`
 *
 * Both are case-insensitive, and this catalogue has one genuine clash:
 * "Compact Filtration Unit" (SACFU) vs "COMPACT FILTRATION UNIT" (SAECFU) —
 * two different products whose names differ only in case.
 *
 * So the title cannot be preserved as-is: appending the SKU is the only way
 * both products can coexist. An earlier version tried creating under a
 * suffixed name and then PATCHing the real name back with an explicit unique
 * slug — that fails on the *title* constraint, and leaves an orphan product
 * behind. Keeping the suffixed title is the honest resolution, since two
 * identically-named products are indistinguishable to a customer anyway.
 *
 * Reported in the fix-list so a human picks the final name.
 */
async function createWithUniqueSlug(p: WooProduct) {
  const base = {
    sku: p.sku || undefined,
    prices: [{ price: p.price }],
    status: "ACTIVE" as const,
    type: "PHYSICAL" as const,
  };

  try {
    return await duda.createProduct({ name: p.name, ...base });
  } catch (err) {
    const collides =
      err instanceof DudaApiError &&
      err.status === 400 &&
      /duplicate product url|duplicate titles/i.test(err.body);
    if (!collides) throw err;

    const discriminator = p.sku || `wp${p.wpId}`;
    const name = `${p.name} (${discriminator})`;
    console.log(`      ⚠ name/slug collision — importing as "${name}"`);

    const created = await duda.createProduct({ name, ...base });
    slugCollisions.push({
      wpId: p.wpId,
      sku: p.sku,
      name: p.name,
      slug: created.seo?.product_url ?? slugify(name),
    });
    return created;
  }
}

/** Products that needed a disambiguated slug — surfaced at the end of the run. */
const slugCollisions: { wpId: string; sku: string; name: string; slug: string }[] = [];

async function importOne(p: WooProduct, ledger: Ledger): Promise<void> {
  let entry = ledger[p.wpId];

  // 1. Create (or reuse an existing create from a previous run).
  if (!entry) {
    if (!p.name) throw new Error("product has no name — Duda requires one");
    const created = await withRetry("create", () => createWithUniqueSlug(p));

    // 2. Ledger FIRST, before images: a crash here must never leave a created
    //    product invisible to the next run, or it would be created twice.
    entry = {
      wpId: p.wpId,
      dudaProductId: created.id,
      name: p.name,
      sku: p.sku,
      createdAt: new Date().toISOString(),
      expectedImages: p.images.length,
    };
    if (created.name !== p.name) entry.renamedTo = created.name;
    ledger[p.wpId] = entry;
    saveLedger(ledger);

    // 3. Hub row + slug backfilled from Duda's generated seo.product_url.
    await syncHubProduct(created);
    entry.hubSynced = true;
    saveLedger(ledger);
  }

  if (DENY_DUDA_IDS.has(entry.dudaProductId)) {
    throw new Error(`refusing to touch deny-listed product ${entry.dudaProductId}`);
  }

  // An ADOPTED product skipped the create branch above, so it has no HubProduct
  // row yet — and without one the public widget can't resolve it by slug and
  // stages 2-3 have nothing to attach content to. Costs one GET, only once.
  if (!entry.hubSynced) {
    await syncHubProduct(await duda.getProduct(entry.dudaProductId));
    entry.hubSynced = true;
    saveLedger(ledger);
  }

  const gallery = await galleryFor(p);

  if (flag("skip-images") || gallery.length === 0) {
    entry.imagesDone = true;
    entry.expectedImages = 0;
    delete entry.lastError;
    saveLedger(ledger);
    return;
  }

  // 4. Images: check reachability, archive, then hand the URLs to Duda.
  const usingFallback = p.images.length === 0;
  for (const url of gallery) {
    if (!isIngestableUrl(url)) throw new Error(`malformed image URL: ${url}`);
    const { ok, detail } = await urlReachable(url);
    if (!ok) throw new Error(`image unreachable (${detail}): ${url}`);
    // Only archive the WordPress originals; the placeholder already lives in
    // the repo and in Supabase.
    if (!usingFallback) await archiveImage(url);
  }
  if (usingFallback) {
    console.log(`      ⓘ no image in WordPress — using the placeholder`);
    entry.usedFallbackImage = true;
  }

  const timeoutMs = IMAGE_TIMEOUT_BASE_MS + gallery.length * IMAGE_TIMEOUT_PER_IMAGE_MS;
  await withRetry("images", () =>
    duda.updateProductImages(
      entry!.dudaProductId,
      gallery.map((url) => ({ url, alt: p.name })),
      { timeoutMs },
    ),
  );

  entry.expectedImages = gallery.length;
  delete entry.lastError;
  saveLedger(ledger);
}

/** Re-read each product from Duda and confirm the gallery really landed. */
async function verifyBatch(batch: WooProduct[], ledger: Ledger): Promise<string[]> {
  const bad: string[] = [];
  for (const p of batch) {
    const entry = ledger[p.wpId];
    if (!entry) {
      bad.push(`wp#${p.wpId} ${p.name}: never created`);
      continue;
    }
    try {
      const live = await duda.getProduct(entry.dudaProductId);
      const expected = expectedImageCount(p);
      if (live.images.length !== expected) {
        bad.push(`${p.name}: Duda has ${live.images.length} image(s), expected ${expected}`);
        continue;
      }
      if (expected > 0 && !galleryLivesInDuda(live.images)) {
        const stragglers = live.images.filter((i) => !i.url.includes(DUDA_CDN)).length;
        bad.push(`${p.name}: ${stragglers} image(s) not re-hosted on ${DUDA_CDN} yet`);
        continue;
      }
      entry.imagesDone = true;
    } catch (err) {
      bad.push(`${p.name}: verify failed — ${err instanceof Error ? err.message.slice(0, 120) : "?"}`);
    }
  }
  return bad;
}

// --------------------------------------------------------------------- verify

async function verify(products: WooProduct[]): Promise<void> {
  const ledger = loadLedger();
  const live = await duda.listAllProducts();
  const byId = new Map(live.map((p) => [p.id, p]));

  console.log(`\n=== VERIFY: ${products.length} CSV products vs ${live.length} in Duda ===\n`);

  let ok = 0;
  const problems: string[] = [];
  const renamed: string[] = [];
  const usedFallback: string[] = [];
  let notImported = 0;
  let hostedOnWordpress = 0;

  for (const p of products) {
    const entry = ledger[p.wpId];
    if (!entry) {
      notImported++;
      problems.push(`NOT IMPORTED  wp#${p.wpId}  ${p.name}`);
      continue;
    }
    const l = byId.get(entry.dudaProductId);
    if (!l) {
      problems.push(`MISSING IN DUDA  ${entry.dudaProductId}  ${p.name}`);
      continue;
    }
    if (DENY_DUDA_IDS.has(entry.dudaProductId)) {
      // Curated by hand and deliberately not synced from the CSV, so its
      // gallery legitimately differs — counting it as a problem would be noise.
      console.log(`  ⊘ ${p.sku} ${p.name}: deny-listed, hand-curated (${l.images.length} images) — not checked against CSV`);
      ok++;
      continue;
    }
    const issues: string[] = [];
    // A suffixed name is the deliberate resolution of Duda's duplicate-title
    // constraint — an accepted difference, not a defect. Recognised
    // structurally rather than from the ledger flag, so it self-heals for rows
    // written before that flag existed.
    const expectedSuffixed = `${p.name} (${p.sku || `wp${p.wpId}`})`;
    const deliberateRename = l.name === entry.renamedTo || l.name === expectedSuffixed;
    if (deliberateRename) {
      renamed.push(`${p.sku || "(no sku)"} "${p.name}" → "${l.name}"`);
    } else if ((l.name ?? "") !== p.name) {
      issues.push(`name "${l.name}" != "${p.name}"`);
    }
    if ((l.sku ?? "") !== p.sku) issues.push(`sku "${l.sku ?? ""}" != "${p.sku}"`);
    const expected = expectedImageCount(p);
    if (l.images.length !== expected) {
      issues.push(`${l.images.length} images != ${expected} expected`);
    } else if (p.images.length === 0 && expected === 1) {
      usedFallback.push(`${p.sku || "(no sku)"} ${p.name}`);
    }
    const notDuda = l.images.filter((i) => !i.url.includes(DUDA_CDN));
    if (notDuda.length) {
      hostedOnWordpress++;
      issues.push(`${notDuda.length} image(s) NOT on ${DUDA_CDN}: ${notDuda[0].url.slice(0, 70)}`);
    }
    if (issues.length) problems.push(`${p.sku || "(no sku)"} ${p.name}: ${issues.join("; ")}`);
    else ok++;
  }

  console.log(`  fully correct: ${ok}/${products.length}`);
  console.log(`  not imported:  ${notImported}`);
  console.log(`  products still referencing a non-Duda host: ${hostedOnWordpress}`);
  if (usedFallback.length) {
    console.log(`\n  using the placeholder image (${usedFallback.length}) — no image in WordPress:`);
    for (const f of usedFallback) console.log(`     ${f}`);
  }
  if (renamed.length) {
    console.log(`\n  renamed to satisfy Duda's unique-title rule (${renamed.length}) — needs a final name choosing:`);
    for (const r of renamed) console.log(`     ${r}`);
  }
  if (problems.length) {
    console.log(`\n  problems (${problems.length}):`);
    for (const pr of problems) console.log(`     ${pr}`);
  }

  // Every Duda product needs a HubProduct row or the widget can't resolve it
  // by slug and stages 2-3 have nothing to hang content on.
  const hubCount = await prisma.hubProduct.count();
  const missingHub: string[] = [];
  for (const p of products) {
    const entry = ledger[p.wpId];
    if (!entry) continue;
    const row = await prisma.hubProduct.findUnique({
      where: { dudaProductId: entry.dudaProductId },
      select: { slug: true },
    });
    if (!row) missingHub.push(`${p.sku || "(no sku)"} ${p.name}`);
    else if (!row.slug) missingHub.push(`${p.sku || "(no sku)"} ${p.name} (row exists but slug is null)`);
  }
  console.log(`\n  HubProduct rows: ${hubCount} total; ${missingHub.length} of the selected products missing/incomplete`);
  for (const m of missingHub) console.log(`     ${m}`);

  const clean =
    hostedOnWordpress === 0 && notImported === 0 && problems.length === 0 && missingHub.length === 0;
  console.log(
    clean
      ? `\n✓ All ${products.length} products present, every image re-hosted in Duda, every Hub row in place.\n`
      : `\n⚠ See problems above.\n`,
  );
}

/**
 * Repair pass: guarantee a HubProduct row (with a slug) for every ledger entry.
 *
 * Needed because an ADOPTED product skips the create branch that normally
 * calls syncHubProduct, and because rows written before the `hubSynced` flag
 * existed carry no record either way. Idempotent — syncHubProduct is an upsert.
 */
async function syncHub(products: WooProduct[]): Promise<void> {
  const ledger = loadLedger();
  let synced = 0;
  let skipped = 0;

  console.log(`\nEnsuring a HubProduct row for each of ${products.length} selected product(s)…\n`);
  for (const p of products) {
    const entry = ledger[p.wpId];
    if (!entry) continue;
    const existing = await prisma.hubProduct.findUnique({
      where: { dudaProductId: entry.dudaProductId },
      select: { slug: true },
    });
    if (existing?.slug) {
      entry.hubSynced = true;
      skipped++;
      continue;
    }
    try {
      const live = await duda.getProduct(entry.dudaProductId);
      await syncHubProduct(live);
      entry.hubSynced = true;
      synced++;
      console.log(`  ✓ ${p.sku || "(no sku)"} ${p.name} → slug ${live.seo?.product_url}`);
    } catch (err) {
      console.log(`  ✗ ${p.name}: ${err instanceof Error ? err.message.slice(0, 140) : "?"}`);
    }
    await sleep(150);
  }
  saveLedger(ledger);
  console.log(`\n✓ ${synced} row(s) created/updated, ${skipped} already correct.\n`);
}

// ------------------------------------------------------------------- rollback

async function rollback(): Promise<void> {
  const ledger = loadLedger();
  // Only delete what this script actually CREATED. Adopted rows point at
  // products that existed beforehand — deleting those would destroy data the
  // migration never owned.
  const entries = Object.values(ledger).filter(
    (e) => !DENY_DUDA_IDS.has(e.dudaProductId) && !e.adopted,
  );
  if (!entries.length) fail("ledger holds nothing this script created — nothing to roll back.");

  console.log(`\nDeleting ${entries.length} product(s) created by this script…\n`);
  for (const e of entries) {
    try {
      await duda.deleteProduct(e.dudaProductId);
      await prisma.hubProduct.deleteMany({ where: { dudaProductId: e.dudaProductId } });
      delete ledger[e.wpId];
      saveLedger(ledger);
      console.log(`  ✓ deleted ${e.sku || "(no sku)"} ${e.name}`);
    } catch (err) {
      console.log(`  ✗ ${e.name}: ${err instanceof Error ? err.message.slice(0, 120) : "?"}`);
    }
    await sleep(DELAY_BETWEEN_PRODUCTS_MS);
  }
  console.log(`\n✓ Rollback complete.\n`);
}

// ------------------------------------------------------------------------ main

async function main(): Promise<void> {
  const csvPath = arg("csv") ?? DEFAULT_CSV;
  if (!existsSync(csvPath)) {
    fail(`CSV not found at ${csvPath}\n  Pass --csv <path>, or place the export at ${DEFAULT_CSV}`);
  }

  let products = parsePublishedProducts(readFileSync(csvPath, "utf8"));
  console.log(`\nParsed ${csvPath}`);
  console.log(`  ${products.length} published, non-variation products`);

  if (!products.length) fail("no published products found — check the CSV's Type/Published columns");

  // Filters.
  const only = arg("only");
  if (only) {
    const wanted = new Set(only.split(",").map((s) => s.trim()));
    products = products.filter((p) => wanted.has(p.wpId));
    console.log(`  --only → ${products.length} product(s)`);
  }
  if (flag("retry-failed")) {
    const ledger = loadLedger();
    products = products.filter((p) => !ledger[p.wpId]?.imagesDone);
    console.log(`  --retry-failed → ${products.length} unfinished product(s)`);
  }
  const limit = arg("limit");
  if (limit) {
    products = products.slice(0, Number(limit));
    console.log(`  --limit → ${products.length} product(s)`);
  }

  if (flag("rollback")) {
    if (!flag("confirm")) fail("--rollback requires --confirm (this DELETES live Duda products).");
    await rollback();
    return;
  }

  if (flag("sync-hub")) {
    if (!flag("confirm")) fail("--sync-hub requires --confirm (it writes HubProduct rows).");
    await syncHub(products);
    return;
  }

  if (flag("verify")) {
    await verify(products);
    return;
  }

  if (!flag("confirm")) {
    await dryRun(products);
    return;
  }

  const batchSize = Number(arg("batch") ?? 10);
  if (!Number.isFinite(batchSize) || batchSize < 1) fail("--batch must be a positive number");
  await importProducts(products, batchSize);
  await verify(products);
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

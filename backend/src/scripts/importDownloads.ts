import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { MAX_BYTES, objectInfo, uploadObject } from "../services/storage.js";
import type { ScrapedDownload } from "./wpScrapeDownloads.js";

/**
 * Stage 3e — bring the WordPress downloads into the Hub and link them.
 *
 * Dry run (default — reads everything, writes nothing):
 *   npm run downloads:import --workspace=backend
 *
 * Apply:
 *   npm run downloads:import --workspace=backend -- --confirm
 *
 * Read-only reconciliation against downloads.json and the bucket:
 *   npm run downloads:import --workspace=backend -- --verify
 *
 * Also `--only <wpId,…>` to scope, and `--force` to replace a product's
 * downloads that already exist (its rows are snapshotted to migration/ first).
 *
 * Reads `migration/downloads.json` from `wp:scrape-downloads`, never the old
 * site's pages: the import is a pure read of a reviewable file.
 *
 * Two phases:
 *   1. FILES — each unique URL once (126), so a range certificate shared by
 *      five products is one MediaAsset. Archived locally to
 *      `migration/downloads/`, uploaded to the PRIVATE `product-files` bucket.
 *   2. LINKS — per product, one Download row per item, in page order.
 *
 * ⚠️ Gating is OFF (decided 2026-10-01): every row is written `gated: false`.
 */

const MIGRATION_DIR = path.resolve(process.cwd(), "..", "migration");
const SOURCE = path.join(MIGRATION_DIR, "downloads.json");
const LEDGER = path.join(MIGRATION_DIR, "ledger.json");
const ARCHIVE = path.join(MIGRATION_DIR, "downloads");
const UA = { "User-Agent": "SAEquip-Hub-migration/1.0 (one-off content migration)" };
const MAX_ATTEMPTS = 3;

const flag = (n: string) => process.argv.includes(`--${n}`);
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

interface Source {
  generatedAt: string;
  products: Record<string, { name: string; items: ScrapedDownload[] }>;
}

/**
 * `files/wp/<uploads-relative path>` — the same deterministic scheme as the
 * images' `images/wp/…` (storagePathFor in dudaImportProducts.ts), so a re-run
 * finds what an earlier run uploaded instead of uploading it twice. The year
 * and month folders are kept: two different files can share a basename.
 */
function storagePathFor(url: string): string {
  const m = /\/wp-content\/uploads\/(.+)$/.exec(url);
  if (!m) fail(`not a WordPress upload URL: ${url}`);
  return `files/wp/${decodeURIComponent(m[1]).replace(/[^a-zA-Z0-9._/-]/g, "_")}`;
}

/** The local archive keeps the same relative layout as the bucket. */
const archivePathFor = (storagePath: string) => path.join(ARCHIVE, storagePath.replace(/^files\/wp\//, ""));

async function fetchPdf(url: string): Promise<Buffer> {
  let last = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(60_000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      last = `HTTP ${res.status}`;
      if (res.status === 404) break; // an answer, not a transient fault
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(1_500 * attempt);
  }
  throw new Error(`fetch failed (${last})`);
}

/**
 * ⚠️ Every check a file must pass before it becomes a row. These are
 * compliance documents: a truncated PDF would upload "successfully", list
 * in the editor, and only fail when a buyer tried to open it.
 */
function verifyPdf(buf: Buffer, expectedBytes: number): string | null {
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return "not a PDF (no %PDF- header)";
  if (buf.byteLength !== expectedBytes) return `${buf.byteLength} bytes, but the server reported ${expectedBytes}`;
  if (buf.byteLength > MAX_BYTES.file) return `${(buf.byteLength / 1048576).toFixed(1)}MB, over the file limit`;
  return null;
}

async function main() {
  const confirm = flag("confirm");
  const force = flag("force");
  const verifyOnly = flag("verify");
  const only = arg("only")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!existsSync(SOURCE)) fail(`${SOURCE} is missing — run wp:scrape-downloads first.`);
  const source = JSON.parse(readFileSync(SOURCE, "utf8")) as Source;
  const ledger = JSON.parse(readFileSync(LEDGER, "utf8")) as Record<string, { dudaProductId: string }>;

  const entries = Object.entries(source.products).filter(([wpId]) => !only || only.includes(wpId));
  if (!entries.length) fail("Nothing to do — no products selected.");

  // One entry per unique file, carrying the size the scrape's HEAD reported.
  const files = new Map<string, { url: string; sizeBytes: number; storagePath: string }>();
  for (const [, p] of entries) {
    for (const it of p.items) {
      if (!files.has(it.url)) files.set(it.url, { url: it.url, sizeBytes: it.sizeBytes, storagePath: storagePathFor(it.url) });
    }
  }

  if (verifyOnly) return verify(entries, files, ledger);

  console.log(`\n${confirm ? "Importing" : "Dry run —"} downloads from ${SOURCE} (scraped ${source.generatedAt})`);
  console.log(`  products: ${entries.length}   downloads: ${entries.reduce((n, [, p]) => n + p.items.length, 0)}   unique files: ${files.size}`);
  console.log(`  ${force ? "--force: products that already have downloads WILL be replaced" : "products that already have downloads are skipped (--force to replace)"}\n`);

  // ---------------------------------------------------------------- FILES
  console.log("=== FILES ===");
  let uploaded = 0;
  let present = 0;
  let wouldUpload = 0;
  const fileFailures: string[] = [];
  const assetIdOf = new Map<string, string>();

  for (const f of files.values()) {
    const name = f.storagePath.split("/").pop()!;
    const existing = await prisma.mediaAsset.findUnique({ where: { storagePath: f.storagePath }, select: { id: true } });
    if (existing) {
      assetIdOf.set(f.url, existing.id);
      present++;
      continue;
    }
    if (!confirm) {
      wouldUpload++;
      continue;
    }
    try {
      const local = archivePathFor(f.storagePath);
      let buf: Buffer;
      if (existsSync(local)) {
        buf = readFileSync(local);
      } else {
        buf = await fetchPdf(f.url);
        // Archived BEFORE it is checked, so a bad download is still on disk to
        // be inspected rather than vanishing with the error.
        mkdirSync(path.dirname(local), { recursive: true });
        writeFileSync(local, buf);
      }
      const problem = verifyPdf(buf, f.sizeBytes);
      if (problem) throw new Error(problem);

      try {
        await uploadObject("file", f.storagePath, buf, "application/pdf");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/already exists|duplicate/i.test(msg)) throw err;
        /*
         * An earlier run uploaded it and crashed before writing the row. That
         * is only safe to adopt if it IS this file — so check the size rather
         * than trusting the path, or a stale object would be attached silently.
         */
        const info = await objectInfo("file", f.storagePath);
        if (!info || info.sizeBytes !== buf.byteLength) {
          throw new Error(`an object already exists at ${f.storagePath} but is ${info?.sizeBytes ?? "?"} bytes, not ${buf.byteLength}`);
        }
      }

      const row = await prisma.mediaAsset.create({
        data: {
          filename: name,
          storagePath: f.storagePath,
          mimeType: "application/pdf",
          sizeBytes: buf.byteLength,
          kind: "file",
          alt: null,
          uploadedBy: "wordpress-import",
        },
      });
      assetIdOf.set(f.url, row.id);
      uploaded++;
      if (uploaded % 20 === 0) console.log(`  … ${uploaded} uploaded`);
      await sleep(120);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fileFailures.push(`${name}: ${msg}`);
      console.log(`  ✗ ${name}: ${msg}`);
    }
  }
  console.log(`  uploaded        : ${uploaded}${confirm ? "" : ` (would upload ${wouldUpload})`}`);
  console.log(`  already present : ${present}`);
  console.log(`  failed          : ${fileFailures.length}`);

  // ---------------------------------------------------------------- LINKS
  console.log("\n=== LINKS ===");
  let linked = 0;
  let skippedExisting = 0;
  let wouldLink = 0;
  const linkFailures: string[] = [];

  for (const [wpId, p] of entries) {
    const tag = `wp#${wpId} ${p.name}`;
    // Through the LEDGER, never by SKU: 3 products have none and 4 SKUs are shared by 9.
    const entry = ledger[wpId];
    const hub = entry
      ? await prisma.hubProduct.findUnique({ where: { dudaProductId: entry.dudaProductId }, select: { id: true } })
      : null;
    if (!hub) {
      linkFailures.push(`${tag}: no HubProduct row (run duda:import-products -- --sync-hub --confirm)`);
      continue;
    }

    const existing = await prisma.download.findMany({ where: { hubProductId: hub.id }, orderBy: { sortOrder: "asc" } });
    if (existing.length && !force) {
      skippedExisting++;
      console.log(`  ⊘ ${tag.slice(0, 54).padEnd(56)} already has ${existing.length} — skipped`);
      continue;
    }

    // A file that failed above has no asset, and a partial set is worse than
    // none: skip the product whole, so a re-run completes it cleanly.
    const missing = p.items.filter((it) => !assetIdOf.has(it.url));
    if (missing.length) {
      if (!confirm) {
        wouldLink++;
        continue;
      }
      linkFailures.push(`${tag}: ${missing.length} file(s) not uploaded — product skipped whole`);
      continue;
    }
    if (!confirm) {
      wouldLink++;
      continue;
    }

    if (existing.length) {
      // ⚠️ --force replaces a whole product's set: snapshot it first, per the
      // repo's rule for replace-whole-set writes against real data.
      const snap = path.join(MIGRATION_DIR, `downloads-snapshot-${wpId}-${Date.now()}.json`);
      writeFileSync(snap, JSON.stringify(existing, null, 2) + "\n");
      console.log(`    snapshot → ${path.basename(snap)}`);
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.download.deleteMany({ where: { hubProductId: hub.id } });
        await tx.download.createMany({
          data: p.items.map((it, i) => ({
            hubProductId: hub.id,
            mediaAssetId: assetIdOf.get(it.url)!,
            title: it.title,
            sortOrder: i,
            gated: false,
          })),
        });
      });
      linked++;
      console.log(`  ✓ ${tag.slice(0, 54).padEnd(56)} ${p.items.map((i) => i.title).join(" · ")}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      linkFailures.push(`${tag}: ${msg}`);
      console.log(`  ✗ ${tag.slice(0, 54).padEnd(56)} ${msg}`);
    }
  }

  console.log(`\n=== DOWNLOADS ===`);
  console.log(`  files uploaded      : ${uploaded}${confirm ? "" : ` (would upload ${wouldUpload})`}`);
  console.log(`  files already there : ${present}`);
  console.log(`  products linked     : ${linked}${confirm ? "" : ` (would link ${wouldLink})`}`);
  console.log(`  skipped (populated) : ${skippedExisting}`);
  console.log(`  failed              : ${fileFailures.length + linkFailures.length}`);
  for (const f of [...fileFailures, ...linkFailures]) console.log(`     ${f}`);
  console.log(confirm ? "\n  Next: npm run downloads:import --workspace=backend -- --verify\n" : "\n  Re-run with --confirm to apply.\n");
  if (fileFailures.length || linkFailures.length) process.exitCode = 1;
}

/**
 * Read-only: does the Hub hold exactly what downloads.json says, and is every
 * file genuinely in the bucket at the right size?
 */
async function verify(
  entries: [string, { name: string; items: ScrapedDownload[] }][],
  files: Map<string, { url: string; sizeBytes: number; storagePath: string }>,
  ledger: Record<string, { dudaProductId: string }>,
) {
  console.log(`\nVerifying ${entries.length} product(s) and ${files.size} file(s)\n`);
  const problems: string[] = [];

  for (const f of files.values()) {
    const row = await prisma.mediaAsset.findUnique({ where: { storagePath: f.storagePath } });
    if (!row) {
      problems.push(`no MediaAsset for ${f.storagePath}`);
      continue;
    }
    if (row.kind !== "file") problems.push(`${f.storagePath} is kind ${row.kind}, not file`);
    const info = await objectInfo("file", f.storagePath);
    if (!info) problems.push(`${f.storagePath} has a row but NO object in product-files`);
    else if (info.sizeBytes !== f.sizeBytes) problems.push(`${f.storagePath} is ${info.sizeBytes} bytes, expected ${f.sizeBytes}`);
  }

  let downloads = 0;
  for (const [wpId, p] of entries) {
    const hub = ledger[wpId]
      ? await prisma.hubProduct.findUnique({ where: { dudaProductId: ledger[wpId].dudaProductId }, select: { id: true } })
      : null;
    if (!hub) {
      problems.push(`wp#${wpId} ${p.name}: no HubProduct row`);
      continue;
    }
    const rows = await prisma.download.findMany({
      where: { hubProductId: hub.id },
      orderBy: { sortOrder: "asc" },
      include: { mediaAsset: { select: { storagePath: true } } },
    });
    downloads += rows.length;
    const want = p.items.map((it) => `${storagePathFor(it.url)}|${it.title}`).join("\n");
    const have = rows.map((r) => `${r.mediaAsset.storagePath}|${r.title}`).join("\n");
    if (want !== have) problems.push(`wp#${wpId} ${p.name}: ${rows.length} download(s) do not match the scrape in order`);
    if (rows.some((r, i) => r.sortOrder !== i)) problems.push(`wp#${wpId} ${p.name}: sortOrder is not dense`);
    if (rows.some((r) => r.gated)) problems.push(`wp#${wpId} ${p.name}: a download is gated (gating is off)`);
  }

  const expected = entries.reduce((n, [, p]) => n + p.items.length, 0);
  console.log(`  file assets checked : ${files.size}`);
  console.log(`  downloads in Hub    : ${downloads} (scrape says ${expected})`);
  console.log(`  problems            : ${problems.length}`);
  for (const pr of problems) console.log(`     ${pr}`);
  console.log(problems.length ? "\n  ✗ does not reconcile\n" : "\n  ✓ reconciles exactly\n");
  if (problems.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

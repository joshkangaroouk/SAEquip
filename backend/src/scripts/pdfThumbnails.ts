import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { downloadObject } from "../services/storage.js";
import { storeThumbnail } from "../services/thumbnails.js";
import { renderFirstPage } from "./lib/renderPdf.js";

/**
 * Render a first-page preview for every PDF in the Media Centre.
 *
 * Dry run (default — lists what would be rendered):
 *   npm run media:pdf-thumbnails --workspace=backend
 *
 * Apply:
 *   npm run media:pdf-thumbnails --workspace=backend -- --confirm
 *
 * `--force` re-renders previews that already exist; `--only <assetId,…>` scopes.
 *
 * The BACKFILL half. New uploads get their preview in the browser at upload
 * time (frontend/src/lib/pdfThumbnail.ts); this covers the files imported
 * before that existed, and any upload whose browser render failed. Both store
 * through `storeThumbnail`, so they cannot disagree on where previews live.
 *
 * The renderer lives in ./lib/renderPdf.ts — see the note there on why it is
 * not in this file.
 */

const MIGRATION_DIR = path.resolve(process.cwd(), "..", "migration");
const ARCHIVE = path.join(MIGRATION_DIR, "downloads");

const flag = (n: string) => process.argv.includes(`--${n}`);
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/**
 * The PDF's bytes: the local archive when the import left one there (no
 * network, and it is the exact file that was uploaded), otherwise the bucket.
 */
async function bytesFor(storagePath: string): Promise<Buffer> {
  const local = path.join(ARCHIVE, storagePath.replace(/^files\/wp\//, ""));
  if (storagePath.startsWith("files/wp/") && existsSync(local)) return readFileSync(local);
  return downloadObject("file", storagePath);
}

async function main() {
  const confirm = flag("confirm");
  const force = flag("force");
  const only = arg("only")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const assets = await prisma.mediaAsset.findMany({
    where: {
      kind: "file",
      mimeType: "application/pdf",
      ...(only ? { id: { in: only } } : {}),
      ...(force ? {} : { thumbnailPath: null }),
    },
    orderBy: { filename: "asc" },
  });

  console.log(`\n${confirm ? "Rendering" : "Dry run —"} previews for ${assets.length} PDF(s)${force ? " (--force: existing previews re-rendered)" : ""}\n`);
  if (!confirm) {
    for (const a of assets.slice(0, 10)) console.log(`  → ${a.filename}`);
    if (assets.length > 10) console.log(`  … and ${assets.length - 10} more`);
    console.log(`\n  Re-run with --confirm to apply.\n`);
    return;
  }

  let done = 0;
  let bytes = 0;
  const failures: string[] = [];
  for (const a of assets) {
    try {
      const webp = await renderFirstPage(await bytesFor(a.storagePath));
      await storeThumbnail(a, webp);
      done++;
      bytes += webp.length;
      if (done % 20 === 0) console.log(`  … ${done} rendered`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${a.filename}: ${msg}`);
      console.log(`  ✗ ${a.filename}: ${msg}`);
    }
  }

  console.log(`\n=== PDF PREVIEWS ===`);
  console.log(`  rendered : ${done}  (${(bytes / 1024 / Math.max(1, done)).toFixed(0)}KB average)`);
  console.log(`  failed   : ${failures.length}`);
  for (const f of failures) console.log(`     ${f}`);
  console.log(`  PDFs still without a preview: ${await prisma.mediaAsset.count({ where: { kind: "file", mimeType: "application/pdf", thumbnailPath: null } })}\n`);
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

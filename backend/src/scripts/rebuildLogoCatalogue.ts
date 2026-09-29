/**
 * Rebuild the Logo catalogue (and the MediaAsset rows it points at) from the
 * files already sitting in Supabase Storage.
 *
 * Why this exists: logos are uploaded by hand through the dashboard, so unlike
 * product images they have no importer. When the `Logo` / `MediaAsset` rows
 * were lost but the storage objects survived, there was no way back — and
 * `--logos` cannot run without them, because it resolves each CSV token to a
 * Logo by MATCHING THE MEDIA ASSET'S FILENAME (see resolveLogoCatalogue in
 * dudaImportProducts.ts). The file names in LOGOS below are copied from that
 * mapping deliberately: if the two drift, the import fails loudly rather than
 * badging products with the wrong certification.
 *
 * Dry run by default; --confirm to write. Idempotent: an existing MediaAsset
 * (matched on storagePath, which is unique) or an existing Logo of the same
 * kind+file is left alone.
 *
 *   npm run logos:rebuild --workspace=backend
 *   npm run logos:rebuild --workspace=backend -- --confirm
 */
import "dotenv/config";
import { PrismaClient, LogoKind } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env.js";

const prisma = new PrismaClient();
const confirm = process.argv.includes("--confirm");

const BUCKET = "product-media";
const PREFIX = "images";

/**
 * The catalogue, in display order. `file` must match dudaImportProducts.ts's
 * SA_LOGO_FILES / CERT_LOGO_FILES exactly.
 */
const LOGOS: { kind: LogoKind; file: string; label: string }[] = [
  { kind: LogoKind.SA_LOGO, file: "cyclone.jpg", label: "SA Cyclone Logo" },
  { kind: LogoKind.SA_LOGO, file: "endure.jpg", label: "SA Endure Logo" },
  { kind: LogoKind.SA_LOGO, file: "flexiheat.jpg", label: "SA Flexiheat Logo" },
  { kind: LogoKind.SA_LOGO, file: "lumin.jpg", label: "SA Lumin Logo" },
  { kind: LogoKind.SA_LOGO, file: "powernet.jpg", label: "SA Powernet Logo" },
  { kind: LogoKind.SA_LOGO, file: "rental.jpg", label: "SA Rental Logo" },
  { kind: LogoKind.CERT_LOGO, file: "ex-logo.png", label: "EX logo" },
  { kind: LogoKind.CERT_LOGO, file: "ukca.png", label: "UKCA" },
  { kind: LogoKind.CERT_LOGO, file: "IECEx_Logo.png", label: "IECEx" },
  { kind: LogoKind.CERT_LOGO, file: "Inmetro.png", label: "Inmetro" },
  { kind: LogoKind.CERT_LOGO, file: "made-in-britan.jpg", label: "Made in Britan" },
  { kind: LogoKind.CERT_LOGO, file: "zone-0.png", label: "Zone 0" },
  { kind: LogoKind.CERT_LOGO, file: "zone-1-2.png", label: "Zone 1-2" },
  { kind: LogoKind.CERT_LOGO, file: "zone-20.png", label: "Zone 20" },
  { kind: LogoKind.CERT_LOGO, file: "zone-21-22.png", label: "Zone 21-22" },
];

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** `images/{uuid}-{original name}` — the dashboard uploader's convention. */
function originalName(objectName: string): string {
  const m = /^[0-9a-f-]{36}-(.+)$/i.exec(objectName);
  return m ? m[1] : objectName;
}

async function main() {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.storage.from(BUCKET).list(PREFIX, { limit: 1000 });
  if (error) throw new Error(`storage list failed: ${error.message}`);

  const files = (data ?? []).filter((f) => f.id); // drop folder entries
  console.log(`\n${files.length} object(s) directly under ${BUCKET}/${PREFIX}\n`);

  // --- 1. MediaAsset rows -------------------------------------------------
  const existing = await prisma.mediaAsset.findMany({ select: { storagePath: true } });
  const known = new Set(existing.map((a) => a.storagePath));
  const toCreate = files.filter((f) => !known.has(`${PREFIX}/${f.name}`));

  console.log(`MediaAsset: ${files.length - toCreate.length} already present, ${toCreate.length} to create`);
  const rows = toCreate.map((f) => {
    const name = originalName(f.name);
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return {
      filename: name,
      storagePath: `${PREFIX}/${f.name}`,
      mimeType: MIME[ext] ?? "application/octet-stream",
      sizeBytes: Number(f.metadata?.size ?? 0),
      kind: "image",
      uploadedBy: "catalogue-rebuild",
    };
  });
  if (confirm && rows.length) {
    await prisma.mediaAsset.createMany({ data: rows, skipDuplicates: true });
  }

  // --- 2. Logo rows -------------------------------------------------------
  /*
   * On a dry run the assets from phase 1 do not exist yet, so the stored rows
   * are unioned with the ones phase 1 WOULD create. Without this the preview
   * reports every logo as unrebuildable — advice that is not merely useless
   * but actively wrong, since it tells you to re-upload files that are sitting
   * in the bucket already.
   */
  const stored = await prisma.mediaAsset.findMany({ select: { id: true, filename: true, sizeBytes: true } });
  const assets = confirm
    ? stored
    : [...stored, ...rows.map((r) => ({ id: "(pending)", filename: r.filename, sizeBytes: r.sizeBytes }))];
  const logos = await prisma.logo.findMany({ include: { mediaAsset: { select: { filename: true } } } });

  let created = 0;
  const problems: string[] = [];

  for (const [i, spec] of LOGOS.entries()) {
    if (logos.some((l) => l.kind === spec.kind && l.mediaAsset?.filename === spec.file)) {
      console.log(`  = ${spec.label} — already in the catalogue`);
      continue;
    }
    const matches = assets.filter((a) => a.filename === spec.file);
    if (!matches.length) {
      problems.push(`${spec.label}: no media asset named "${spec.file}"`);
      continue;
    }
    /*
     * Several logos survived as two uploads of the same name — a full-size one
     * and a much smaller one. resolveLogoCatalogue() demands EXACTLY ONE match
     * per token and aborts on ambiguity, so only one may become a Logo. The
     * larger file is chosen: a 2KB copy beside a 37KB one is a thumbnail or a
     * truncated re-upload, and a too-small mark is visible on the live page
     * while a too-large one is merely wasteful.
     */
    const pick = matches.sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
    const note = matches.length > 1 ? `  (${matches.length} copies — took the ${Math.round(pick.sizeBytes / 1024)}kb one)` : "";
    console.log(`  + ${spec.label} → ${spec.file}${note}`);
    if (confirm) {
      await prisma.logo.create({
        data: { kind: spec.kind, mediaAssetId: pick.id, label: spec.label, sortOrder: i },
      });
    }
    created++;
  }

  if (problems.length) {
    console.error("\n✗ Missing files — these logos cannot be rebuilt:");
    for (const p of problems) console.error(`    ${p}`);
    console.error("  Re-upload them in the dashboard, then run this again.");
  }

  console.log(
    `\n${confirm ? "✓" : "(dry run)"} ${created} logo(s) ${confirm ? "created" : "would be created"}` +
      `, ${LOGOS.length - created - problems.length} already present.`,
  );
  if (!confirm) console.log("  Re-run with --confirm to write.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

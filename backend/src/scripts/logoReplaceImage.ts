/**
 * Give a catalogue logo a new IMAGE, keeping the logo itself (its id, label,
 * alt text, order, translations and every product's toggle).
 *
 *   npm run logos:replace-image --workspace=backend -- --file made-in-britan.jpg --image <path> --name made-in-britain-flag.png [--confirm]
 *
 * First used 2026-10-16 (SA Equip): Made in Britain shows the Union flag only,
 * cropped from the old artwork so the colours match. The new file is uploaded
 * as its own Media Centre asset and the logo points at it; the old asset stays
 * in the Media Centre. ⚠️ The import, rebuild and assignment scripts find
 * logos by FILE NAME, so update their tables to --name in the same change.
 * Dry run by default.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "../prisma.js";
import { publicImageUrl, uploadObject, MAX_BYTES } from "../services/storage.js";

const confirm = process.argv.includes("--confirm");
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

/** By the bytes, not the name: what the browser will be told it is. */
function sniff(b: Buffer): string | null {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

async function main() {
  const file = arg("file"), imagePath = arg("image"), name = arg("name");
  if (!file || !imagePath || !name) throw new Error("pass --file <current media filename> --image <path> --name <new filename>");
  if (!/^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp)$/i.test(name)) throw new Error(`--name ${name} is not a plain image file name`);
  const logos = await prisma.logo.findMany({ where: { mediaAsset: { filename: file } }, include: { mediaAsset: true } });
  if (logos.length !== 1) throw new Error(`${logos.length} logos use the file ${file}; expected exactly one`);
  const logo = logos[0];
  const bytes = readFileSync(imagePath);
  const mime = sniff(bytes);
  if (!mime) throw new Error(`${imagePath} is not a PNG, JPEG or WebP`);
  if (bytes.length > MAX_BYTES.image) throw new Error(`${imagePath} is over the image size limit`);
  const storagePath = `images/${randomUUID()}-${name}`;
  console.log(`\n${confirm ? "Applying" : "Dry run —"} new image for "${logo.alt || logo.label}"`);
  console.log(`  now: ${logo.mediaAsset.filename} (asset ${logo.mediaAsset.id}, stays in the Media Centre)`);
  console.log(`  new: ${name}, ${mime}, ${bytes.length} bytes → ${storagePath}`);
  if (!confirm) { console.log("\nNothing written.\n"); return; }
  await uploadObject("image", storagePath, bytes, mime);
  const asset = await prisma.mediaAsset.create({
    data: { filename: name, storagePath, mimeType: mime, sizeBytes: bytes.length, kind: "image", alt: logo.alt ?? logo.label, uploadedBy: "logos:replace-image" },
  });
  await prisma.logo.update({ where: { id: logo.id }, data: { mediaAssetId: asset.id } });
  const res = await fetch(publicImageUrl(storagePath));
  console.log(`  ✓ logo now uses ${name} (${res.status === 200 ? "served" : `✗ HTTP ${res.status}`}: ${publicImageUrl(storagePath)})\n`);
  if (res.status !== 200) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

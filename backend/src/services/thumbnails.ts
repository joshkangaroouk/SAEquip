import type { MediaAsset } from "@prisma/client";
import { prisma } from "../prisma.js";
import { removeObject, uploadObject } from "./storage.js";

/** The preview types accepted, keyed by what their bytes actually say. */
export const THUMB_EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};
export const THUMB_MAX_BYTES = 1.5 * 1024 * 1024;

/** The type from the bytes, never from a header a client sent. */
export function sniffImage(b: Buffer): string | null {
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

/**
 * Store a FILE's first-page preview and point the asset at it.
 *
 * ONE implementation for both writers — `PUT /api/media/:id/thumbnail` (the
 * browser, at upload time) and `media:pdf-thumbnails` (the backfill) — so the
 * two cannot drift on where previews live or how a replacement is handled.
 *
 * Throws on a non-image body or a non-file asset; the route maps those to 400s.
 */
export async function storeThumbnail(asset: MediaAsset, buf: Buffer): Promise<MediaAsset> {
  const mime = sniffImage(buf);
  if (!mime) throw new ThumbnailError("not_an_image", "The preview is not a WebP, PNG or JPEG.");
  if (buf.length > THUMB_MAX_BYTES) throw new ThumbnailError("too_large", "The preview is over 1.5MB.");
  // Images are their own preview and models have the 3D viewer.
  if (asset.kind !== "file") throw new ThumbnailError("not_a_file", "Only files take a rendered preview.");

  const path = `thumbs/${asset.id}.${THUMB_EXT[mime]}`;
  // Upsert: re-rendering a preview is a replacement, not a conflict.
  await uploadObject("image", path, buf, mime, { upsert: true });
  // A changed format means a changed path; the old object would be an orphan.
  if (asset.thumbnailPath && asset.thumbnailPath !== path) {
    await removeObject("image", asset.thumbnailPath).catch(() => {});
  }
  return prisma.mediaAsset.update({ where: { id: asset.id }, data: { thumbnailPath: path } });
}

export class ThumbnailError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

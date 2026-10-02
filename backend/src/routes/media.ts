import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { THUMB_EXT, THUMB_MAX_BYTES, ThumbnailError, storeThumbnail } from "../services/thumbnails.js";
import { assetUsage, productCounts } from "../services/assetUsage.js";
import {
  ALLOWED_FILE_MIME,
  ALLOWED_IMAGE_MIME,
  ALLOWED_MODEL_MIME,
  MAX_BYTES,
  createUploadTarget,
  objectInfo,
  publicImageUrl,
  removeObject,
  resolveUrl,
  type BucketKind,
} from "../services/storage.js";

export const mediaRouter = Router();

/** A file's first-page preview, or null — see MediaAsset.thumbnailPath. */
const thumbnailUrlOf = (a: { thumbnailPath: string | null }) =>
  a.thumbnailPath ? publicImageUrl(a.thumbnailPath) : null;

/**
 * A URL for an asset, or null if it cannot be signed.
 *
 * ⚠️ Caught per item. The list below signs every FILE inside a `Promise.all`,
 * so one object missing from `product-files` used to fail the whole page — the
 * same all-or-nothing failure that once threatened the product editor via
 * /custom. Harmless with no files; not with 126.
 */
async function urlOrNull(kind: string, storagePath: string): Promise<string | null> {
  try {
    return await resolveUrl(kind, storagePath);
  } catch {
    return null;
  }
}

const IMAGE_MIME = new Set(ALLOWED_IMAGE_MIME);
const FILE_MIME = new Set(ALLOWED_FILE_MIME);
const MODEL_EXT = /\.glb$/i;
const MODEL_MIME = new Set(ALLOWED_MODEL_MIME);

/**
 * GLB files have no reliable mimetype across browsers/OSes (commonly reported
 * as application/octet-stream), so a model is identified by its .glb
 * extension rather than mimetype sniffing.
 */
function kindForUpload(mimetype: string, filename: string): BucketKind | null {
  if (IMAGE_MIME.has(mimetype)) return "image";
  // The name alone is not enough: a `.glb` claiming `text/html` is refused
  // here, and the bucket's own allowlist refuses it again at upload time.
  if (MODEL_EXT.test(filename)) return MODEL_MIME.has(mimetype) ? "model" : null;
  if (FILE_MIME.has(mimetype)) return "file";
  return null;
}

/** `images/` | `files/` | `models/` — the prefix encodes the kind. */
const KIND_BY_PREFIX: Record<string, BucketKind> = {
  images: "image",
  files: "file",
  models: "model",
};

/**
 * Paths this API issues, and the ONLY shape the confirm step will accept.
 *
 * Pinning the shape matters: confirm takes a path from the client, so without
 * it someone could register a MediaAsset row pointing at any object in the
 * bucket — including another product's private download file.
 */
const ISSUED_PATH_RE =
  /^(images|files|models)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]{1,100}$/;

function safeName(filename: string): string {
  return (filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

const uploadUrlBody = z
  .object({
    filename: z.string().trim().min(1, "filename required").max(255),
    mimeType: z.string().trim().min(1, "mimeType required").max(200),
  })
  .strict();

/**
 * POST /api/media/upload-url  { filename, mimeType }
 *
 * Step 1 of 2. Classifies the file, chooses the storage path, and returns a
 * signed URL the browser POSTs the bytes straight to. The API never handles
 * the file itself — see `createUploadTarget` for why (Vercel caps request
 * bodies at 4.5MB, well under the 25MB/50MB ceilings).
 */
mediaRouter.post("/media/upload-url", async (req, res, next) => {
  try {
    const parsed = uploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", detail: parsed.error.issues[0]?.message });
      return;
    }
    const { filename, mimeType } = parsed.data;

    const kind = kindForUpload(mimeType, filename);
    if (!kind) {
      res.status(400).json({ error: "unsupported_type", detail: `Disallowed type: ${mimeType}` });
      return;
    }

    // Server-chosen path: the signed token is scoped to it, so the browser
    // cannot pick where its bytes land.
    const storagePath = `${kind}s/${randomUUID()}-${safeName(filename)}`;
    const target = await createUploadTarget(kind, storagePath);

    res.json({
      kind,
      bucket: target.bucket,
      path: target.path,
      token: target.token,
      signedUrl: target.signedUrl,
      maxBytes: MAX_BYTES[kind],
    });
  } catch (err) {
    next(err);
  }
});

const confirmBody = z
  .object({
    path: z.string().trim().min(1).max(400),
    filename: z.string().trim().min(1).max(255),
    alt: z.string().trim().max(300).optional(),
  })
  .strict();

/**
 * POST /api/media  { path, filename, alt? }
 *
 * Step 2 of 2: record the MediaAsset now the bytes are in the bucket. Same
 * path, status and response shape as the old multipart route, so every
 * consumer (MediaPicker, ImagesSection, Model3DSection) is unchanged.
 *
 * Nothing the client says about the file is trusted. The size and content type
 * are read back from storage, since the browser uploaded without us seeing it,
 * and a mismatched claim would otherwise end up in the Media Centre as fact.
 */
mediaRouter.post("/media", async (req, res, next) => {
  try {
    const parsed = confirmBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", detail: parsed.error.issues[0]?.message });
      return;
    }
    const { path, filename, alt } = parsed.data;

    if (!ISSUED_PATH_RE.test(path)) {
      res.status(400).json({ error: "invalid_path", detail: "Not a path issued by /media/upload-url" });
      return;
    }
    const kind = KIND_BY_PREFIX[path.split("/")[0]];

    const info = await objectInfo(kind, path);
    if (!info) {
      res.status(404).json({ error: "not_uploaded", detail: "No object at that path — upload it first" });
      return;
    }

    // The bucket enforces this too, but check anyway: a bucket limit could be
    // relaxed by hand, and an oversize object should not become a library entry.
    if (info.sizeBytes > MAX_BYTES[kind]) {
      await removeObject(kind, path).catch(() => {});
      res.status(400).json({
        error: "file_too_large",
        detail: `Max upload size is ${Math.round(MAX_BYTES[kind] / 1024 / 1024)}MB for ${kind}s`,
      });
      return;
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        filename,
        storagePath: path,
        // From storage, not from the client.
        mimeType: info.contentType ?? "application/octet-stream",
        sizeBytes: info.sizeBytes,
        kind,
        alt: alt || null,
        uploadedBy: req.user?.email ?? null,
      },
    });

    const url = await resolveUrl(asset.kind, asset.storagePath);
    res.status(201).json({ ...asset, url, thumbnailUrl: null, usage: 0 });
  } catch (err) {
    next(err);
  }
});

/** Sort orders the Media Centre and the picker offer. */
const MEDIA_SORTS = {
  recent: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  name: { filename: "asc" },
  "name-desc": { filename: "desc" },
  largest: { sizeBytes: "desc" },
  smallest: { sizeBytes: "asc" },
} as const;

type MediaSort = keyof typeof MEDIA_SORTS;

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

const listQuery = z.object({
  kind: z.enum(["image", "file", "model"]).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(Object.keys(MEDIA_SORTS) as [MediaSort, ...MediaSort[]]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

/**
 * GET /api/media?kind=&q=&sort=&page=&pageSize=
 *
 * Returns a PAGE, not the whole library: `{ items, total, page, pageSize,
 * pageCount }`.
 *
 * ⚠️ Deliberately paginated rather than returning everything. The WordPress
 * import took the library from 5 assets to 344, and every asset costs a
 * `resolveUrl()` — a signed-URL round trip for private files — so an
 * unpaginated list grew a per-asset cost on a page nobody had noticed was
 * O(n). This is the same class of problem as the 3-counts-per-asset N+1 that
 * made this endpoint take 7.1s; that one was fixed with a usage index, and
 * capping the page size is what stops the remaining per-row work from growing
 * with the catalogue.
 *
 * `q` matches filename OR alt text, case-insensitively.
 */
mediaRouter.get("/media", async (req, res, next) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const { kind, q, sort, page, pageSize } = parsed.data;

  try {
    const where = {
      ...(kind ? { kind } : {}),
      ...(q
        ? {
            OR: [
              { filename: { contains: q, mode: "insensitive" as const } },
              { alt: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, assets] = await Promise.all([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        orderBy: MEDIA_SORTS[sort],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    // `usage` = distinct PRODUCTS this asset reaches — the same number the
    // usage popup lists. See services/assetUsage.ts.
    const usage = await productCounts(assets.map((a) => a.id));

    const items = await Promise.all(
      assets.map(async (a) => ({
        ...a,
        url: await urlOrNull(a.kind, a.storagePath),
        thumbnailUrl: thumbnailUrlOf(a),
        usage: usage.get(a.id) ?? 0,
      })),
    );

    res.json({
      items,
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/media/:id — single asset with resolved url + what uses it. */
mediaRouter.get("/media/:id", async (req, res, next) => {
  try {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [url, used] = await Promise.all([urlOrNull(asset.kind, asset.storagePath), assetUsage(asset.id)]);
    res.json({ ...asset, url, thumbnailUrl: thumbnailUrlOf(asset), usage: used.products.length, ...used });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/media/:id/usage — the products an asset is used on, for the Media
 * Centre's "Used N×" popup. Read-only, and returns nothing that is not already
 * visible in the dashboard: no URLs, so no signing and no bucket round trip.
 */
mediaRouter.get("/media/:id/usage", async (req, res, next) => {
  try {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: req.params.id },
      select: { id: true, filename: true, kind: true },
    });
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ asset, ...(await assetUsage(asset.id)) });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/media/:id/thumbnail — store a FILE's first-page preview.
 *
 * The browser renders it at upload time (lib/pdfThumbnail.ts) and the
 * backfill script renders the imported ones. Rendering on the server instead
 * would put a ~30MB native renderer into the ONE function that also serves the
 * whole dashboard and the public widget, paying for it on every cold start.
 *
 * ⚠️ RAW image bytes, not JSON. `express.json()` runs globally with its 100KB
 * default, ahead of any route, so a base64 preview of a certificate (~55KB as
 * WebP, ~300KB as PNG) could be refused before reaching here — and base64
 * would add a third to every upload besides.
 */
mediaRouter.put(
  "/media/:id/thumbnail",
  express.raw({ type: Object.keys(THUMB_EXT), limit: THUMB_MAX_BYTES }),
  async (req, res, next) => {
    try {
      const buf = req.body as unknown;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        res.status(400).json({ error: "expected_image", detail: "Send the preview as raw WebP, PNG or JPEG bytes." });
        return;
      }
      const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
      if (!asset) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const updated = await storeThumbnail(asset, buf);
      res.json({ thumbnailUrl: thumbnailUrlOf(updated) });
    } catch (err) {
      if (err instanceof ThumbnailError) {
        res.status(400).json({ error: err.code, detail: err.message });
        return;
      }
      next(err);
    }
  },
);

/**
 * DELETE /api/media/:id
 * 409 while anything references it — a product (via a logo, download or 3D
 * model) or a catalogue logo carried by no product yet. Otherwise removes the
 * object from its bucket and the row, returning 204.
 */
mediaRouter.delete("/media/:id", async (req, res, next) => {
  try {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // ⚠️ The catalogue logo counts on its own. `Logo.mediaAssetId` has no
    // onDelete, so the row delete would fail on the FK anyway — but only
    // after the object had already been removed from the bucket, leaving a
    // logo pointing at nothing.
    const { logos, products } = await assetUsage(asset.id);
    if (logos.length > 0 || products.length > 0) {
      res.status(409).json({ error: "in_use", count: products.length, logos: logos.length });
      return;
    }

    const bucketKind = asset.kind === "image" || asset.kind === "model" ? asset.kind : "file";
    await removeObject(bucketKind, asset.storagePath);
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    // Best effort: a preview left behind is an orphan in a public bucket, not
    // a broken page, and must not turn a successful delete into an error.
    if (asset.thumbnailPath) await removeObject("image", asset.thumbnailPath).catch(() => {});
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

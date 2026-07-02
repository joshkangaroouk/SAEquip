import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { prisma } from "../prisma.js";
import { uploadObject, removeObject, resolveUrl } from "../services/storage.js";

export const mediaRouter = Router();

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const FILE_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/zip",
]);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

/** Wrap multer so its errors (e.g. file too large) become clean 400s. */
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "file_too_large", detail: "Max upload size is 25MB" });
        return;
      }
      res.status(400).json({ error: "upload_error", detail: err instanceof Error ? err.message : String(err) });
      return;
    }
    next();
  });
}

function kindForMime(mime: string): "image" | "file" | null {
  if (IMAGE_MIME.has(mime)) return "image";
  if (FILE_MIME.has(mime)) return "file";
  return null;
}

async function usageCount(mediaAssetId: string): Promise<number> {
  const [logos, downloads] = await Promise.all([
    prisma.productLogo.count({ where: { mediaAssetId } }),
    prisma.download.count({ where: { mediaAssetId } }),
  ]);
  return logos + downloads;
}

async function referencingProducts(mediaAssetId: string) {
  const [logos, downloads] = await Promise.all([
    prisma.productLogo.findMany({ where: { mediaAssetId }, include: { hubProduct: true } }),
    prisma.download.findMany({ where: { mediaAssetId }, include: { hubProduct: true } }),
  ]);
  const byId = new Map<string, { hubProductId: string; sku: string | null }>();
  for (const r of [...logos, ...downloads]) {
    byId.set(r.hubProductId, { hubProductId: r.hubProductId, sku: r.hubProduct.sku });
  }
  return [...byId.values()];
}

/**
 * POST /api/media  (multipart/form-data: "file", optional "alt")
 * Validates size/type, uploads to the correct bucket, records a MediaAsset.
 */
mediaRouter.post("/media", uploadSingle, async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "no_file", detail: 'Expected a "file" field' });
      return;
    }

    const kind = kindForMime(file.mimetype);
    if (!kind) {
      res.status(400).json({ error: "unsupported_type", detail: `Disallowed mimetype: ${file.mimetype}` });
      return;
    }

    const safeName = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const storagePath = `${kind}s/${randomUUID()}-${safeName}`;

    await uploadObject(kind, storagePath, file.buffer, file.mimetype);

    const alt = typeof req.body.alt === "string" && req.body.alt.trim() ? req.body.alt.trim() : null;
    const asset = await prisma.mediaAsset.create({
      data: {
        filename: file.originalname,
        storagePath,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        kind,
        alt,
        uploadedBy: req.user?.email ?? null,
      },
    });

    const url = await resolveUrl(asset.kind, asset.storagePath);
    res.status(201).json({ ...asset, url, usage: 0 });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/media?kind=image|file
 * Newest first, each with a resolved url and a usage count.
 */
mediaRouter.get("/media", async (req, res, next) => {
  try {
    const kindParam = req.query.kind;
    const where = kindParam === "image" || kindParam === "file" ? { kind: kindParam } : {};

    const assets = await prisma.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" } });
    const result = await Promise.all(
      assets.map(async (a) => ({
        ...a,
        url: await resolveUrl(a.kind, a.storagePath),
        usage: await usageCount(a.id),
      })),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/media/:id — single asset with resolved url + referencing products. */
mediaRouter.get("/media/:id", async (req, res, next) => {
  try {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [url, references] = await Promise.all([
      resolveUrl(asset.kind, asset.storagePath),
      referencingProducts(asset.id),
    ]);
    res.json({ ...asset, url, usage: references.length, references });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/media/:id
 * 409 if referenced by any ProductLogo/Download (no delete); otherwise removes
 * the object from its bucket and the row, returning 204.
 */
mediaRouter.delete("/media/:id", async (req, res, next) => {
  try {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const references = await referencingProducts(asset.id);
    if (references.length > 0) {
      res.status(409).json({ error: "in_use", count: references.length, references });
      return;
    }

    await removeObject(asset.kind === "image" ? "image" : "file", asset.storagePath);
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

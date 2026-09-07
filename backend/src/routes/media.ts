import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { prisma } from "../prisma.js";
import { uploadObject, removeObject, resolveUrl } from "../services/storage.js";

export const mediaRouter = Router();

const MAX_BYTES_DEFAULT = 25 * 1024 * 1024; // 25MB — images/files
const MAX_BYTES_MODEL = 150 * 1024 * 1024; // 150MB — .glb models can carry large textures

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const FILE_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/zip",
]);
const MODEL_EXT = /\.glb$/i;

// multer's own cap is set to the largest kind's limit (models); the smaller
// 25MB ceiling for images/files is enforced explicitly after classification,
// once we know which kind was actually uploaded.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES_MODEL } });

/** Wrap multer so its errors (e.g. file too large) become clean 400s. */
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "file_too_large", detail: "Max upload size is 25MB (150MB for 3D models)" });
        return;
      }
      res.status(400).json({ error: "upload_error", detail: err instanceof Error ? err.message : String(err) });
      return;
    }
    next();
  });
}

/**
 * GLB files have no reliable mimetype across browsers/OSes (commonly reported
 * as application/octet-stream), so a model is identified by its .glb
 * extension rather than mimetype sniffing.
 */
function kindForUpload(mimetype: string, filename: string): "image" | "file" | "model" | null {
  if (IMAGE_MIME.has(mimetype)) return "image";
  if (MODEL_EXT.test(filename)) return "model";
  if (FILE_MIME.has(mimetype)) return "file";
  return null;
}

// A MediaAsset is "in use" if referenced by a catalog Logo, a Download, or a
// product's 3D model attachment.
/**
 * Usage counts for EVERY asset, in 3 grouped queries.
 *
 * Deliberately not "3 counts per asset": the WordPress import took the library
 * from 5 assets to 335, which turned one Media Centre page load into ~1,000
 * queries. Supabase is in eu-west-1, so per-query latency is the dominant cost
 * (the same trap that once made the public content endpoint take ~5s).
 */
async function usageIndex(): Promise<Map<string, number>> {
  const [logos, downloads, models] = await Promise.all([
    prisma.logo.groupBy({ by: ["mediaAssetId"], _count: true }),
    prisma.download.groupBy({ by: ["mediaAssetId"], _count: true }),
    prisma.hubProduct.groupBy({
      by: ["glbAssetId"],
      _count: true,
      where: { glbAssetId: { not: null } },
    }),
  ]);

  const index = new Map<string, number>();
  const add = (id: string | null, n: number) => {
    if (id) index.set(id, (index.get(id) ?? 0) + n);
  };
  for (const l of logos) add(l.mediaAssetId, l._count);
  for (const d of downloads) add(d.mediaAssetId, d._count);
  for (const m of models) add(m.glbAssetId, m._count);
  return index;
}

async function mediaReferences(mediaAssetId: string) {
  const [logos, downloads, models] = await Promise.all([
    prisma.logo.findMany({ where: { mediaAssetId }, select: { id: true, kind: true, label: true } }),
    prisma.download.findMany({ where: { mediaAssetId }, include: { hubProduct: true } }),
    prisma.hubProduct.findMany({ where: { glbAssetId: mediaAssetId }, select: { id: true, name: true, sku: true } }),
  ]);
  return [
    ...logos.map((l) => ({ type: "logo" as const, id: l.id, kind: l.kind, label: l.label })),
    ...downloads.map((d) => ({
      type: "download" as const,
      id: d.id,
      title: d.title,
      hubProductId: d.hubProductId,
      sku: d.hubProduct.sku,
    })),
    ...models.map((m) => ({
      type: "model3d" as const,
      hubProductId: m.id,
      name: m.name,
      sku: m.sku,
    })),
  ];
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

    const kind = kindForUpload(file.mimetype, file.originalname || "");
    if (!kind) {
      res.status(400).json({ error: "unsupported_type", detail: `Disallowed mimetype: ${file.mimetype}` });
      return;
    }
    if (kind !== "model" && file.size > MAX_BYTES_DEFAULT) {
      res.status(400).json({ error: "file_too_large", detail: "Max upload size is 25MB" });
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
 * GET /api/media?kind=image|file|model
 * Newest first, each with a resolved url and a usage count.
 */
mediaRouter.get("/media", async (req, res, next) => {
  try {
    const kindParam = req.query.kind;
    const where =
      kindParam === "image" || kindParam === "file" || kindParam === "model" ? { kind: kindParam } : {};

    const [assets, usage] = await Promise.all([
      prisma.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" } }),
      usageIndex(),
    ]);
    const result = await Promise.all(
      assets.map(async (a) => ({
        ...a,
        url: await resolveUrl(a.kind, a.storagePath),
        usage: usage.get(a.id) ?? 0,
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
      mediaReferences(asset.id),
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

    const references = await mediaReferences(asset.id);
    if (references.length > 0) {
      res.status(409).json({ error: "in_use", count: references.length, references });
      return;
    }

    const bucketKind = asset.kind === "image" || asset.kind === "model" ? asset.kind : "file";
    await removeObject(bucketKind, asset.storagePath);
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import {
  ALLOWED_FILE_MIME,
  ALLOWED_IMAGE_MIME,
  MAX_BYTES,
  createUploadTarget,
  objectInfo,
  removeObject,
  resolveUrl,
  type BucketKind,
} from "../services/storage.js";

export const mediaRouter = Router();

const IMAGE_MIME = new Set(ALLOWED_IMAGE_MIME);
const FILE_MIME = new Set(ALLOWED_FILE_MIME);
const MODEL_EXT = /\.glb$/i;

/**
 * GLB files have no reliable mimetype across browsers/OSes (commonly reported
 * as application/octet-stream), so a model is identified by its .glb
 * extension rather than mimetype sniffing.
 */
function kindForUpload(mimetype: string, filename: string): BucketKind | null {
  if (IMAGE_MIME.has(mimetype)) return "image";
  if (MODEL_EXT.test(filename)) return "model";
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

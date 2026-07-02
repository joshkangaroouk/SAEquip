import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { ensureHubProduct } from "../services/hubProduct.js";
import { resolveUrl } from "../services/storage.js";

export const downloadsRouter = Router();

const downloadInclude = {
  mediaAsset: true,
  _count: { select: { leads: true } },
} as const;

type DownloadWithAsset = Prisma.DownloadGetPayload<{ include: typeof downloadInclude }>;

async function shapeDownload(d: DownloadWithAsset) {
  return {
    id: d.id,
    title: d.title,
    gated: d.gated,
    sortOrder: d.sortOrder,
    mediaAssetId: d.mediaAssetId,
    file: {
      filename: d.mediaAsset.filename,
      mimeType: d.mediaAsset.mimeType,
      sizeBytes: d.mediaAsset.sizeBytes,
      url: await resolveUrl(d.mediaAsset.kind, d.mediaAsset.storagePath), // signed for admin preview
    },
    leadCount: d._count.leads,
  };
}

const createSchema = z
  .object({
    mediaAssetId: z.string().min(1),
    title: z.string().trim().min(1, "title required").max(200, "title max 200 chars"),
    gated: z.boolean().optional(),
  })
  .strict();

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    gated: z.boolean().optional(),
  })
  .strict();

const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)) }).strict();

/** GET /api/products/:id/downloads */
downloadsRouter.get("/products/:id/downloads", async (req, res, next) => {
  try {
    const hub = await ensureHubProduct(req.params.id);
    const downloads = await prisma.download.findMany({
      where: { hubProductId: hub.id },
      orderBy: { sortOrder: "asc" },
      include: downloadInclude,
    });
    res.json(await Promise.all(downloads.map(shapeDownload)));
  } catch (err) {
    next(err);
  }
});

/** POST /api/products/:id/downloads — attach a FILE MediaAsset as a download. */
downloadsRouter.post("/products/:id/downloads", async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const hub = await ensureHubProduct(req.params.id);
    const asset = await prisma.mediaAsset.findUnique({ where: { id: parsed.data.mediaAssetId } });
    if (!asset) {
      res.status(400).json({ error: "media_not_found", detail: "mediaAssetId does not exist" });
      return;
    }
    if (asset.kind !== "file") {
      res.status(400).json({ error: "not_a_file", detail: "download media must be a file" });
      return;
    }
    const max = await prisma.download.aggregate({
      where: { hubProductId: hub.id },
      _max: { sortOrder: true },
    });
    const created = await prisma.download.create({
      data: {
        hubProductId: hub.id,
        mediaAssetId: asset.id,
        title: parsed.data.title,
        gated: parsed.data.gated ?? true,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      include: downloadInclude,
    });
    res.status(201).json(await shapeDownload(created));
  } catch (err) {
    next(err);
  }
});

/** PUT /api/products/:id/downloads/reorder */
downloadsRouter.put("/products/:id/downloads/reorder", async (req, res, next) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const hub = await ensureHubProduct(req.params.id);
    const { orderedIds } = parsed.data;
    const existing = await prisma.download.findMany({
      where: { hubProductId: hub.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));
    const sameSet =
      orderedIds.length === existingIds.size &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => existingIds.has(id));
    if (!sameSet) {
      res.status(400).json({
        error: "invalid_order",
        detail: "orderedIds must be exactly the download ids for this product",
      });
      return;
    }
    await prisma.$transaction(
      orderedIds.map((id, i) => prisma.download.update({ where: { id }, data: { sortOrder: i } })),
    );
    const reordered = await prisma.download.findMany({
      where: { hubProductId: hub.id },
      orderBy: { sortOrder: "asc" },
      include: downloadInclude,
    });
    res.json(await Promise.all(reordered.map(shapeDownload)));
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/products/:id/downloads/:downloadId — update title/gated. */
downloadsRouter.patch("/products/:id/downloads/:downloadId", async (req, res, next) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const hub = await ensureHubProduct(req.params.id);
    const existing = await prisma.download.findFirst({
      where: { id: req.params.downloadId, hubProductId: hub.id },
    });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const data: Prisma.DownloadUpdateInput = {};
    if ("title" in parsed.data) data.title = parsed.data.title;
    if ("gated" in parsed.data) data.gated = parsed.data.gated;
    const updated = await prisma.download.update({
      where: { id: existing.id },
      data,
      include: downloadInclude,
    });
    res.json(await shapeDownload(updated));
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/products/:id/downloads/:downloadId
 * If the download has captured Leads, require ?force=true (else 409). Deleting
 * cascades Leads but NEVER touches the MediaAsset.
 */
downloadsRouter.delete("/products/:id/downloads/:downloadId", async (req, res, next) => {
  try {
    const hub = await ensureHubProduct(req.params.id);
    const dl = await prisma.download.findFirst({
      where: { id: req.params.downloadId, hubProductId: hub.id },
      include: { _count: { select: { leads: true } } },
    });
    if (!dl) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const leadCount = dl._count.leads;
    const force = req.query.force === "true";
    if (leadCount >= 1 && !force) {
      res.status(409).json({ error: "has_leads", leadCount });
      return;
    }
    await prisma.download.delete({ where: { id: dl.id } }); // Leads cascade; MediaAsset stays
    res.json({ deleted: true, deletedLeads: leadCount });
  } catch (err) {
    next(err);
  }
});

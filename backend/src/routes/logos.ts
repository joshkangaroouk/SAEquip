import { Router } from "express";
import { z } from "zod";
import { LogoKind, type Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { resolveUrl } from "../services/storage.js";

export const logosRouter = Router();

type LogoWithAssetCount = Prisma.LogoGetPayload<{
  include: { mediaAsset: true; _count: { select: { productLinks: true } } };
}>;

const logoInclude = {
  mediaAsset: true,
  _count: { select: { productLinks: true } },
} as const;

async function shapeLogo(logo: LogoWithAssetCount) {
  return {
    id: logo.id,
    kind: logo.kind,
    label: logo.label,
    alt: logo.alt,
    sortOrder: logo.sortOrder,
    mediaAssetId: logo.mediaAssetId,
    url: await resolveUrl(logo.mediaAsset.kind, logo.mediaAsset.storagePath),
    usage: logo._count.productLinks,
  };
}

function parseKind(value: unknown): LogoKind | null {
  return value === "SA_LOGO" || value === "CERT_LOGO" ? value : null;
}

/** GET /api/logos?kind=SA_LOGO|CERT_LOGO */
logosRouter.get("/logos", async (req, res, next) => {
  const kind = parseKind(req.query.kind);
  if (!kind) {
    res.status(400).json({ error: "invalid_kind", detail: "kind must be SA_LOGO or CERT_LOGO" });
    return;
  }
  try {
    const logos = await prisma.logo.findMany({
      where: { kind },
      orderBy: { sortOrder: "asc" },
      include: logoInclude,
    });
    res.json(await Promise.all(logos.map(shapeLogo)));
  } catch (err) {
    next(err);
  }
});

const createSchema = z
  .object({
    kind: z.enum(["SA_LOGO", "CERT_LOGO"]),
    mediaAssetId: z.string().min(1),
    label: z.string().trim().max(200).optional(),
    alt: z.string().trim().max(200).optional(),
  })
  .strict();

/** POST /api/logos — append a catalog entry referencing an existing image MediaAsset. */
logosRouter.post("/logos", async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const { kind, mediaAssetId, label, alt } = parsed.data;
    const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
    if (!asset) {
      res.status(400).json({ error: "media_not_found", detail: "mediaAssetId does not exist" });
      return;
    }
    if (asset.kind !== "image") {
      res.status(400).json({ error: "not_an_image", detail: "logo media must be an image" });
      return;
    }
    const max = await prisma.logo.aggregate({ where: { kind }, _max: { sortOrder: true } });
    const logo = await prisma.logo.create({
      data: {
        kind,
        mediaAssetId,
        label: label ?? null,
        alt: alt ?? null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      include: logoInclude,
    });
    res.status(201).json(await shapeLogo(logo));
  } catch (err) {
    next(err);
  }
});

const patchSchema = z
  .object({
    label: z.string().trim().max(200).nullable().optional(),
    alt: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

/** PATCH /api/logos/:id — update label/alt. */
logosRouter.patch("/logos/:id", async (req, res, next) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const existing = await prisma.logo.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const data: Prisma.LogoUpdateInput = {};
    if ("label" in parsed.data) data.label = parsed.data.label ?? null;
    if ("alt" in parsed.data) data.alt = parsed.data.alt ?? null;
    const logo = await prisma.logo.update({ where: { id: req.params.id }, data, include: logoInclude });
    res.json(await shapeLogo(logo));
  } catch (err) {
    next(err);
  }
});

const reorderSchema = z
  .object({
    kind: z.enum(["SA_LOGO", "CERT_LOGO"]),
    orderedIds: z.array(z.string().min(1)),
  })
  .strict();

/** PUT /api/logos/reorder — set sortOrder = index for the given kind. */
logosRouter.put("/logos/reorder", async (req, res, next) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const { kind, orderedIds } = parsed.data;
    const existing = await prisma.logo.findMany({ where: { kind }, select: { id: true } });
    const existingIds = new Set(existing.map((e) => e.id));
    const sameSet =
      orderedIds.length === existingIds.size &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => existingIds.has(id));
    if (!sameSet) {
      res.status(400).json({
        error: "invalid_order",
        detail: "orderedIds must be exactly the set of logo ids for this kind",
      });
      return;
    }
    await prisma.$transaction(
      orderedIds.map((id, i) => prisma.logo.update({ where: { id }, data: { sortOrder: i } })),
    );
    const reordered = await prisma.logo.findMany({
      where: { kind },
      orderBy: { sortOrder: "asc" },
      include: logoInclude,
    });
    res.json(await Promise.all(reordered.map(shapeLogo)));
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/logos/:id — remove the catalog entry (joins cascade); keep the MediaAsset. */
logosRouter.delete("/logos/:id", async (req, res, next) => {
  try {
    const logo = await prisma.logo.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { productLinks: true } } },
    });
    if (!logo) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const unlinkedFromProducts = logo._count.productLinks;
    await prisma.logo.delete({ where: { id: logo.id } });
    res.json({ deleted: true, unlinkedFromProducts });
  } catch (err) {
    next(err);
  }
});

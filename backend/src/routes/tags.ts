import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const tagsRouter = Router();

/**
 * Tags — a Hub-owned label for grouping products. Duda has no equivalent, so
 * unlike categories there is nothing upstream to reconcile with.
 */

/** Lowercase, hyphenated, no runs or edges — safe for a future /tag/<slug>. */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const tagBody = z
  .object({
    name: z.string().trim().min(1, "name is required").max(80, "max 80 characters"),
  })
  .strict();

/** GET /api/tags — every tag, with how many products use it. */
tagsRouter.get("/tags", async (_req, res, next) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json(
      tags.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        sortOrder: t.sortOrder,
        productCount: t._count.products,
      })),
    );
  } catch (err) {
    next(err);
  }
});

tagsRouter.post("/tags", async (req, res, next) => {
  const parsed = tagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const name = parsed.data.name;
    const slug = slugify(name);
    if (!slug) {
      res.status(400).json({ error: "validation_error", detail: "Name must contain a letter or number." });
      return;
    }
    // Checked explicitly so the message names the clash, rather than letting
    // the unique constraint surface as a generic 409.
    const clash = await prisma.tag.findFirst({ where: { OR: [{ name }, { slug }] } });
    if (clash) {
      res.status(409).json({ error: "duplicate_tag", detail: `“${clash.name}” already exists.` });
      return;
    }
    const max = await prisma.tag.aggregate({ _max: { sortOrder: true } });
    const tag = await prisma.tag.create({
      data: { name, slug, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
    res.status(201).json({ ...tag, productCount: 0 });
  } catch (err) {
    next(err);
  }
});

tagsRouter.patch("/tags/:id", async (req, res, next) => {
  const parsed = tagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const name = parsed.data.name;
    const slug = slugify(name);
    const clash = await prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }], NOT: { id: req.params.id } },
    });
    if (clash) {
      res.status(409).json({ error: "duplicate_tag", detail: `“${clash.name}” already exists.` });
      return;
    }
    const tag = await prisma.tag.update({ where: { id: req.params.id }, data: { name, slug } });
    res.json(tag);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tags/:id
 *
 * ProductTag cascades, so deleting a tag detaches it everywhere. That is
 * destructive and silent from the product's side, so the count comes back in
 * the response for the UI to have warned about first.
 */
tagsRouter.delete("/tags/:id", async (req, res, next) => {
  try {
    const used = await prisma.productTag.count({ where: { tagId: req.params.id } });
    await prisma.tag.delete({ where: { id: req.params.id } });
    res.json({ ok: true, detachedFrom: used });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/tags/reorder — full ordering, array position wins. */
const reorderBody = z.object({ ids: z.array(z.string().min(1)).max(500) }).strict();

tagsRouter.put("/tags/reorder", async (req, res, next) => {
  const parsed = reorderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    await prisma.$transaction(
      parsed.data.ids.map((id, i) => prisma.tag.update({ where: { id }, data: { sortOrder: i } })),
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

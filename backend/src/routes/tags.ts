import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const tagsRouter = Router();

/**
 * Tags — a Hub-owned label for grouping products. Duda has no equivalent, so
 * unlike categories there is nothing upstream to reconcile with.
 *
 * Tags belong to at most one TagGroup ("Industries", "Site Problems"). A tag
 * with no group is "Ungrouped" and sorts last everywhere.
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

const nameBody = z
  .object({
    name: z.string().trim().min(1, "name is required").max(80, "max 80 characters"),
  })
  .strict();

/** Create/patch a tag: a name, and optionally which group it sits in. */
const tagBody = nameBody.extend({ groupId: z.string().min(1).nullable().optional() }).strict();

const reorderBody = z.object({ ids: z.array(z.string().min(1)).max(500) }).strict();

/* ------------------------------------------------------------- groups -- */

/** GET /api/tag-groups — every group, with how many tags it holds. */
tagsRouter.get("/tag-groups", async (_req, res, next) => {
  try {
    const groups = await prisma.tagGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { tags: true } } },
    });
    res.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        sortOrder: g.sortOrder,
        tagCount: g._count.tags,
      })),
    );
  } catch (err) {
    next(err);
  }
});

tagsRouter.post("/tag-groups", async (req, res, next) => {
  const parsed = nameBody.safeParse(req.body);
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
    const clash = await prisma.tagGroup.findFirst({ where: { OR: [{ name }, { slug }] } });
    if (clash) {
      res.status(409).json({ error: "duplicate_group", detail: `“${clash.name}” already exists.` });
      return;
    }
    const max = await prisma.tagGroup.aggregate({ _max: { sortOrder: true } });
    const group = await prisma.tagGroup.create({
      data: { name, slug, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
    res.status(201).json({ ...group, tagCount: 0 });
  } catch (err) {
    next(err);
  }
});

tagsRouter.patch("/tag-groups/:id", async (req, res, next) => {
  const parsed = nameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const name = parsed.data.name;
    const slug = slugify(name);
    const clash = await prisma.tagGroup.findFirst({
      where: { OR: [{ name }, { slug }], NOT: { id: req.params.id } },
    });
    if (clash) {
      res.status(409).json({ error: "duplicate_group", detail: `“${clash.name}” already exists.` });
      return;
    }
    const group = await prisma.tagGroup.update({ where: { id: req.params.id }, data: { name, slug } });
    res.json(group);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tag-groups/:id
 *
 * ⚠️ The tags SURVIVE and fall back to Ungrouped — Tag.groupId is SetNull, not
 * Cascade. Cascading here would reach ProductTag and silently destroy every
 * product assignment beneath the group, losing real content to fix a naming
 * mistake. The count comes back so the UI can say "n tags become ungrouped"
 * rather than implying they are deleted.
 */
tagsRouter.delete("/tag-groups/:id", async (req, res, next) => {
  try {
    const orphaned = await prisma.tag.count({ where: { groupId: req.params.id } });
    await prisma.tagGroup.delete({ where: { id: req.params.id } });
    res.json({ ok: true, orphaned });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/tag-groups/reorder — full ordering, array position wins. */
tagsRouter.put("/tag-groups/reorder", async (req, res, next) => {
  const parsed = reorderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    await prisma.$transaction(
      parsed.data.ids.map((id, i) => prisma.tagGroup.update({ where: { id }, data: { sortOrder: i } })),
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------------------- tags -- */

/**
 * GET /api/tags — every tag, with its group and how many products use it.
 *
 * A FLAT, pre-ordered array: group order, then tag order within the group,
 * with ungrouped last. Ordering is derived once here rather than in each
 * consumer, the same contract `buildTree()` in routes/categories.ts uses and
 * for the same reason — the Tags page and the product editor's picker must
 * agree. Keeping it an array also means neither had to reshape its fetch.
 */
tagsRouter.get("/tags", async (_req, res, next) => {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        _count: { select: { products: true } },
        group: { select: { id: true, name: true, slug: true, sortOrder: true } },
      },
    });
    // Sorted here rather than in the query: "ungrouped last" is not something
    // `orderBy` expresses, since a null groupId has no sortOrder to sort on.
    const ordered = tags.sort((a, b) => {
      const ga = a.group?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const gb = b.group?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (ga !== gb) return ga - gb;
      const gn = (a.group?.name ?? "").localeCompare(b.group?.name ?? "");
      if (gn !== 0) return gn;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
    res.json(
      ordered.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        sortOrder: t.sortOrder,
        productCount: t._count.products,
        groupId: t.group?.id ?? null,
        groupName: t.group?.name ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

/** Reject a groupId that does not exist, rather than storing a dangling one. */
async function groupMissing(groupId: string | null | undefined): Promise<boolean> {
  if (!groupId) return false;
  return (await prisma.tagGroup.count({ where: { id: groupId } })) === 0;
}

/** Next free sortOrder WITHIN a group — see the note on Logo.sortOrder. */
async function nextSortOrder(groupId: string | null): Promise<number> {
  const max = await prisma.tag.aggregate({ where: { groupId }, _max: { sortOrder: true } });
  return (max._max.sortOrder ?? -1) + 1;
}

tagsRouter.post("/tags", async (req, res, next) => {
  const parsed = tagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const { name } = parsed.data;
    const groupId = parsed.data.groupId ?? null;
    const slug = slugify(name);
    if (!slug) {
      res.status(400).json({ error: "validation_error", detail: "Name must contain a letter or number." });
      return;
    }
    if (await groupMissing(groupId)) {
      res.status(400).json({ error: "unknown_group", detail: "No such tag group." });
      return;
    }
    // Checked explicitly so the message names the clash, rather than letting
    // the unique constraint surface as a generic 409. Still GLOBAL, not
    // per-group: the slug is what the Duda widget stores and what
    // /public/products/by-tag resolves.
    const clash = await prisma.tag.findFirst({ where: { OR: [{ name }, { slug }] } });
    if (clash) {
      res.status(409).json({ error: "duplicate_tag", detail: `“${clash.name}” already exists.` });
      return;
    }
    const tag = await prisma.tag.create({
      data: { name, slug, groupId, sortOrder: await nextSortOrder(groupId) },
    });
    res.status(201).json({ ...tag, productCount: 0, groupName: null });
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
    const { name } = parsed.data;
    const slug = slugify(name);
    const clash = await prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }], NOT: { id: req.params.id } },
    });
    if (clash) {
      res.status(409).json({ error: "duplicate_tag", detail: `“${clash.name}” already exists.` });
      return;
    }

    const data: { name: string; slug: string; groupId?: string | null; sortOrder?: number } = { name, slug };

    // `groupId` absent means "leave the group alone"; explicit null means
    // "move to Ungrouped". `in` distinguishes them — `?? null` would silently
    // ungroup a tag on a plain rename.
    if ("groupId" in parsed.data) {
      const groupId = parsed.data.groupId ?? null;
      if (await groupMissing(groupId)) {
        res.status(400).json({ error: "unknown_group", detail: "No such tag group." });
        return;
      }
      const current = await prisma.tag.findUnique({ where: { id: req.params.id }, select: { groupId: true } });
      if (current && current.groupId !== groupId) {
        data.groupId = groupId;
        // Re-appended, because sortOrder is per group: keeping the old number
        // would drop it into the middle of the new group, or collide.
        data.sortOrder = await nextSortOrder(groupId);
      }
    }

    const tag = await prisma.tag.update({ where: { id: req.params.id }, data });
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

/**
 * PUT /api/tags/reorder — full ordering WITHIN one group, array position wins.
 *
 * ⚠️ `ids` must be exactly the id set for `groupId`, following the same check
 * `routes/logos.ts` makes per kind. Without it a stale tab reordering one
 * group would renumber tags in another, and the two orders would silently
 * interleave.
 */
const tagReorderBody = z
  .object({ groupId: z.string().min(1).nullable(), ids: z.array(z.string().min(1)).max(500) })
  .strict();

tagsRouter.put("/tags/reorder", async (req, res, next) => {
  const parsed = tagReorderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const { groupId, ids } = parsed.data;
    const inGroup = await prisma.tag.findMany({ where: { groupId }, select: { id: true } });
    const expected = new Set(inGroup.map((t) => t.id));
    const same = ids.length === expected.size && ids.every((id) => expected.has(id));
    if (!same) {
      res.status(400).json({
        error: "invalid_order",
        detail: `Expected exactly the ${expected.size} tag(s) in that group, got ${ids.length}.`,
      });
      return;
    }
    await prisma.$transaction(
      ids.map((id, i) => prisma.tag.update({ where: { id }, data: { sortOrder: i } })),
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

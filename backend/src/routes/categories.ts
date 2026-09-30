import { Router } from "express";
import { z } from "zod";
import { CATEGORY_ROOT, duda, type DudaCategorySummary } from "../services/duda.js";
import { prisma } from "../prisma.js";

export const categoriesRouter = Router();

const seoSchema = z
  .object({
    url: z.string().trim().max(200).optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
  })
  .strict();

const createSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(200, "title max 200 chars"),
    // "ROOT" (or omitted) makes it a top-level category.
    parent_id: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    image: z
      .object({ url: z.string().trim().url("must be an absolute URL"), alt: z.string().max(300).optional() })
      .strict()
      .nullable()
      .optional(),
    seo: seoSchema.optional(),
  })
  .strict();

const updateSchema = createSchema.partial().strict();

/** A category plus the derived tree metadata Duda doesn't give us. */
interface CategoryNode extends DudaCategorySummary {
  depth: number;
  subcategoryCount: number;
  /**
   * ⚠️ From the MIRROR, not from Duda. `listAllCategories()` omits the image
   * entirely and only the single-category GET carries it, so showing a
   * thumbnail per row would otherwise cost one Duda call per category on every
   * page load. Null for a category never synced or written from here.
   */
  imageUrl?: string | null;
}

/**
 * Duda returns categories flat with a `parent_id`, so the tree is derived here
 * rather than in the browser — the UI needs stable ordering and depth, and
 * doing it once server-side keeps every consumer consistent.
 *
 * Orphans (a parent_id pointing at something absent) are surfaced at the root
 * instead of being silently dropped.
 */
/**
 * Top-level order for the DASHBOARD's tree.
 *
 * ⚠️ Duda has no `sortOrder` on a category and its own list order is creation
 * order — newest first — which puts Products, the branch people assign from
 * most, at the bottom. Listed titles come first in this order; anything
 * unlisted keeps Duda's order after them, so renaming a parent demotes it
 * rather than breaking the list.
 *
 * This is display order only. It does not touch Duda, and the megamenu's
 * column order is still arranged in Duda's own menu editor.
 */
const TOP_LEVEL_ORDER = ["products", "site challenges", "industries"];

/**
 * @param order Hub-owned position per category id. Sparse: a category nobody
 *   has dragged has no row, and keeps its fallback place.
 */
function buildTree(
  flat: DudaCategorySummary[],
  order: Map<string, number>,
  images: Map<string, string | null>,
): CategoryNode[] {
  const byParent = new Map<string, DudaCategorySummary[]>();
  for (const c of flat) {
    const key = c.parent_id || CATEGORY_ROOT;
    const bucket = byParent.get(key);
    if (bucket) bucket.push(c);
    else byParent.set(key, [c]);
  }

  const known = new Set(flat.map((c) => c.id));
  const ordered: CategoryNode[] = [];

  const walk = (parentId: string, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      ordered.push({
        ...c,
        depth,
        subcategoryCount: (byParent.get(c.id) ?? []).length,
        imageUrl: images.get(c.id) ?? null,
      });
      walk(c.id, depth + 1);
    }
  };

  /*
   * Order within a parent, most specific first:
   *   1. a Hub position someone set by dragging,
   *   2. TOP_LEVEL_ORDER, for the three roots nobody has dragged yet,
   *   3. Duda's own list order, which is creation order, newest first.
   *
   * ⚠️ Every sort is STABLE, so anything with no rule at all keeps Duda's
   * relative order rather than being shuffled. A dragged category sorts ahead
   * of an undragged one — there is no meaningful way to interleave the two,
   * and the alternative is a new category silently landing mid-list.
   */
  const rank = (c: DudaCategorySummary) => {
    const i = TOP_LEVEL_ORDER.indexOf(c.title.trim().toLowerCase());
    return i === -1 ? TOP_LEVEL_ORDER.length : i;
  };
  for (const [parentId, bucket] of byParent) {
    const fallback = (c: DudaCategorySummary) =>
      parentId === CATEGORY_ROOT ? rank(c) : Number.MAX_SAFE_INTEGER;
    byParent.set(
      parentId,
      [...bucket].sort((a, b) => {
        const oa = order.get(a.id);
        const ob = order.get(b.id);
        if (oa != null && ob != null) return oa - ob;
        if (oa != null) return -1;
        if (ob != null) return 1;
        return fallback(a) - fallback(b);
      }),
    );
  }

  walk(CATEGORY_ROOT, 0);

  // Anything whose parent doesn't exist would otherwise never be walked.
  for (const c of flat) {
    if (c.parent_id === CATEGORY_ROOT || known.has(c.parent_id)) continue;
    ordered.push({
      ...c,
      depth: 0,
      subcategoryCount: (byParent.get(c.id) ?? []).length,
      imageUrl: images.get(c.id) ?? null,
    });
  }

  return ordered;
}

/**
 * GET /api/categories
 * The whole catalog as a depth-annotated, pre-ordered flat list ready to render
 * as a tree.
 */
categoriesRouter.get("/categories", async (_req, res, next) => {
  try {
    const flat = await duda.listAllCategories();
    const [orderRows, mirrorRows] = await Promise.all([
      prisma.categoryOrder.findMany(),
      prisma.categoryMirror.findMany({ select: { dudaCategoryId: true, imageUrl: true } }),
    ]);
    const order = new Map(orderRows.map((o) => [o.dudaCategoryId, o.sortOrder]));
    const images = new Map(mirrorRows.map((m) => [m.dudaCategoryId, m.imageUrl]));
    res.json({ count: flat.length, categories: buildTree(flat, order, images) });
  } catch (err) {
    next(err);
  }
});

/**
 * Record a category's image in the mirror right after writing it to Duda.
 *
 * ⚠️ Duda RE-HOSTS the image on its own CDN, so the URL to store is the one
 * Duda reports back, never the one we sent. Best-effort: a mirror that misses
 * an update shows a stale thumbnail on one admin screen, which must not fail
 * the write that actually landed.
 */
async function mirrorImage(id: string): Promise<void> {
  try {
    const full = (await duda.getCategory(id)) as unknown as {
      title: string;
      parent_id: string;
      image?: { url?: string } | null;
      seo?: { url?: string };
    };
    const data = {
      title: full.title,
      slug: full.seo?.url ?? id,
      parentId: full.parent_id || CATEGORY_ROOT,
      imageUrl: full.image?.url ?? null,
    };
    await prisma.categoryMirror.upsert({
      where: { dudaCategoryId: id },
      update: data,
      create: { dudaCategoryId: id, position: 0, ...data },
    });
  } catch {
    /* the write to Duda succeeded; a stale thumbnail is not worth a 500 */
  }
}

const reorderSchema = z
  .object({
    /** "ROOT" for the top level. */
    parentId: z.string().trim().min(1),
    ids: z.array(z.string().trim().min(1)).min(1).max(500),
  })
  .strict();

/**
 * PUT /api/categories/reorder
 * Set the display order of one parent's children.
 *
 * ⚠️ HUB-ONLY. Duda has no ordering field — see the CategoryOrder model for
 * the probe. This drives the dashboard and anything the Hub renders; Duda's
 * own storefront and the megamenu are ordered in Duda's menu editor.
 *
 * ⚠️ Rejects an id set that is not EXACTLY that parent's children, rather than
 * ignoring strays. The same guard `routes/logos.ts` makes: without it a stale
 * tab can renumber a sibling group it was not even showing, and re-parenting
 * by drag — which the UI deliberately does not offer — would arrive here
 * looking like an ordinary reorder.
 */
categoriesRouter.put("/categories/reorder", async (req, res, next) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const { parentId, ids } = parsed.data;

  try {
    const flat = await duda.listAllCategories();
    const siblings = flat
      .filter((c) => (c.parent_id || CATEGORY_ROOT) === parentId)
      .map((c) => c.id);

    const given = new Set(ids);
    if (given.size !== ids.length) {
      res.status(400).json({ error: "Duplicate category id in the order" });
      return;
    }
    const missing = siblings.filter((id) => !given.has(id));
    const foreign = ids.filter((id) => !siblings.includes(id));
    if (missing.length || foreign.length) {
      res.status(400).json({
        error:
          `The order must list exactly this parent's children. ` +
          `${missing.length} missing, ${foreign.length} not a child of ${parentId}. ` +
          `Reload the page and try again.`,
      });
      return;
    }

    // Dense 0..n-1, rewritten wholesale for this parent — the positions are
    // only ever compared to siblings, so gaps would be harmless but confusing.
    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.categoryOrder.upsert({
          where: { dudaCategoryId: id },
          update: { sortOrder: i },
          create: { dudaCategoryId: id, sortOrder: i },
        }),
      ),
    );

    const [orderRows, mirrorRows] = await Promise.all([
      prisma.categoryOrder.findMany(),
      prisma.categoryMirror.findMany({ select: { dudaCategoryId: true, imageUrl: true } }),
    ]);
    const order = new Map(orderRows.map((o) => [o.dudaCategoryId, o.sortOrder]));
    const images = new Map(mirrorRows.map((m) => [m.dudaCategoryId, m.imageUrl]));
    res.json({ count: flat.length, categories: buildTree(flat, order, images) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/categories/:id
 * The only shape carrying description, image and seo.
 */
categoriesRouter.get("/categories/:id", async (req, res, next) => {
  try {
    res.json(await duda.getCategory(req.params.id));
  } catch (err) {
    next(err);
  }
});

categoriesRouter.post("/categories", async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    // Guard the parent before writing: Duda's own error for a bad parent_id is
    // opaque, and a typo would otherwise create a category orphaned off-tree.
    const parentId = parsed.data.parent_id ?? CATEGORY_ROOT;
    if (parentId !== CATEGORY_ROOT) {
      const existing = await duda.listAllCategories();
      if (!existing.some((c) => c.id === parentId)) {
        res.status(400).json({
          error: "unknown_parent",
          detail: `No category with id ${parentId} exists to nest this under.`,
        });
        return;
      }
    }

    const created = await duda.createCategory(parsed.data);
    await mirrorImage(created.id);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

categoriesRouter.patch("/categories/:id", async (req, res, next) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    const nextParent = parsed.data.parent_id;
    if (nextParent && nextParent !== CATEGORY_ROOT) {
      if (nextParent === req.params.id) {
        res.status(400).json({
          error: "invalid_parent",
          detail: "A category can't be its own parent.",
        });
        return;
      }
      // Re-parenting under one's own descendant would detach the whole subtree
      // from the root, making it unreachable in the UI.
      const flat = await duda.listAllCategories();
      const descendants = new Set<string>();
      const collect = (id: string) => {
        for (const c of flat) {
          if (c.parent_id === id && !descendants.has(c.id)) {
            descendants.add(c.id);
            collect(c.id);
          }
        }
      };
      collect(req.params.id);
      if (descendants.has(nextParent)) {
        res.status(400).json({
          error: "invalid_parent",
          detail: "That would move the category inside one of its own subcategories.",
        });
        return;
      }
      if (!flat.some((c) => c.id === nextParent)) {
        res.status(400).json({ error: "unknown_parent", detail: `No category with id ${nextParent}.` });
        return;
      }
    }

    // `seo` is a FULL REPLACEMENT on Duda's side, exactly like the product's:
    // PATCHing it without `url` blanks the page URL and Duda rejects with
    // "Category page url cannot be blank". Merge over the current value so a
    // caller can change just the title or description.
    const payload = { ...parsed.data };
    if (payload.seo) {
      const current = await duda.getCategory(req.params.id);
      payload.seo = { ...current.seo, ...payload.seo };
    }

    const updated = await duda.updateCategory(req.params.id, payload);
    await mirrorImage(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/categories/:id?confirm=true
 * Reports what else goes with it — Duda gives no warning about subcategories.
 */
categoriesRouter.delete("/categories/:id", async (req, res, next) => {
  try {
    const flat = await duda.listAllCategories();
    const children = flat.filter((c) => c.parent_id === req.params.id);

    if (children.length > 0 && req.query.confirm !== "true") {
      res.status(409).json({
        error: "has_subcategories",
        detail: `This category has ${children.length} subcategor${children.length === 1 ? "y" : "ies"}.`,
        subcategories: children.map((c) => ({ id: c.id, title: c.title })),
      });
      return;
    }

    await duda.deleteCategory(req.params.id);
    /*
     * Both Hub-side tables are keyed on the Duda id with no foreign key —
     * categories live in Duda — so nothing cascades. A left-behind
     * CategoryOrder row would silently reposition whichever category Duda
     * later hands that id to, and a stale mirror row would show a thumbnail
     * for a category that no longer exists.
     */
    await Promise.all([
      prisma.categoryOrder.deleteMany({ where: { dudaCategoryId: req.params.id } }),
      prisma.categoryMirror.deleteMany({ where: { dudaCategoryId: req.params.id } }),
    ]);
    res.json({ deleted: true, subcategoriesAffected: children.length });
  } catch (err) {
    next(err);
  }
});

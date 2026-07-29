import { Router } from "express";
import { z } from "zod";
import { CATEGORY_ROOT, duda, type DudaCategorySummary } from "../services/duda.js";

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
}

/**
 * Duda returns categories flat with a `parent_id`, so the tree is derived here
 * rather than in the browser — the UI needs stable ordering and depth, and
 * doing it once server-side keeps every consumer consistent.
 *
 * Orphans (a parent_id pointing at something absent) are surfaced at the root
 * instead of being silently dropped.
 */
function buildTree(flat: DudaCategorySummary[]): CategoryNode[] {
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
      ordered.push({ ...c, depth, subcategoryCount: (byParent.get(c.id) ?? []).length });
      walk(c.id, depth + 1);
    }
  };

  walk(CATEGORY_ROOT, 0);

  // Anything whose parent doesn't exist would otherwise never be walked.
  for (const c of flat) {
    if (c.parent_id === CATEGORY_ROOT || known.has(c.parent_id)) continue;
    ordered.push({ ...c, depth: 0, subcategoryCount: (byParent.get(c.id) ?? []).length });
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
    res.json({ count: flat.length, categories: buildTree(flat) });
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

    res.status(201).json(await duda.createCategory(parsed.data));
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

    res.json(await duda.updateCategory(req.params.id, payload));
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
    res.json({ deleted: true, subcategoriesAffected: children.length });
  } catch (err) {
    next(err);
  }
});

import { Router } from "express";
import { z } from "zod";
import { LogoKind, TextItemKind } from "@prisma/client";
import { duda, type DudaPrice, type DudaProductUpdate } from "../services/duda.js";
import { ensureHubProduct, findSlugConflict, syncHubProduct } from "../services/hubProduct.js";
import { resolveUrl } from "../services/storage.js";
import { cartesianSize, updateOptionsPreservingVariations } from "../services/productOptions.js";
import { prisma } from "../prisma.js";
import { env } from "../env.js";

/** A non-negative numeric string, e.g. "400.0". */
const priceString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "must be a numeric string")
  .refine((s) => parseFloat(s) >= 0, "must be >= 0");

const priceItemSchema = z
  .object({
    price: priceString,
    compare_at_price: priceString.nullable().optional(),
  })
  .strict()
  .refine(
    (p) => p.compare_at_price == null || parseFloat(p.compare_at_price) > parseFloat(p.price),
    { message: "compare_at_price must be greater than price", path: ["compare_at_price"] },
  );

/** Mirrors the allowed editable keys. `.strict()` rejects any unknown key. */
const updateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    sku: z.string().optional(),
    type: z.enum(["PHYSICAL", "DIGITAL", "SERVICE", "DONATION"]).optional(),
    status: z.enum(["ACTIVE", "HIDDEN"]).optional(),
    stock_status: z.enum(["IN_STOCK", "OUT_OF_STOCK"]).optional(),
    requires_shipping: z.boolean().optional(),
    managed_inventory: z.boolean().optional(),
    quantity: z.number().int().min(0).optional(),
    prices: z.array(priceItemSchema).optional(),
    seo: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        product_url: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Attached option set: each option plus the choices this product exposes. */
const optionsBody = z
  .object({
    options: z
      .array(
        z
          .object({
            id: z.string().min(1),
            choiceIds: z.array(z.string().min(1)).min(1, "select at least one choice"),
          })
          .strict(),
      )
      .max(20, "max 20 options"),
  })
  .strict();

/** Sparse variation edits, keyed by the generated variation id. */
const variationsBody = z
  .object({
    variations: z
      .array(
        z
          .object({
            id: z.string().min(1),
            sku: z.string().max(100).optional(),
            price_difference: z
              .string()
              .regex(/^-?\d+(\.\d+)?$/, "must be a number")
              .optional(),
            status: z.enum(["ACTIVE", "HIDDEN"]).optional(),
          })
          .strict(),
      )
      .max(300, "max 300 variations"),
  })
  .strict();

/** New product. Status defaults to HIDDEN at the route, not here. */
const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    price: priceString,
    compare_at_price: priceString.nullable().optional(),
    sku: z.string().optional(),
    type: z.enum(["PHYSICAL", "DIGITAL", "SERVICE", "DONATION"]).default("PHYSICAL"),
    status: z.enum(["ACTIVE", "HIDDEN"]).default("HIDDEN"),
    description: z.string().optional(),
  })
  .strict()
  .refine(
    (p) => p.compare_at_price == null || parseFloat(p.compare_at_price) > parseFloat(p.price),
    { message: "compare_at_price must be greater than price", path: ["compare_at_price"] },
  );

/**
 * Product gallery — FULL replacement, order = array position.
 *
 * Duda fetches each URL server-side to re-host it, so the URL must be absolute
 * and publicly reachable. A relative path or a data: URI would fail inside
 * Duda with a far less obvious error than a 400 from here.
 */
const imageItemSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "url must not be blank")
      .refine((u) => {
        try {
          return ["http:", "https:"].includes(new URL(u).protocol);
        } catch {
          return false;
        }
      }, "must be an absolute http(s) URL that Duda can fetch"),
    alt: z.string().max(300, "alt max 300 chars").optional(),
  })
  .strict();

const imagesBody = z
  .object({ images: z.array(imageItemSchema).max(50, "max 50 images") })
  .strict();

// --- Hub content editors (replace-whole-set) ---

const specRowSchema = z
  .object({
    label: z.string().trim().min(1, "label must not be blank").max(200, "label max 200 chars"),
    value: z.string().trim().min(1, "value must not be blank").max(500, "value max 500 chars"),
  })
  .strict();
const specsBody = z.object({ rows: z.array(specRowSchema).max(100, "max 100 rows") }).strict();

const textItemSchema = z
  .object({ text: z.string().trim().min(1, "text must not be blank").max(500, "text max 500 chars") })
  .strict();
const itemsBody = z.object({ items: z.array(textItemSchema).max(100, "max 100 items") }).strict();

export const dudaRouter = Router();

/** "USD 400.0" from the first price, or null when there are none. */
function formatFirstPrice(prices: DudaPrice[] | undefined): string | null {
  const p = prices?.[0];
  return p ? `${p.currency} ${p.price}` : null;
}

/**
 * GET /api/store
 * Surfaces store headroom. max_products comes from the store; product_count is
 * the live product total (the store payload doesn't include it).
 */
dudaRouter.get("/store", async (_req, res, next) => {
  try {
    // limit:1 — we only need total_responses for the count, not the products.
    const [store, list] = await Promise.all([duda.getStore(), duda.listProducts({ limit: 1 })]);

    const max_products = store.features?.max_products ?? null;
    const product_count = list.total_responses ?? list.results.length;
    const remaining = max_products != null ? max_products - product_count : null;

    res.json({
      site_name: store.site_name ?? env.DUDA_SITE_NAME,
      max_products,
      product_count,
      remaining,
      // Needed by the options/variations editors. max_options is per-CATALOG
      // (shared across every product) and does not rise with the store plan.
      max_variations_per_product: store.features?.max_variations_per_product ?? null,
      max_options: store.features?.max_options ?? null,
      max_choices_per_option: store.features?.max_choices_per_option ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products
 * List of lightweight summaries for the products table.
 */
dudaRouter.get("/products", async (_req, res, next) => {
  try {
    // Pages internally — Duda clamps a single page to 200 and the store now
    // allows up to 1000 products, so one listProducts() call would truncate.
    const results = await duda.listAllProducts();

    const summaries = results.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      status: p.status,
      stock_status: p.stock_status,
      type: p.type,
      price: formatFirstPrice(p.prices),
      thumbnail: p.images?.[0]?.url ?? null,
      variation_count: p.variations?.length ?? 0,
    }));

    res.json(summaries);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products
 * Creates a product. Defaults to HIDDEN so a half-migrated product never goes
 * live mid-edit, which matters when bulk-importing the legacy catalog.
 */
dudaRouter.post("/products", async (req, res, next) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    // Pre-flight the store cap so we fail with a clear reason rather than a
    // raw Duda rejection.
    const [store, list] = await Promise.all([duda.getStore(), duda.listProducts({ limit: 1 })]);
    const max = store.features?.max_products ?? null;
    const count = list.total_responses ?? 0;
    if (max != null && count >= max) {
      res.status(409).json({
        error: "store_full",
        detail: `The store already holds ${count} of its ${max} products.`,
      });
      return;
    }

    const { price, compare_at_price, ...rest } = parsed.data;
    const created = await duda.createProduct({
      ...rest,
      prices: [{ price, compare_at_price: compare_at_price ?? null }],
    });
    await syncHubProduct(created);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id/delete-preview
 * What a delete would destroy vs. keep, so the confirm dialog can be specific.
 */
dudaRouter.get("/products/:id/delete-preview", async (req, res, next) => {
  try {
    const product = await duda.getProduct(req.params.id);
    const hub = await prisma.hubProduct.findUnique({
      where: { dudaProductId: req.params.id },
      include: {
        _count: { select: { specRows: true, textItems: true, logos: true, downloads: true } },
        downloads: { select: { _count: { select: { leads: true } } } },
      },
    });

    const leadCount = hub?.downloads.reduce((n, d) => n + d._count.leads, 0) ?? 0;

    res.json({
      name: product.name,
      sku: product.sku,
      // Destroyed with the product.
      destroys: {
        specRows: hub?._count.specRows ?? 0,
        textItems: hub?._count.textItems ?? 0,
        activeLogos: hub?._count.logos ?? 0,
        downloads: hub?._count.downloads ?? 0,
      },
      // Deliberately RETAINED — leads are business data and survive via a
      // SetNull FK plus their captured product/download snapshot.
      retains: { leads: leadCount },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/products/:id?confirm=true
 * Removes the product from Duda and its HubProduct row (cascading the hub
 * content). Captured leads survive with downloadId nulled.
 *
 * HubProduct is hard-deleted rather than soft-deleted because `slug` is unique
 * — a retained orphan row would permanently block re-creating that product URL.
 */
dudaRouter.delete("/products/:id", async (req, res, next) => {
  if (req.query.confirm !== "true") {
    res.status(400).json({
      error: "confirm_required",
      detail: "Pass ?confirm=true to delete this product.",
    });
    return;
  }

  try {
    await duda.deleteProduct(req.params.id);
    const hub = await prisma.hubProduct.findUnique({ where: { dudaProductId: req.params.id } });
    if (hub) await prisma.hubProduct.delete({ where: { id: hub.id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 * Full Duda product: native fields + options + variations. Duda custom_fields
 * are no longer decorated or used — custom content now lives in the hub DB.
 */
dudaRouter.get("/products/:id", async (req, res, next) => {
  try {
    const product = await duda.getProduct(req.params.id);
    // Drop Duda's raw custom_fields — custom content now lives in the hub DB.
    const { custom_fields: _omit, ...rest } = product;
    void _omit;
    res.json(rest);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/products/:id
 * Partial update of native fields ONLY. Validates against the allowed keys
 * (unknown keys -> 400), then returns the refreshed product in the same shape
 * as GET /api/products/:id. Never writes images/variations/custom_fields.
 */
dudaRouter.patch("/products/:id", async (req, res, next) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    // Guard the HubProduct.slug unique constraint BEFORE writing to Duda: Duda
    // may accept a duplicate product_url, and the public widget resolves
    // products by slug, so a collision would make two products ambiguous.
    const nextSlug = parsed.data.seo?.product_url;
    if (nextSlug !== undefined) {
      const clash = await findSlugConflict(nextSlug, req.params.id);
      if (clash) {
        res.status(409).json({
          error: "duplicate_slug",
          detail: `The URL slug "${nextSlug.trim()}" is already used by "${clash.name ?? clash.dudaProductId}".`,
        });
        return;
      }
    }

    const updated = await duda.updateProduct(req.params.id, parsed.data as DudaProductUpdate);
    // Keep the hub row's name/sku/slug in step — the public widget serves those
    // from HubProduct, so skipping this leaves the live site stale after a rename.
    await syncHubProduct(updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/products/:id/images
 * Replaces the whole gallery in one call. Kept off PATCH /products/:id so that
 * route retains its guarantee of never touching a collection.
 */
dudaRouter.put("/products/:id/images", async (req, res, next) => {
  const parsed = imagesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    const updated = await duda.updateProductImages(req.params.id, parsed.data.images);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/products/:id/options
 * Replaces the product's attached option set (each with its own choice subset).
 *
 * Duda regenerates variations from the cartesian product and BLANKS every sku /
 * price_difference in the process, so this carries that data across for any
 * combination that still exists and reports what it couldn't keep.
 */
dudaRouter.put("/products/:id/options", async (req, res, next) => {
  const parsed = optionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  const refs = parsed.data.options;
  const duplicateIds = refs.length !== new Set(refs.map((r) => r.id)).size;
  if (duplicateIds) {
    res.status(400).json({ error: "duplicate_option", detail: "Each option may be attached once." });
    return;
  }

  try {
    // Validate every option/choice id against the live catalog BEFORE writing.
    // Duda's own error for a bad id reads "option X does not have choice with
    // identifier X", which is close to undebuggable from the UI.
    const catalog = await duda.listOptions();
    const byId = new Map(catalog.results.map((o) => [o.id, o]));
    for (const ref of refs) {
      const option = byId.get(ref.id);
      if (!option) {
        res.status(400).json({
          error: "unknown_option",
          detail: `No option with id ${ref.id} exists in the store catalog.`,
        });
        return;
      }
      const valid = new Set(option.choices.map((c) => c.id));
      const bad = ref.choiceIds.filter((c) => !valid.has(c));
      if (bad.length > 0) {
        res.status(400).json({
          error: "unknown_choice",
          detail: `"${option.name}" has no choice with id ${bad.join(", ")}. Reload the product and try again.`,
          option: option.name,
          unknownChoiceIds: bad,
        });
        return;
      }
    }

    // Pre-flight the cartesian size against the store limit so we fail with a
    // number the user can act on rather than a raw Duda rejection.
    const projected = cartesianSize(refs);
    const store = await duda.getStore();
    const max = store.features?.max_variations_per_product ?? null;
    if (max != null && projected > max) {
      res.status(409).json({
        error: "variation_cap_exceeded",
        detail: `That combination would generate ${projected} variations, over the limit of ${max}.`,
        projected,
        max,
      });
      return;
    }

    const report = await updateOptionsPreservingVariations(req.params.id, refs);
    res.json({
      product: report.product,
      variationData: {
        restored: report.restored,
        dropped: report.dropped,
        failed: report.failed,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/products/:id/variations
 * Bulk-edits generated variations by id. There is no variations collection
 * endpoint upstream, so this loops and reports per-variation outcomes rather
 * than failing the whole request on one bad row.
 */
dudaRouter.put("/products/:id/variations", async (req, res, next) => {
  const parsed = variationsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    const current = await duda.getProduct(req.params.id);
    const known = new Set(current.variations.map((v) => v.id));
    const unknown = parsed.data.variations.filter((v) => !known.has(v.id)).map((v) => v.id);
    if (unknown.length > 0) {
      // Stale ids mean the option set changed underneath this edit — Duda
      // regenerates variations with new ids, so the client must reload.
      res.status(409).json({
        error: "stale_variations",
        detail:
          "Some variations no longer exist — the product's options changed since this page loaded. Reload and re-enter these values.",
        unknown,
      });
      return;
    }

    const failed: { id: string; error: string }[] = [];
    for (const v of parsed.data.variations) {
      const { id, ...partial } = v;
      try {
        await duda.patchVariation(req.params.id, id, partial);
      } catch (err) {
        failed.push({ id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const product = await duda.getProduct(req.params.id);
    if (failed.length > 0) {
      res.status(500).json({ error: "partial_variation_save", failed, product });
      return;
    }
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id/custom
 * Hub-side custom content for a product. Ensures the HubProduct row exists,
 * then returns the six content groups (all empty until editors are added).
 */
dudaRouter.get("/products/:id/custom", async (req, res, next) => {
  try {
    const hub = await ensureHubProduct(req.params.id);

    const full = await prisma.hubProduct.findUniqueOrThrow({
      where: { id: hub.id },
      include: {
        logos: { include: { logo: { include: { mediaAsset: true } } } },
        specRows: { orderBy: { sortOrder: "asc" } },
        textItems: { orderBy: { sortOrder: "asc" } },
        downloads: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    // Active logos come via the ProductLogo join → catalog Logo, in catalog order,
    // each with a resolved (public) image URL.
    const activeLogos = full.logos
      .map((link) => link.logo)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const shapedLogos = await Promise.all(
      activeLogos.map(async (l) => ({
        id: l.id,
        kind: l.kind,
        label: l.label,
        alt: l.alt,
        sortOrder: l.sortOrder,
        mediaAssetId: l.mediaAssetId,
        url: await resolveUrl(l.mediaAsset.kind, l.mediaAsset.storagePath),
      })),
    );

    const downloads = await Promise.all(
      full.downloads.map(async (d) => ({
        id: d.id,
        title: d.title,
        gated: d.gated,
        sortOrder: d.sortOrder,
        mediaAssetId: d.mediaAssetId,
        file: {
          filename: d.mediaAsset.filename,
          mimeType: d.mediaAsset.mimeType,
          sizeBytes: d.mediaAsset.sizeBytes,
          // Withhold the URL for gated downloads — the public widget fetches the
          // file only after lead capture (Step 11). Non-gated get a signed URL.
          url: d.gated ? null : await resolveUrl(d.mediaAsset.kind, d.mediaAsset.storagePath),
        },
      })),
    );

    res.json({
      hubProductId: full.id,
      dudaProductId: full.dudaProductId,
      sku: full.sku,
      name: full.name,
      logos: {
        sa: shapedLogos.filter((l) => l.kind === LogoKind.SA_LOGO),
        cert: shapedLogos.filter((l) => l.kind === LogoKind.CERT_LOGO),
      },
      specs: full.specRows,
      benefits: full.textItems.filter((t) => t.kind === TextItemKind.BENEFIT),
      applications: full.textItems.filter((t) => t.kind === TextItemKind.APPLICATION),
      downloads,
    });
  } catch (err) {
    next(err);
  }
});

/** Replace all text items of a kind for a hub product (transaction). */
async function replaceTextItems(
  hubProductId: string,
  kind: TextItemKind,
  items: { text: string }[],
) {
  return prisma.$transaction(async (tx) => {
    await tx.productTextItem.deleteMany({ where: { hubProductId, kind } });
    if (items.length > 0) {
      await tx.productTextItem.createMany({
        data: items.map((it, i) => ({ hubProductId, kind, text: it.text, sortOrder: i })),
      });
    }
    return tx.productTextItem.findMany({ where: { hubProductId, kind }, orderBy: { sortOrder: "asc" } });
  });
}

/**
 * PUT /api/products/:id/specs
 * Replaces the full SpecRow set for the hub product (sortOrder = array index).
 */
dudaRouter.put("/products/:id/specs", async (req, res, next) => {
  const parsed = specsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const hub = await ensureHubProduct(req.params.id);
    const rows = parsed.data.rows;
    const saved = await prisma.$transaction(async (tx) => {
      await tx.specRow.deleteMany({ where: { hubProductId: hub.id } });
      if (rows.length > 0) {
        await tx.specRow.createMany({
          data: rows.map((r, i) => ({ hubProductId: hub.id, label: r.label, value: r.value, sortOrder: i })),
        });
      }
      return tx.specRow.findMany({ where: { hubProductId: hub.id }, orderBy: { sortOrder: "asc" } });
    });
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/products/:id/benefits — replaces all BENEFIT text items. */
dudaRouter.put("/products/:id/benefits", async (req, res, next) => {
  const parsed = itemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const hub = await ensureHubProduct(req.params.id);
    const saved = await replaceTextItems(hub.id, TextItemKind.BENEFIT, parsed.data.items);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/products/:id/applications — replaces all APPLICATION text items. */
dudaRouter.put("/products/:id/applications", async (req, res, next) => {
  const parsed = itemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  try {
    const hub = await ensureHubProduct(req.params.id);
    const saved = await replaceTextItems(hub.id, TextItemKind.APPLICATION, parsed.data.items);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

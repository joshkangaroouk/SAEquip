import { Router } from "express";
import { z } from "zod";
import { LogoKind, TextItemKind } from "@prisma/client";
import { duda, type DudaPrice, type DudaProductUpdate } from "../services/duda.js";
import { ensureHubProduct } from "../services/hubProduct.js";
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
    const [store, list] = await Promise.all([
      duda.getStore(),
      duda.listProducts({ limit: 100 }),
    ]);

    const max_products = store.features?.max_products ?? null;
    const product_count = list.total_responses ?? list.results.length;
    const remaining = max_products != null ? max_products - product_count : null;

    res.json({
      site_name: store.site_name ?? env.DUDA_SITE_NAME,
      max_products,
      product_count,
      remaining,
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
    const list = await duda.listProducts({ limit: 100 });

    const summaries = list.results.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      status: p.status,
      stock_status: p.stock_status,
      type: p.type,
      price: formatFirstPrice(p.prices),
      thumbnail: p.images?.[0]?.url ?? null,
      variation_count: p.variations?.length ?? 0,
      custom_field_count: p.custom_fields?.length ?? 0,
    }));

    res.json(summaries);
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
    res.json(product);
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
    const updated = await duda.updateProduct(req.params.id, parsed.data as DudaProductUpdate);
    res.json(updated);
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
        logos: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
        specRows: { orderBy: { sortOrder: "asc" } },
        textItems: { orderBy: { sortOrder: "asc" } },
        downloads: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    res.json({
      hubProductId: full.id,
      dudaProductId: full.dudaProductId,
      sku: full.sku,
      name: full.name,
      logos: {
        sa: full.logos.filter((l) => l.kind === LogoKind.SA_LOGO),
        cert: full.logos.filter((l) => l.kind === LogoKind.CERT_LOGO),
      },
      specs: full.specRows,
      benefits: full.textItems.filter((t) => t.kind === TextItemKind.BENEFIT),
      applications: full.textItems.filter((t) => t.kind === TextItemKind.APPLICATION),
      downloads: full.downloads,
    });
  } catch (err) {
    next(err);
  }
});

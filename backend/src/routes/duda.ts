import { Router } from "express";
import { duda, type DudaPrice } from "../services/duda.js";
import { decorateCustomFields } from "../services/customFields.js";
import { prisma } from "../prisma.js";
import { env } from "../env.js";

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
 * Full product: native fields + options + variations + decorated custom_fields.
 */
dudaRouter.get("/products/:id", async (req, res, next) => {
  try {
    const product = await duda.getProduct(req.params.id);
    const maps = await prisma.customFieldMap.findMany();
    const custom_fields = decorateCustomFields(product.custom_fields ?? [], maps);

    res.json({ ...product, custom_fields });
  } catch (err) {
    next(err);
  }
});

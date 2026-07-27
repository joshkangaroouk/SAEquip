import type { HubProduct, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { duda, type DudaProduct } from "./duda.js";

/** Prisma client or an interactive transaction client. */
type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Upserts the HubProduct row from an ALREADY-FETCHED Duda product.
 *
 * Prefer this over ensureHubProduct() wherever the caller already holds the
 * product — a product page load used to make 2-3 identical Duda GETs because
 * every hub route re-fetched it just to sync sku/name/slug.
 *
 * Pass `db` to enrol the sync in a surrounding transaction.
 */
export function syncHubProduct(product: DudaProduct, db: Db = prisma): Promise<HubProduct> {
  const slug = product.seo?.product_url?.trim() || null;
  const fields = { sku: product.sku ?? null, name: product.name ?? null, slug };

  return db.hubProduct.upsert({
    where: { dudaProductId: product.id },
    create: { dudaProductId: product.id, ...fields },
    update: fields,
  });
}

/**
 * Ensures a HubProduct row exists for a given Duda product id, fetching the
 * live product to do it. Thin wrapper over syncHubProduct.
 */
export async function ensureHubProduct(dudaProductId: string): Promise<HubProduct> {
  const product = await duda.getProduct(dudaProductId);
  return syncHubProduct(product);
}

/**
 * Guards the `slug` unique constraint before a write that changes
 * seo.product_url. Duda may well accept a duplicate product_url, and if it
 * does, this pre-check is the only thing preventing two products the public
 * widget can't tell apart (it resolves products by slug).
 *
 * Returns the conflicting HubProduct, or null when the slug is free.
 */
export async function findSlugConflict(
  slug: string | null | undefined,
  forDudaProductId: string,
): Promise<HubProduct | null> {
  const trimmed = slug?.trim();
  if (!trimmed) return null;

  const existing = await prisma.hubProduct.findUnique({ where: { slug: trimmed } });
  return existing && existing.dudaProductId !== forDudaProductId ? existing : null;
}

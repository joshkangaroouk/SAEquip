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
export function syncHubProduct(
  product: DudaProduct,
  db: Db = prisma,
  /**
   * The description AS AUTHORED, when this write changed it. Duda only ever
   * receives a link-free copy (see `stripAnchors`), so its `description`
   * cannot be mirrored back here — the caller passes the original.
   */
  { descriptionHtml }: { descriptionHtml?: string } = {},
): Promise<HubProduct> {
  const slug = product.seo?.product_url?.trim() || null;
  // images[0] is Duda's thumbnail (documented: the array is ordered and its
  // first entry is what Duda shows). Mirrored so the compatible-products
  // widget can render a thumbnail for a product OTHER than the one on the
  // page, without the public endpoint calling Duda.
  const thumbnailUrl = product.images?.[0]?.url?.trim() || null;
  const fields = {
    sku: product.sku ?? null,
    name: product.name ?? null,
    slug,
    thumbnailUrl,
    // Mirrored so the public listings can leave HIDDEN products out without
    // calling Duda — see HubProduct.status.
    status: product.status ?? null,
    // Only when this write changed it: an unrelated rename must not touch it.
    ...(descriptionHtml !== undefined ? { descriptionHtml } : {}),
  };

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
/**
 * Prisma `where` for "may appear in a public listing".
 *
 * ⚠️ Spelled as an OR with null, NOT `{ status: { not: "HIDDEN" } }`: that
 * compiles to `status <> 'HIDDEN'`, which in SQL is NULL — false — for a row
 * never synced, and would silently drop every such product from the site.
 */
export const LISTABLE = { OR: [{ status: null }, { status: { not: "HIDDEN" } }] };

export async function findSlugConflict(
  slug: string | null | undefined,
  forDudaProductId: string,
): Promise<HubProduct | null> {
  const trimmed = slug?.trim();
  if (!trimmed) return null;

  const existing = await prisma.hubProduct.findUnique({ where: { slug: trimmed } });
  return existing && existing.dudaProductId !== forDudaProductId ? existing : null;
}

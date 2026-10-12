import type { HubProduct, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { duda, DudaApiError, type DudaProduct } from "./duda.js";

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
export async function syncHubProduct(
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

  if (slug) await releaseStaleSlug(slug, product.id, db);

  return db.hubProduct.upsert({
    where: { dudaProductId: product.id },
    create: { dudaProductId: product.id, ...fields },
    update: fields,
  });
}

/**
 * Free a slug held by a Hub row whose Duda product no longer exists.
 *
 * ⚠️ `HubProduct.slug` is unique, and a product deleted IN DUDA (not through
 * the Hub, which hard-deletes the row) leaves its row behind holding the
 * slug. A new product Duda then gives the same slug failed every sync with
 * P2002 — so it could not be opened in the editor at all (fixed 2026-10-12).
 * Only a definite 404 from Duda frees the slug; any other answer leaves the
 * row alone and the usual `duplicate_slug` 409 stands.
 */
async function releaseStaleSlug(slug: string, ownerDudaId: string, db: Db): Promise<void> {
  const holder = await db.hubProduct.findFirst({
    where: { slug, NOT: { dudaProductId: ownerDudaId } },
    select: { id: true, dudaProductId: true },
  });
  if (!holder) return;
  try {
    await duda.getProduct(holder.dudaProductId);
    return; // still a live product: a genuine clash, reported as before
  } catch (err) {
    if (!(err instanceof DudaApiError) || err.status !== 404) return;
  }
  console.warn(`[hub] slug "${slug}" freed from a Hub row whose Duda product ${holder.dudaProductId} no longer exists`);
  await db.hubProduct.update({ where: { id: holder.id }, data: { slug: null } });
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
 * Prisma `where` for "may appear in a public listing".
 *
 * ⚠️ Spelled as an OR with null, NOT `{ status: { not: "HIDDEN" } }`: that
 * compiles to `status <> 'HIDDEN'`, which in SQL is NULL — false — for a row
 * never synced, and would silently drop every such product from the site.
 */
export const LISTABLE = { OR: [{ status: null }, { status: { not: "HIDDEN" } }] };

/**
 * Which downloads appear on the public resources pages: typed (an untyped
 * download is on no page) and on a product whose own page is public — a HIDDEN
 * product's certificate must not be listed or requestable by its id.
 *
 * Gated or not. A gated one is listed with its form; an ungated one links
 * straight to the file. One definition for the list, the file route and the
 * request form, so none of them can offer what another refuses.
 */
export const LISTED_DOWNLOAD = {
  kind: { not: null },
  hubProduct: { slug: { not: null }, ...LISTABLE },
} satisfies Prisma.DownloadWhereInput;

/**
 * A listed download that opens WITHOUT the form — what the direct file route
 * serves. A gated file is only ever reached through the request form, which
 * stores the visitor's details before signing it.
 */
export const PUBLIC_DOWNLOAD = {
  ...LISTED_DOWNLOAD,
  gated: false,
} satisfies Prisma.DownloadWhereInput;

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

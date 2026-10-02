import { prisma } from "../prisma.js";

/**
 * Match quote basket lines to catalogue products, for their picture and a link.
 *
 * The basket widget (in Duda) sends each line's NAME and SKU, not a product id,
 * so the match is made here, against the Hub's mirror of the catalogue.
 *
 * ⚠️ By NAME first, and that is safe: Duda refuses two products whose titles
 * differ only in case ("Products in catalog can't have duplicate titles"), and
 * the basket reads the name from Duda's own product page. SKU is only a
 * fallback, and only when exactly one product carries it — 4 SKUs are shared
 * between products here, and 3 products have none, so a SKU alone can name the
 * wrong one.
 *
 * One read of the whole product list (96 rows), not a query per line.
 */
export interface MatchedProduct {
  dudaProductId: string;
  imageUrl: string | null;
}

export async function quoteProductMatcher(): Promise<(name: string, sku: string | null) => MatchedProduct | null> {
  const products = await prisma.hubProduct.findMany({
    select: { dudaProductId: true, name: true, sku: true, thumbnailUrl: true },
  });
  const key = (s: string) => s.trim().toLowerCase();
  const byName = new Map<string, (typeof products)[number]>();
  for (const p of products) if (p.name) byName.set(key(p.name), p);
  const bySku = new Map<string, (typeof products)[number][]>();
  for (const p of products) {
    if (!p.sku) continue;
    const k = key(p.sku);
    (bySku.get(k) ?? bySku.set(k, []).get(k)!).push(p);
  }
  return (name, sku) => {
    const hit = (name && byName.get(key(name))) || (sku && bySku.get(key(sku))?.length === 1 ? bySku.get(key(sku))![0] : undefined);
    return hit ? { dudaProductId: hit.dudaProductId, imageUrl: hit.thumbnailUrl } : null;
  };
}

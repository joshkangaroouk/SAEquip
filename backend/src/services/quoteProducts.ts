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
  const [products, translated] = await Promise.all([
    prisma.hubProduct.findMany({
      select: { dudaProductId: true, name: true, sku: true, thumbnailUrl: true },
    }),
    // Duda's translated names (services/i18n/dudaHarvest.ts): a basket filled
    // on /ar/ sends the ARABIC name, which would otherwise match nothing.
    prisma.dudaTranslation.findMany({ where: { entity: "PRODUCT" }, select: { dudaId: true, text: true } }),
  ]);
  const key = (s: string) => s.trim().toLowerCase();
  const byName = new Map<string, (typeof products)[number]>();
  for (const p of products) if (p.name) byName.set(key(p.name), p);
  // ⚠️ Machine translation can give two products the same name, so a
  // translated name is used only when it points at exactly ONE product — and
  // never over an English name, which Duda already keeps unique.
  const byId = new Map(products.map((p) => [p.dudaProductId, p]));
  const translatedIds = new Map<string, Set<string>>();
  for (const t of translated) {
    const k = key(t.text);
    (translatedIds.get(k) ?? translatedIds.set(k, new Set()).get(k)!).add(t.dudaId);
  }
  for (const [k, ids] of translatedIds) {
    const p = ids.size === 1 ? byId.get([...ids][0]) : undefined;
    if (p && !byName.has(k)) byName.set(k, p);
  }
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

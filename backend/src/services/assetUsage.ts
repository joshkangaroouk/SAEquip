import { prisma } from "../prisma.js";

/**
 * Which PRODUCTS a media asset reaches, and how.
 *
 * ⚠️ The unit is DISTINCT PRODUCTS, not referencing rows. The Media Centre
 * used to count rows — a logo image counted its one `Logo` catalogue entry, so
 * "Made in UK" read "used 1×" while it was on 47 product pages. Once the count
 * opens a list of products, the two must be the same number, so both come from
 * here.
 *
 * Three ways in, the three where a Hub URL IS the live reference:
 *   image → a catalogue `Logo` → every product carrying that logo
 *   file  → a `Download` on a product
 *   model → `HubProduct.glbAssetId`
 *
 * ⚠️ PRODUCT GALLERY IMAGES ARE NOT COUNTED, and cannot be. There is no local
 * `ProductImage` mirror by design: an image is uploaded only to give Duda a
 * public URL to fetch, and once Duda re-hosts it the product references
 * `irp.cdn-website.com` with nothing linking back. Safe rather than merely
 * tolerable — deleting such an original cannot break a live gallery, because
 * Duda holds its own copy.
 */

export interface UsageProduct {
  /** Duda's id — the dashboard's product route is keyed on it. */
  dudaProductId: string;
  name: string | null;
  sku: string | null;
  thumbnailUrl: string | null;
  /** How this product uses the asset, e.g. "Download: Datasheet". Empty when there is only one way. */
  via: string[];
}

/**
 * Distinct-product counts for a set of assets, in ONE query.
 *
 * Scoped to the ids asked for (a page of the Media Centre) rather than the
 * whole library, and COUNT(DISTINCT) so a product reaching one asset two ways
 * counts once. Not three per-asset counts: that N+1 once made the Media Centre
 * take 7.1s, Supabase being a round trip away in eu-west-1.
 */
export async function productCounts(mediaAssetIds: string[]): Promise<Map<string, number>> {
  if (mediaAssetIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; n: number }[]>`
    SELECT u.id, COUNT(DISTINCT u.product)::int AS n
    FROM (
      SELECT l."mediaAssetId" AS id, pl."hubProductId" AS product
        FROM "ProductLogo" pl JOIN "Logo" l ON l.id = pl."logoId"
      UNION ALL
      SELECT d."mediaAssetId", d."hubProductId" FROM "Download" d
      UNION ALL
      SELECT h."glbAssetId", h.id FROM "HubProduct" h WHERE h."glbAssetId" IS NOT NULL
    ) u
    WHERE u.id = ANY(${mediaAssetIds})
    GROUP BY u.id`;
  return new Map(rows.map((r) => [r.id, r.n]));
}

const productSelect = {
  id: true,
  dudaProductId: true,
  name: true,
  sku: true,
  thumbnailUrl: true,
} as const;

type ProductRow = { id: string; dudaProductId: string; name: string | null; sku: string | null; thumbnailUrl: string | null };

const LOGO_KIND = { SA_LOGO: "SA logo", CERT_LOGO: "Cert logo" } as const;

/** Products sorted by name, nameless last — the order someone scans a list in. */
function byName(a: UsageProduct, b: UsageProduct) {
  if (!a.name) return b.name ? 1 : 0;
  if (!b.name) return -1;
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

/** Collapses rows onto one entry per product, accumulating every way it is reached. */
function collector() {
  const byId = new Map<string, UsageProduct>();
  return {
    add(p: ProductRow, via?: string) {
      const hit = byId.get(p.id);
      if (hit) {
        if (via && !hit.via.includes(via)) hit.via.push(via);
        return;
      }
      byId.set(p.id, {
        dudaProductId: p.dudaProductId,
        name: p.name,
        sku: p.sku,
        thumbnailUrl: p.thumbnailUrl,
        via: via ? [via] : [],
      });
    },
    list: () => [...byId.values()].sort(byName),
  };
}

/**
 * Everything that references one asset: its catalogue logo entries, and the
 * products it reaches.
 *
 * `logos` is reported separately because a catalogue logo blocks deleting the
 * image even when no product carries it yet — the one case where a "0
 * products" asset is still in use.
 */
export async function assetUsage(mediaAssetId: string) {
  const [logos, downloads, models] = await Promise.all([
    prisma.logo.findMany({
      where: { mediaAssetId },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        kind: true,
        label: true,
        productLinks: { select: { hubProduct: { select: productSelect } } },
      },
    }),
    prisma.download.findMany({
      where: { mediaAssetId },
      select: { title: true, hubProduct: { select: productSelect } },
    }),
    prisma.hubProduct.findMany({ where: { glbAssetId: mediaAssetId }, select: productSelect }),
  ]);

  const products = collector();
  for (const l of logos) {
    const via = `${LOGO_KIND[l.kind]}: ${l.label?.trim() || "unnamed"}`;
    for (const link of l.productLinks) products.add(link.hubProduct, via);
  }
  for (const d of downloads) products.add(d.hubProduct, `Download: ${d.title}`);
  for (const m of models) products.add(m, "3D model");

  return {
    logos: logos.map((l) => ({ id: l.id, kind: l.kind, label: l.label })),
    products: products.list(),
  };
}

/** The products carrying one catalogue logo — the Logos page's popup. */
export async function logoProducts(logoId: string): Promise<UsageProduct[] | null> {
  const logo = await prisma.logo.findUnique({
    where: { id: logoId },
    select: { productLinks: { select: { hubProduct: { select: productSelect } } } },
  });
  if (!logo) return null;
  const products = collector();
  for (const link of logo.productLinks) products.add(link.hubProduct);
  return products.list();
}

import type { HubProduct } from "@prisma/client";
import { prisma } from "../prisma.js";
import { duda } from "./duda.js";

/**
 * Ensures a HubProduct row exists for a given Duda product id.
 *
 * Fetches the live Duda product for its sku + name, then upserts the HubProduct
 * (keyed by dudaProductId), keeping sku/name in sync. Returns the HubProduct.
 */
export async function ensureHubProduct(dudaProductId: string): Promise<HubProduct> {
  const product = await duda.getProduct(dudaProductId);

  return prisma.hubProduct.upsert({
    where: { dudaProductId },
    create: { dudaProductId, sku: product.sku ?? null, name: product.name ?? null },
    update: { sku: product.sku ?? null, name: product.name ?? null },
  });
}

import {
  duda,
  type DudaOptionRef,
  type DudaProduct,
  type DudaVariation,
} from "./duda.js";

/**
 * Changing a product's attached options is DESTRUCTIVE on Duda's side.
 *
 * Verified live: when the attached option/choice set changes, Duda regenerates
 * every variation with brand-new ids and blanks each one's `sku` (to null) and
 * `price_difference` (to "0.0"). Nothing is preserved, not even for
 * combinations that still exist afterwards.
 *
 * (An earlier probe suggested ids survived, but that only added a choice to the
 * shared CATALOG option while the product kept its own subset — so the product
 * never regenerated. Don't be misled by that case.)
 *
 * So we snapshot variation data keyed by its choice-value signature, apply the
 * option change, then re-apply the data to whichever combinations still exist.
 * The signature is order-independent because Duda's variation array order is
 * not stable.
 */

/** Order-independent identity for a variation: its set of choice values. */
export function variationSignature(v: DudaVariation): string {
  return v.options
    .map((o) => `${o.option_name}=${o.choice_value}`)
    .sort()
    .join("|");
}

interface PreservedData {
  sku: string | null;
  price_difference: string;
  status: string;
}

const hasData = (d: PreservedData): boolean =>
  (d.sku != null && d.sku !== "") ||
  (d.price_difference !== "" && parseFloat(d.price_difference) !== 0) ||
  d.status === "HIDDEN";

export interface OptionChangeReport {
  product: DudaProduct;
  /** Combinations whose sku/price/status were carried across. */
  restored: number;
  /** Combinations that had data but no longer exist, so it could not be kept. */
  dropped: string[];
  /** Restores that were attempted but failed (data may be incomplete). */
  failed: { signature: string; error: string }[];
}

/**
 * Replaces the product's attached options, carrying variation data across.
 *
 * The cartesian-size guard is the caller's job (it needs the store limit).
 */
export async function updateOptionsPreservingVariations(
  productId: string,
  refs: DudaOptionRef[],
): Promise<OptionChangeReport> {
  const before = await duda.getProduct(productId);

  const snapshot = new Map<string, PreservedData>();
  for (const v of before.variations ?? []) {
    const data: PreservedData = {
      sku: v.sku,
      price_difference: v.price_difference,
      status: v.status,
    };
    if (hasData(data)) snapshot.set(variationSignature(v), data);
  }

  const product = await duda.updateProductOptions(productId, refs);

  if (snapshot.size === 0) {
    return { product, restored: 0, dropped: [], failed: [] };
  }

  const seen = new Set<string>();
  const failed: OptionChangeReport["failed"] = [];
  let restored = 0;

  for (const v of product.variations ?? []) {
    const sig = variationSignature(v);
    const saved = snapshot.get(sig);
    if (!saved) continue;
    seen.add(sig);
    try {
      await duda.patchVariation(productId, v.id, {
        ...(saved.sku ? { sku: saved.sku } : {}),
        price_difference: saved.price_difference,
        status: saved.status === "HIDDEN" ? "HIDDEN" : "ACTIVE",
      });
      restored++;
    } catch (err) {
      failed.push({ signature: sig, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Combinations that carried data but no longer exist after the change.
  const dropped = [...snapshot.keys()].filter((sig) => !seen.has(sig));

  // Re-read so the caller returns the restored values, not the blanked ones.
  const finalProduct = restored > 0 ? await duda.getProduct(productId) : product;
  return { product: finalProduct, restored, dropped, failed };
}

/** Variation count a given attachment set will generate. */
export function cartesianSize(refs: DudaOptionRef[]): number {
  return refs.reduce((n, r) => n * Math.max(r.choiceIds.length, 0), refs.length ? 1 : 0);
}

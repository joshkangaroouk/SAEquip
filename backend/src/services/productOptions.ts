import {
  duda,
  type DudaOptionRef,
  type DudaProduct,
  type DudaVariation,
} from "./duda.js";
import { invalidateOptionUsage } from "./optionUsage.js";

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
 * So we snapshot variation data, apply the option change, then re-apply the
 * data to whichever combinations still correspond one-to-one — see
 * `updateOptionsPreservingVariations`.
 */

/**
 * A variation projected onto a set of options: the choices it makes for those
 * options only, by ID, order-independent (Duda's variation array order is not
 * stable).
 *
 * IDs rather than `option_name=choice_value`: choice ids on a variation ARE
 * the catalogue's ids and survive a regeneration (verified on throwaways), so
 * they are the stable identity. (Duda refuses two options with the same name —
 * "Option name should be unique per catalog" — so names could not collide in
 * practice; ids are simply the key that cannot.)
 */
function projection(v: DudaVariation, optionIds: Set<string>): string {
  return v.options
    .filter((o) => optionIds.has(o.option_id))
    .map((o) => `${o.option_id}=${o.choice_id}`)
    .sort()
    .join("|");
}

/** What a person reads in a "lost" report: "Voltage=240V, Hire/Purchase=Hire". */
const label = (v: DudaVariation): string =>
  v.options.map((o) => `${o.option_name}=${o.choice_value}`).sort().join(", ");

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
  /** Combinations that had data but could not be carried, as readable labels. */
  dropped: string[];
  /** Restores that were attempted but failed (data may be incomplete). */
  failed: { signature: string; error: string }[];
}

/**
 * Replaces the product's attached options, carrying variation data across.
 *
 * How an old variation is matched to a new one: both are projected onto the
 * options present BEFORE AND AFTER, and data moves only where that is ONE old
 * variation to ONE new one. That covers every unambiguous change —
 *   - removing a value          a1+b1, a1+b2 → a1+b1      (b2's data is lost)
 *   - detaching a 1-value option a1+b1 → a1
 *   - attaching a 1-value option a1 → a1+c1
 * — the last two of which used to lose EVERY SKU, because whole combinations
 * were compared and none matched (measured on throwaways, 2026-10-02).
 *
 * ⚠️ Anything else is AMBIGUOUS and dropped, never guessed. Attaching a
 * two-value option turns a1 into a1+d1 and a1+d2: copying the SKU to both
 * would mint duplicate SKUs, and picking one is a guess. Detaching one merges
 * several variations into one, and choosing whose SKU survives is the same
 * guess. Those land in `dropped`, which the editor reports.
 *
 * The cartesian-size guard is the caller's job (it needs the store limit).
 */
export async function updateOptionsPreservingVariations(
  productId: string,
  refs: DudaOptionRef[],
): Promise<OptionChangeReport> {
  const before = await duda.getProduct(productId);
  const oldVariations = before.variations ?? [];

  const product = await duda.updateProductOptions(productId, refs);
  invalidateOptionUsage();

  const withData = oldVariations.filter((v) =>
    hasData({ sku: v.sku, price_difference: v.price_difference, status: v.status }),
  );
  if (withData.length === 0) {
    return { product, restored: 0, dropped: [], failed: [] };
  }

  const common = new Set(
    (before.options ?? []).map((o) => o.id).filter((id) => refs.some((r) => r.id === id)),
  );
  const group = <T extends DudaVariation>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const v of list) {
      const k = projection(v, common);
      (m.get(k) ?? m.set(k, []).get(k)!).push(v);
    }
    return m;
  };
  // ALL old variations, not only those with data: two collapsing into one is
  // ambiguous even when only one of them carried a SKU.
  const oldByKey = group(oldVariations);
  const newByKey = group(product.variations ?? []);

  const failed: OptionChangeReport["failed"] = [];
  const dropped: string[] = [];
  let restored = 0;

  for (const old of withData) {
    const k = projection(old, common);
    const olds = oldByKey.get(k) ?? [];
    const news = newByKey.get(k) ?? [];
    if (olds.length !== 1 || news.length !== 1) {
      dropped.push(label(old));
      continue;
    }
    try {
      await duda.patchVariation(productId, news[0].id, {
        ...(old.sku ? { sku: old.sku } : {}),
        price_difference: old.price_difference,
        status: old.status === "HIDDEN" ? "HIDDEN" : "ACTIVE",
      });
      restored++;
    } catch (err) {
      failed.push({ signature: label(old), error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Re-read so the caller returns the restored values, not the blanked ones.
  const finalProduct = restored > 0 ? await duda.getProduct(productId) : product;
  return { product: finalProduct, restored, dropped, failed };
}

/** Variation count a given attachment set will generate. */
export function cartesianSize(refs: DudaOptionRef[]): number {
  return refs.reduce((n, r) => n * Math.max(r.choiceIds.length, 0), refs.length ? 1 : 0);
}

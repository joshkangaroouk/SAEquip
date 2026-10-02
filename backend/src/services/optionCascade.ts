import { duda, type DudaOptionRef } from "./duda.js";
import { updateOptionsPreservingVariations } from "./productOptions.js";
import { invalidateOptionUsage } from "./optionUsage.js";

/**
 * Deleting a shared option or one of its values while products still use it.
 *
 * Duda's REST API refuses both directly ("Can't remove choice that is connected
 * to variations"), but its own admin UI clearly allows it behind a warning —
 * because it ORCHESTRATES: detach from the affected products first, which
 * regenerates their variations without that combination, and only then remove
 * the catalog entry. That's what these helpers do.
 *
 * They go one better than Duda's UI: detaching runs through
 * updateOptionsPreservingVariations, so SKUs and price differences on the
 * combinations that SURVIVE are carried across rather than blanked.
 */

export interface CascadeReport {
  /** Products whose attached options were rewritten. */
  productsUpdated: { id: string; name: string; variationsBefore: number; variationsAfter: number }[];
  /** Variation data carried across, summed over those products. */
  variationDataRestored: number;
  /** Combinations that ceased to exist and so lost their SKU/price. */
  variationDataDropped: number;
  /** Restores attempted and failed — the SKU may be missing on these. */
  variationDataFailed: number;
  /** Products whose detach itself failed; they still use the option/value. */
  productsFailed: { id: string; name: string; error: string }[];
  /**
   * False when any product failed. The catalogue entry is then KEPT: Duda
   * refuses to delete a value still attached to variations, and deleting it
   * anyway would be a half-finished change with nobody told which half.
   */
  catalogDeleted: boolean;
}

const emptyReport = (): CascadeReport => ({
  productsUpdated: [],
  variationDataRestored: 0,
  variationDataDropped: 0,
  variationDataFailed: 0,
  productsFailed: [],
  catalogDeleted: false,
});

/** The refs a product currently has, as the shape updateProductOptions wants. */
function refsOf(product: Awaited<ReturnType<typeof duda.getProduct>>): DudaOptionRef[] {
  return product.options.map((o) => ({ id: o.id, choiceIds: o.choices.map((c) => c.id) }));
}

async function applyRefs(
  productId: string,
  productName: string,
  before: number,
  refs: DudaOptionRef[],
  report: CascadeReport,
): Promise<void> {
  let res;
  try {
    res = await updateOptionsPreservingVariations(productId, refs);
  } catch (err) {
    // ⚠️ Caught per product. One failure used to throw out of the loop, losing
    // the report for every product already rewritten — the one thing the
    // person needs to know after a store-wide change.
    report.productsFailed.push({
      id: productId,
      name: productName,
      error: err instanceof Error ? err.message.slice(0, 200) : String(err),
    });
    return;
  }
  report.productsUpdated.push({
    id: productId,
    name: productName,
    variationsBefore: before,
    variationsAfter: res.product.variations.length,
  });
  report.variationDataRestored += res.restored;
  report.variationDataDropped += res.dropped.length;
  report.variationDataFailed += res.failed.length;
}

/**
 * Removes one value from every product offering it, then deletes it from the
 * shared option.
 *
 * If a product's only remaining value for that option would be the one being
 * removed, the whole option is detached from that product — Duda rejects an
 * attached option with zero choices.
 */
export async function deleteChoiceCascade(
  optionId: string,
  choiceId: string,
): Promise<CascadeReport> {
  const report = emptyReport();

  // Read live rather than trusting the usage cache — this drives writes.
  for (const summary of await duda.listAllProducts()) {
    const offers = summary.options.some(
      (o) => o.id === optionId && o.choices.some((c) => c.id === choiceId),
    );
    if (!offers) continue;

    const before = summary.variations.length;
    const refs = refsOf(summary)
      .map((r) =>
        r.id === optionId ? { ...r, choiceIds: r.choiceIds.filter((c) => c !== choiceId) } : r,
      )
      // An attached option with no choices is rejected, so it comes off entirely.
      .filter((r) => r.choiceIds.length > 0);

    await applyRefs(summary.id, summary.name, before, refs, report);
  }

  invalidateOptionUsage();
  if (report.productsFailed.length === 0) {
    await duda.deleteOptionChoice(optionId, choiceId);
    report.catalogDeleted = true;
  }
  return report;
}

/** Detaches an option from every product using it, then deletes the option. */
export async function deleteOptionCascade(optionId: string): Promise<CascadeReport> {
  const report = emptyReport();

  for (const summary of await duda.listAllProducts()) {
    if (!summary.options.some((o) => o.id === optionId)) continue;
    const before = summary.variations.length;
    const refs = refsOf(summary).filter((r) => r.id !== optionId);
    await applyRefs(summary.id, summary.name, before, refs, report);
  }

  invalidateOptionUsage();
  if (report.productsFailed.length === 0) {
    await duda.deleteOption(optionId);
    report.catalogDeleted = true;
  }
  return report;
}

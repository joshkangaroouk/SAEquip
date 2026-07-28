import { duda, type DudaProduct } from "./duda.js";

/**
 * Reverse index of which products use each store-level option.
 *
 * Duda offers no such lookup, so it's derived from one full product sweep. This
 * matters because options are SHARED across the whole catalog: renaming an
 * option or deleting one of its choices changes every product using it, and the
 * UI can only warn honestly if it knows which those are.
 *
 * Memoised briefly because the sweep is the single most expensive read in the
 * app, and invalidated by every option/product write.
 */
export interface OptionUsage {
  productCount: number;
  products: { id: string; name: string; sku: string }[];
  /** Per-choice usage, so deleting one choice can warn separately. */
  choiceUsage: Record<string, number>;
}

const TTL_MS = 30_000;
let cache: { at: number; index: Map<string, OptionUsage> } | null = null;

export function invalidateOptionUsage(): void {
  cache = null;
}

function build(products: DudaProduct[]): Map<string, OptionUsage> {
  const index = new Map<string, OptionUsage>();

  for (const p of products) {
    for (const opt of p.options ?? []) {
      let entry = index.get(opt.id);
      if (!entry) {
        entry = { productCount: 0, products: [], choiceUsage: {} };
        index.set(opt.id, entry);
      }
      entry.productCount++;
      entry.products.push({ id: p.id, name: p.name, sku: p.sku });
      // A product may expose only a subset of the option's choices, so count
      // choices independently of the option itself.
      for (const c of opt.choices ?? []) {
        entry.choiceUsage[c.id] = (entry.choiceUsage[c.id] ?? 0) + 1;
      }
    }
  }

  return index;
}

export async function getOptionUsage(): Promise<Map<string, OptionUsage>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.index;
  const products = await duda.listAllProducts();
  const index = build(products);
  cache = { at: Date.now(), index };
  return index;
}

export const emptyUsage = (): OptionUsage => ({
  productCount: 0,
  products: [],
  choiceUsage: {},
});

import type { TranslationKind } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { isPassThrough, normaliseSource, sourceHash } from "./normalise.js";

export interface SourceString {
  kind: TranslationKind;
  sourceText: string;
  sourceHash: string;
  /** Which products use it — context for the Translations page. */
  productIds: string[];
}

/**
 * Every piece of Hub-only English that a translated page can show, de-duplicated
 * by (kind, text), with the products that use it. Pass-through text (codes,
 * measurements) is left out — it is never translated.
 *
 * `dudaProductId` limits it to one product: what the editor's
 * translate-on-save needs after a save.
 */
export async function collectSources(opts: { dudaProductId?: string } = {}): Promise<SourceString[]> {
  const where = opts.dudaProductId ? { dudaProductId: opts.dudaProductId } : {};
  const [products, logos] = await Promise.all([
    prisma.hubProduct.findMany({
      where,
      select: {
        dudaProductId: true,
        descriptionHtml: true,
        specRows: { select: { label: true, value: true } },
        textItems: { select: { text: true } },
        logos: { select: { logo: { select: { label: true, alt: true } } } },
      },
    }),
    // Logo text is global (the logo catalogue), not per product.
    opts.dudaProductId ? Promise.resolve([]) : prisma.logo.findMany({ select: { label: true, alt: true } }),
  ]);

  const out = new Map<string, SourceString>();
  const add = (kind: TranslationKind, raw: string | null | undefined, productId?: string) => {
    const text = normaliseSource(raw ?? "");
    if (!text || isPassThrough(text)) return;
    const key = `${kind}:${text}`;
    const hit = out.get(key) ?? { kind, sourceText: text, sourceHash: sourceHash(text), productIds: [] };
    if (productId && !hit.productIds.includes(productId)) hit.productIds.push(productId);
    out.set(key, hit);
  };
  for (const p of products) {
    add("DESCRIPTION", p.descriptionHtml, p.dudaProductId);
    for (const s of p.specRows) {
      add("SPEC_LABEL", s.label, p.dudaProductId);
      add("SPEC_VALUE", s.value, p.dudaProductId);
    }
    for (const t of p.textItems) add("LIST_ITEM", t.text, p.dudaProductId);
    for (const l of p.logos) {
      add("LOGO_TEXT", l.logo.label, p.dudaProductId);
      add("LOGO_TEXT", l.logo.alt, p.dudaProductId);
    }
  }
  for (const l of logos) {
    add("LOGO_TEXT", l.label);
    add("LOGO_TEXT", l.alt);
  }
  return [...out.values()];
}

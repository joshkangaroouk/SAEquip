import type {
  HubSpecRow,
  HubTextItem,
  ProductDetail,
  ProductLogoEntry,
} from "../../lib/types";
import type {
  EditorSnapshot,
  ErrorMap,
  ImageDraft,
  LogoKind,
  OptionRefDraft,
  NativeForm,
  SectionKey,
  SpecRowDraft,
  TextItemDraft,
  VariationDraft,
} from "./productEditorTypes";

const NUMERIC = /^\d+(\.\d+)?$/;

/** Flattens prices[0] and seo into top-level form fields. */
export function nativeFromProduct(p: ProductDetail): NativeForm {
  const price0 = p.prices?.[0];
  return {
    name: p.name ?? "",
    sku: p.sku ?? "",
    type: p.type ?? "PHYSICAL",
    status: p.status ?? "ACTIVE",
    stock_status: p.stock_status ?? "IN_STOCK",
    requires_shipping: !!p.requires_shipping,
    managed_inventory: !!p.managed_inventory,
    quantity: p.quantity != null ? String(p.quantity) : "",
    price: price0?.price ?? "",
    compare_at_price: price0?.compare_at_price ?? "",
    description: p.description ?? "",
    seo_title: p.seo?.title ?? "",
    seo_description: p.seo?.description ?? "",
    seo_product_url: p.seo?.product_url ?? "",
  };
}

export const imagesFrom = (images: ProductDetail["images"]): ImageDraft[] =>
  images.map((img, i) => ({ key: `${img.url}#${i}`, url: img.url, alt: img.alt ?? "" }));

export const optionsFrom = (options: ProductDetail["options"]): OptionRefDraft[] =>
  (options ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type,
    choiceIds: o.choices.map((c) => c.id),
  }));

/** Order-independent identity for a variation — mirrors the backend's version. */
export const variationSignature = (v: ProductDetail["variations"][number]): string =>
  v.options
    .map((o) => `${o.option_name}=${o.choice_value}`)
    .sort()
    .join("|");

export const variationsFrom = (variations: ProductDetail["variations"]): VariationDraft[] =>
  (variations ?? []).map((v) => ({
    id: v.id,
    signature: variationSignature(v),
    choices: v.options.map((o) => ({ optionId: o.option_id, value: o.choice_value })),
    // Duda returns null on a freshly generated variation.
    sku: v.sku ?? "",
    price_difference: v.price_difference ?? "0.0",
    status: v.status ?? "ACTIVE",
  }));

/** Variations a given attachment set will generate. */
export const cartesianSize = (refs: OptionRefDraft[]): number =>
  refs.length === 0 ? 0 : refs.reduce((n, r) => n * r.choiceIds.length, 1);

export const specsFrom = (rows: HubSpecRow[]): SpecRowDraft[] =>
  rows.map((r) => ({ id: r.id, label: r.label, value: r.value }));

export const itemsFrom = (items: HubTextItem[]): TextItemDraft[] =>
  items.map((i) => ({ id: i.id, text: i.text }));

export const activeLogoIds = (entries: ProductLogoEntry[]): string[] =>
  entries.filter((e) => e.active).map((e) => e.id);

/**
 * Strips cosmetic keys before comparison.
 *
 * Row ids are client-generated (crypto.randomUUID) for new rows and server ids
 * for existing ones, so comparing them directly would report a section dirty
 * forever after a save. Safe to drop because ids carry no meaning — order is
 * array position and the PUT payloads send only the content fields.
 */
export function project(snapshot: EditorSnapshot, key: SectionKey): unknown {
  switch (key) {
    case "details":
      return snapshot.details;
    case "images":
      // Drop the cosmetic key; url+alt+position are the whole payload.
      return snapshot.images.map(({ url, alt }) => ({ url, alt }));
    case "options":
      // Attachment order is meaningful (display order), so it's compared as-is;
      // choice order within an option is not.
      return snapshot.options.map((o) => ({ id: o.id, choiceIds: [...o.choiceIds].sort() }));
    case "variations":
      return snapshot.variations.map(({ id, sku, price_difference, status }) => ({
        id,
        sku,
        price_difference,
        status,
      }));
    case "specs":
      return snapshot.specs.map(({ label, value }) => ({ label, value }));
    case "benefits":
      return snapshot.benefits.map(({ text }) => ({ text }));
    case "applications":
      return snapshot.applications.map(({ text }) => ({ text }));
    case "logos":
      // Sorted so toggle ORDER never registers as a change.
      return {
        SA_LOGO: [...snapshot.logos.SA_LOGO].sort(),
        CERT_LOGO: [...snapshot.logos.CERT_LOGO].sort(),
      };
  }
}

export function isSectionDirty(
  draft: EditorSnapshot,
  baseline: EditorSnapshot,
  key: SectionKey,
): boolean {
  return JSON.stringify(project(draft, key)) !== JSON.stringify(project(baseline, key));
}

// --- validation (client mirror of the backend zod rules) ---

export const specRowValid = (r: SpecRowDraft): boolean =>
  r.label.trim().length > 0 &&
  r.label.trim().length <= 200 &&
  r.value.trim().length > 0 &&
  r.value.trim().length <= 500;

export const textItemValid = (i: TextItemDraft): boolean =>
  i.text.trim().length > 0 && i.text.trim().length <= 500;

const PRICE_DELTA = /^-?\d+(\.\d+)?$/;

/**
 * Per-section validation messages; an empty object means the draft is saveable.
 *
 * `maxVariations` comes from the store so the cartesian cap is enforced
 * client-side, rather than letting Duda reject the save with a raw error.
 */
export function validate(
  draft: EditorSnapshot,
  maxVariations?: number | null,
  { hideCommerce = false }: { hideCommerce?: boolean } = {},
): ErrorMap {
  const errors: ErrorMap = {};
  const d = draft.details;

  if (draft.options.length > 20) errors.options = "Max 20 options.";
  else if (draft.options.some((o) => o.choiceIds.length === 0))
    errors.options = "Every attached option needs at least one choice selected.";
  else if (new Set(draft.options.map((o) => o.id)).size !== draft.options.length)
    errors.options = "An option can only be attached once.";
  else {
    const projected = cartesianSize(draft.options);
    if (maxVariations != null && projected > maxVariations)
      errors.options = `That would generate ${projected} variations, over the limit of ${maxVariations}. Remove a choice or an option.`;
  }

  if (!draft.variations.every((v) => v.sku.length <= 100))
    errors.variations = "Variation SKUs must be 100 characters or fewer.";
  else if (!hideCommerce && !draft.variations.every((v) => PRICE_DELTA.test(v.price_difference)))
    errors.variations = "Every price difference must be a number (negatives allowed).";

  const priceOk = NUMERIC.test(d.price) && parseFloat(d.price) >= 0;
  const compareOk =
    d.compare_at_price === "" ||
    (NUMERIC.test(d.compare_at_price) &&
      priceOk &&
      parseFloat(d.compare_at_price) > parseFloat(d.price));
  const quantityOk =
    !d.managed_inventory ||
    d.quantity === "" ||
    (/^\d+$/.test(d.quantity) && parseInt(d.quantity, 10) >= 0);

  if (!d.name.trim()) errors.details = "Name is required.";
  // Pricing/quantity are only validated while visible. A hidden field is never
  // edited, so it never becomes dirty and never gets sent — and blocking Save on
  // a field the user can't see or reach would be an unfixable dead end.
  else if (!hideCommerce && !priceOk) errors.details = "Price must be a number ≥ 0.";
  else if (!hideCommerce && !compareOk)
    errors.details = "Compare-at price must be a number greater than the price.";
  else if (!hideCommerce && !quantityOk)
    errors.details = "Quantity must be a whole number ≥ 0.";

  if (draft.images.length > 50) errors.images = "Max 50 images.";
  else if (!draft.images.every((i) => /^https?:\/\//i.test(i.url)))
    errors.images = "Every image needs an absolute http(s) URL that Duda can fetch.";

  if (draft.specs.length > 100) errors.specs = "Max 100 rows.";
  else if (!draft.specs.every(specRowValid))
    errors.specs = "Every label and value is required (label ≤200, value ≤500 chars).";

  if (draft.benefits.length > 100) errors.benefits = "Max 100 items.";
  else if (!draft.benefits.every(textItemValid))
    errors.benefits = "Every item is required and must be ≤500 characters.";

  if (draft.applications.length > 100) errors.applications = "Max 100 items.";
  else if (!draft.applications.every(textItemValid))
    errors.applications = "Every item is required and must be ≤500 characters.";

  return errors;
}

/**
 * The PATCH body for changed native fields only.
 *
 * Sends the WHOLE seo object when any sub-field changed so the others aren't
 * wiped — losing seo.product_url would break the public widget, which resolves
 * products by slug.
 */
export function buildDetailsPayload(
  draft: NativeForm,
  baseline: NativeForm,
): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (draft.name !== baseline.name) p.name = draft.name;
  if (draft.sku !== baseline.sku) p.sku = draft.sku;
  if (draft.type !== baseline.type) p.type = draft.type;
  if (draft.status !== baseline.status) p.status = draft.status;
  if (draft.stock_status !== baseline.stock_status) p.stock_status = draft.stock_status;
  if (draft.requires_shipping !== baseline.requires_shipping)
    p.requires_shipping = draft.requires_shipping;
  if (draft.managed_inventory !== baseline.managed_inventory)
    p.managed_inventory = draft.managed_inventory;
  if (draft.managed_inventory && draft.quantity !== baseline.quantity && draft.quantity !== "")
    p.quantity = parseInt(draft.quantity, 10);
  if (draft.description !== baseline.description) p.description = draft.description;
  if (draft.price !== baseline.price || draft.compare_at_price !== baseline.compare_at_price) {
    p.prices = [
      {
        price: draft.price,
        compare_at_price: draft.compare_at_price === "" ? null : draft.compare_at_price,
      },
    ];
  }
  if (
    draft.seo_title !== baseline.seo_title ||
    draft.seo_description !== baseline.seo_description ||
    draft.seo_product_url !== baseline.seo_product_url
  ) {
    p.seo = {
      title: draft.seo_title,
      description: draft.seo_description,
      product_url: draft.seo_product_url,
    };
  }
  return p;
}

/** Which logo ids need activating vs deactivating, across both kinds. */
export function logoDiff(
  draft: EditorSnapshot["logos"],
  baseline: EditorSnapshot["logos"],
): { activate: string[]; deactivate: string[] } {
  const kinds: LogoKind[] = ["SA_LOGO", "CERT_LOGO"];
  const activate: string[] = [];
  const deactivate: string[] = [];

  for (const kind of kinds) {
    const before = new Set(baseline[kind]);
    const after = new Set(draft[kind]);
    for (const id of after) if (!before.has(id)) activate.push(id);
    for (const id of before) if (!after.has(id)) deactivate.push(id);
  }

  return { activate, deactivate };
}

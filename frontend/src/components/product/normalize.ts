import type {
  HubCompatible,
  HubDownload,
  HubModel3D,
  HubSpecRow,
  HubTextItem,
  ProductDetail,
  ProductLogoEntry,
} from "../../lib/types";
import type {
  DownloadDraft,
  EditorSnapshot,
  ErrorMap,
  ImageDraft,
  LogoKind,
  Model3DDraft,
  CompatibleDraft,
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
  rows.map((r, i) => {
    // A blank label means "continue the row above". The first row can never
    // be one (the API rejects it), so the index guard is belt-and-braces
    // against malformed stored data rather than an expected case.
    const cont = i > 0 && r.label.trim().length === 0;
    return {
      id: r.id,
      label: r.label,
      value: r.value,
      cont,
      // A labelled row with no value is a sub-heading. Read from the STORED
      // data only — from here on the flag, not emptiness, decides.
      heading: !cont && r.value.trim().length === 0,
    };
  });

// --- spec groups: the editor's view of the flat row list ---

export interface SpecLineDraft {
  id: string;
  value: string;
}

/**
 * One labelled spec and every line beneath it.
 *
 * `heading` marks a sub-heading: a label with no value of its own. Its `lines`
 * are normally empty; any it has are continuation lines stored after it, which
 * the importer never produced but which still round-trip.
 */
export interface SpecGroupDraft {
  id: string;
  label: string;
  heading: boolean;
  lines: SpecLineDraft[];
}

/**
 * Fold flat rows into the groups the editor renders, preserving row ids so
 * React keys and drag identity survive a re-render.
 *
 * Round-trips exactly with `flattenSpecGroups` — a group's id is the id of the
 * row that carried its label, and each line keeps its own row's id — so
 * grouping and flattening cannot invent or lose a row, and `project()` keeps
 * seeing the same shape it always did.
 */
export const groupSpecRows = (rows: SpecRowDraft[]): SpecGroupDraft[] => {
  const groups: SpecGroupDraft[] = [];
  for (const r of rows) {
    if (!r.cont || groups.length === 0) {
      groups.push({
        id: r.id,
        label: r.label,
        heading: r.heading,
        // ⚠️ Keyed off the FLAG. An empty value on an ordinary spec is a line
        // being typed, and must stay on screen.
        lines: r.heading ? [] : [{ id: r.id, value: r.value }],
      });
    } else {
      groups[groups.length - 1].lines.push({ id: r.id, value: r.value });
    }
  }
  return groups;
};

/** The inverse: groups back to the flat rows the API stores. */
export const flattenSpecGroups = (groups: SpecGroupDraft[]): SpecRowDraft[] =>
  groups.flatMap((g): SpecRowDraft[] =>
    g.heading
      ? [
          { id: g.id, label: g.label, value: "", cont: false, heading: true },
          ...g.lines.map((ln) => ({ id: ln.id, label: "", value: ln.value, cont: true, heading: false })),
        ]
      : g.lines.map((ln, i) => ({
          id: ln.id,
          label: i === 0 ? g.label : "",
          value: ln.value,
          cont: i > 0,
          heading: false,
        })),
  );

/**
 * The first problem with a spec table, worded so it can be found: the spec's
 * own label, or its position when it has none. Null when the table is fine.
 *
 * ⚠️ An ordinary line may not be empty. Saved, it would come back as a
 * sub-heading — a different kind of row than the one the user was looking at.
 */
export function specsProblem(rows: SpecRowDraft[]): string | null {
  let label = "";
  let n = 0;
  for (const r of rows) {
    if (!r.cont) {
      n++;
      label = r.label.trim();
      if (!label) return `Spec ${n} needs a label.`;
      if (label.length > 200) return `Spec ${n}'s label is over 200 characters.`;
    }
    const where = `“${label}”`;
    if (!r.heading && !r.value.trim()) return `${where} has an empty line — type a value or remove it.`;
    if (r.value.trim().length > 500) return `${where} has a line over 500 characters.`;
  }
  return null;
}

export const compatibleFrom = (rows: HubCompatible[]): CompatibleDraft[] =>
  rows.map((r) => ({
    dudaProductId: r.dudaProductId,
    name: r.name ?? "",
    sku: r.sku,
    slug: r.slug,
  }));

export const itemsFrom = (items: HubTextItem[]): TextItemDraft[] =>
  items.map((i) => ({ id: i.id, text: i.text }));

export const activeLogoIds = (entries: ProductLogoEntry[]): string[] =>
  entries.filter((e) => e.active).map((e) => e.id);

export const downloadsFrom = (items: HubDownload[]): DownloadDraft[] =>
  items.map((d) => ({
    mediaAssetId: d.mediaAssetId,
    title: d.title,
    kind: d.kind ?? null,
    certScheme: d.certScheme ?? null,
    filename: d.file.filename,
    sizeBytes: d.file.sizeBytes,
    url: d.file.url,
    thumbnailUrl: d.file.thumbnailUrl ?? null,
  }));

export const model3dFrom = (m: HubModel3D | null): Model3DDraft =>
  m
    ? { mediaAssetId: m.mediaAssetId, filename: m.filename, url: m.url }
    : { mediaAssetId: null, filename: null, url: null };

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
    case "model3d":
      // filename/url are cosmetic (carried for the preview) — only the id matters.
      return { mediaAssetId: snapshot.model3d.mediaAssetId };
    case "compatible":
      // Order is meaningful (it is the carousel order), so compared as-is.
      // name/sku/slug are display-only, carried to render a row.
      return snapshot.compatible.map((c) => c.dudaProductId);
    // Sorted: these are SETS. Ticking A then B must not read as a change
    // against a baseline that happened to load B then A.
    case "categories":
      return [...snapshot.categoryIds].sort();
    case "downloads":
      // ORDER is meaningful (it is the display order), so compared as-is.
      // filename/size/url are display only; a re-signed url after a save must
      // never read as a change. The type and scheme are content — they decide
      // which public page lists the file.
      return snapshot.downloads.map(({ mediaAssetId, title, kind, certScheme }) => ({
        mediaAssetId,
        title,
        kind,
        certScheme,
      }));
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

  // Mirrors the PATCH route. The slug is the live page URL; Duda renders "&"
  // as "---", so repeated hyphens are real and allowed.
  const slug = d.seo_product_url.trim();

  if (!d.name.trim()) errors.details = "Name is required.";
  else if (!slug) errors.details = "The URL slug cannot be blank — it is the product page's address.";
  else if (!/^[a-z0-9-]+$/.test(slug))
    errors.details = "The URL slug may only contain lowercase letters, numbers and hyphens.";
  else if (slug.length > 200) errors.details = "The URL slug must be 200 characters or fewer.";
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
  else if (draft.images.some((i) => i.alt.length > 300))
    errors.images = "Alt text must be 300 characters or fewer.";

  if (draft.specs.length > 100) errors.specs = "Max 100 rows.";
  else {
    const problem = specsProblem(draft.specs);
    if (problem) errors.specs = problem;
  }

  if (draft.compatible.length > 40) errors.compatible = "Max 40 compatible products.";

  // Mirrors the PUT's zod rules, so a bad draft is caught here rather than
  // as a 400 after the user has pressed Save.
  if (draft.downloads.length > 50) errors.downloads = "Max 50 downloads.";
  else if (draft.downloads.some((d) => !d.title.trim()))
    errors.downloads = "Every download needs a title.";
  else if (draft.downloads.some((d) => d.title.trim().length > 200))
    errors.downloads = "Download titles must be 200 characters or fewer.";
  else if (new Set(draft.downloads.map((d) => d.mediaAssetId)).size !== draft.downloads.length)
    errors.downloads = "The same file is listed twice.";
  else if (draft.downloads.some((d) => !d.kind))
    errors.downloads = "Choose a type for every download.";
  else if (draft.downloads.some((d) => d.kind === "CERTIFICATE" && !d.certScheme))
    errors.downloads = "Choose which certificate each certificate download is.";

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

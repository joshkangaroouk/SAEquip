import type { ProductDetail, ProductLogoEntry } from "../../lib/types";

/** Sections that participate in the unified dirty/save flow. */
export type SectionKey =
  | "details"
  | "images"
  | "options"
  | "variations"
  | "specs"
  | "benefits"
  | "applications"
  | "logos"
  | "model3d";

export const SECTION_LABELS: Record<SectionKey, string> = {
  details: "Details",
  images: "Images",
  options: "Options",
  variations: "Variations",
  specs: "Technical Specs",
  benefits: "Key Benefits",
  applications: "Applications",
  logos: "Logos",
  model3d: "3D Model",
};

export type LogoKind = "SA_LOGO" | "CERT_LOGO";

/**
 * Native Duda fields, flattened for form binding: prices[0] and seo are lifted
 * to top-level strings and re-nested on save.
 */
export interface NativeForm {
  name: string;
  sku: string;
  type: string;
  status: string;
  stock_status: string;
  requires_shipping: boolean;
  managed_inventory: boolean;
  quantity: string;
  price: string;
  compare_at_price: string;
  description: string;
  seo_title: string;
  seo_description: string;
  seo_product_url: string;
}

/** `id` is cosmetic — a React key and dnd handle only. Order is array position. */
export interface SpecRowDraft {
  id: string;
  label: string;
  value: string;
}

export interface TextItemDraft {
  id: string;
  text: string;
}

/**
 * A gallery image. `key` is cosmetic (React key + dnd id) because Duda's image
 * shape is only {url, alt} — there is no server-side image id to key on.
 * Position in the array IS the order, and index 0 is the product thumbnail.
 */
export interface ImageDraft {
  key: string;
  url: string;
  alt: string;
}

/**
 * A store-level option attached to this product, exposing only `choiceIds`.
 * Attachment order is meaningful (it's the display order on the product page),
 * so it participates in dirty comparison.
 */
export interface OptionRefDraft {
  id: string;
  name: string;
  type: string;
  choiceIds: string[];
}

/**
 * One generated variation. Duda regenerates these (with new ids and blanked
 * SKUs) whenever the attached option set changes, so `signature` — the
 * order-independent set of choice values — is the stable identity.
 */
export interface VariationDraft {
  id: string;
  signature: string;
  choices: { optionId: string; value: string }[];
  sku: string;
  price_difference: string;
  status: string;
}

/** Active catalog logo ids per kind. */
export type LogosDraft = Record<LogoKind, string[]>;

/**
 * The product's 3D model attachment. `filename`/`url` are carried alongside
 * `mediaAssetId` so the section can render itself right after an upload,
 * without waiting on a reload — only `mediaAssetId` participates in dirty
 * comparison (see normalize.ts `project()`).
 */
export interface Model3DDraft {
  mediaAssetId: string | null;
  filename: string | null;
  url: string | null;
}

/** Everything editable on the product page, in one comparable shape. */
export interface EditorSnapshot {
  details: NativeForm;
  images: ImageDraft[];
  options: OptionRefDraft[];
  variations: VariationDraft[];
  specs: SpecRowDraft[];
  benefits: TextItemDraft[];
  applications: TextItemDraft[];
  logos: LogosDraft;
  model3d: Model3DDraft;
}

/** A store-level option in the shared catalog, with its usage across products. */
export interface CatalogOption {
  id: string;
  name: string;
  type: string;
  choices: { id: string; value: string; usage: number }[];
  usage: number;
  products: { id: string; name: string; sku: string }[];
}

export interface OptionCatalog {
  max_options: number | null;
  max_choices_per_option: number | null;
  count: number;
  remaining: number | null;
  options: CatalogOption[];
}

/** Read-only context that sits alongside the editable snapshot. */
export interface EditorContext {
  /** The raw Duda product, for anything not modelled as an editable slice. */
  product: ProductDetail;
  /** Full logo catalog per kind, for rendering the activation toggles. */
  logoCatalog: Record<LogoKind, ProductLogoEntry[]>;
  /** The shared store-level option catalog. */
  optionCatalog: OptionCatalog;
  /** Store limit for generated variations per product. */
  maxVariations: number | null;
}

export type DirtyMap = Record<SectionKey, boolean>;
export type ErrorMap = Partial<Record<SectionKey, string>>;

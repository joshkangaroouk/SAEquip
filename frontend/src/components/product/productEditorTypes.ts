import type { ProductDetail, ProductLogoEntry } from "../../lib/types";

/** Sections that participate in the unified dirty/save flow. */
export type SectionKey = "details" | "specs" | "benefits" | "applications" | "logos";

export const SECTION_LABELS: Record<SectionKey, string> = {
  details: "Details",
  specs: "Technical Specs",
  benefits: "Key Benefits",
  applications: "Applications",
  logos: "Logos",
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

/** Active catalog logo ids per kind. */
export type LogosDraft = Record<LogoKind, string[]>;

/** Everything editable on the product page, in one comparable shape. */
export interface EditorSnapshot {
  details: NativeForm;
  specs: SpecRowDraft[];
  benefits: TextItemDraft[];
  applications: TextItemDraft[];
  logos: LogosDraft;
}

/** Read-only context that sits alongside the editable snapshot. */
export interface EditorContext {
  /** The raw Duda product, for sections not yet editable (images, variations). */
  product: ProductDetail;
  /** Full logo catalog per kind, for rendering the activation toggles. */
  logoCatalog: Record<LogoKind, ProductLogoEntry[]>;
}

export type DirtyMap = Record<SectionKey, boolean>;
export type ErrorMap = Partial<Record<SectionKey, string>>;

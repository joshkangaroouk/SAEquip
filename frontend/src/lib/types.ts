import type { CertScheme, DownloadKind } from "./downloadKinds";

export interface StoreInfo {
  site_name: string;
  max_products: number | null;
  product_count: number;
  remaining: number | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  /** Null when the product has no SKU — Duda doesn't default it to "". */
  sku: string | null;
  status: string;
  stock_status: string;
  type: string;
  price: string | null;
  thumbnail: string | null;
  variation_count: number;
  /** Hub-side category assignment. Titles come from GET /api/categories. */
  category_ids: string[];
  /**
   * When Duda created the product, decoded from its ULID id — Duda returns no
   * date field at all. Falls back to the Hub row's own timestamp.
   */
  created_at: string | null;
}

export interface MediaAsset {
  id: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  kind: string; // "image" | "file" | "model"
  alt: string | null;
  uploadedBy: string | null;
  createdAt: string;
  /**
   * Public (image/model) or short-lived signed (file).
   *
   * ⚠️ NULL for a file that could not be signed — GET /api/media catches
   * signing per item so one missing object cannot fail the whole page. It was
   * typed `string` after that change, which hid the null case from every
   * consumer; CLAUDE.md's rule is to fix the type in every mirror, not just
   * the crash site.
   */
  url: string | null;
  /** A file's first-page preview, or null — images are their own preview. */
  thumbnailUrl?: string | null;
  /**
   * Distinct PRODUCTS this asset reaches (through a logo, a download or a 3D
   * model) — the same number the usage popup lists. Product gallery images
   * are never counted; see backend services/assetUsage.ts.
   */
  usage: number;
}

/** One product in a usage popup — GET /api/media/:id/usage, /api/logos/:id/products. */
export interface UsageProduct {
  /** Duda's id: the product editor's route. */
  dudaProductId: string;
  name: string | null;
  sku: string | null;
  thumbnailUrl: string | null;
  /** How it uses the asset, e.g. "Download: Datasheet". Empty when there is only one way. */
  via: string[];
}

export interface UsageLogo {
  id: string;
  kind: "SA_LOGO" | "CERT_LOGO";
  label: string | null;
}

export interface AssetUsage {
  products: UsageProduct[];
  /** Catalogue logo entries using this image — present for the Media Centre only. */
  logos?: UsageLogo[];
}

export interface DudaImage {
  alt: string;
  url: string;
}

export interface ProductOption {
  id: string;
  name: string;
  type: string;
  choices: { id: string; value: string }[];
}

export interface VariationOption {
  option_id: string;
  option_name: string;
  choice_id: string;
  choice_value: string;
}

export interface Variation {
  id: string;
  /** Null on a freshly (re)generated variation — Duda doesn't default it to "". */
  sku: string | null;
  price_difference: string;
  status: string;
  images: DudaImage[];
  options: VariationOption[];
}

export interface ProductDetail {
  id: string;
  name: string;
  type: string;
  description: string;
  /** Null when the product has no SKU — Duda doesn't default it to "". */
  sku: string | null;
  status: string;
  stock_status: string;
  seo: { product_url: string; title: string; description: string };
  images: DudaImage[];
  prices: { currency: string; price: string; compare_at_price: string | null }[];
  options: ProductOption[];
  variations: Variation[];
  managed_inventory: boolean;
  requires_shipping: boolean;
  quantity?: number;
  categories: unknown[];
}

// --- Hub custom content (source of truth: Supabase DB) ---

export interface HubMediaAsset {
  id: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  alt: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface HubProductLogo {
  id: string;
  kind: "SA_LOGO" | "CERT_LOGO";
  label: string | null;
  alt: string | null;
  sortOrder: number;
  mediaAssetId: string;
  url: string;
}

/** A catalog logo annotated with its active state for a specific product. */
export interface ProductLogoEntry {
  id: string;
  label: string | null;
  alt: string | null;
  url: string;
  sortOrder: number;
  active: boolean;
}

export interface LogoCatalogEntry {
  id: string;
  kind: "SA_LOGO" | "CERT_LOGO";
  label: string | null;
  alt: string | null;
  sortOrder: number;
  mediaAssetId: string;
  url: string;
  usage: number;
}

export interface HubSpecRow {
  id: string;
  hubProductId: string;
  label: string;
  value: string;
  sortOrder: number;
}

export interface HubTextItem {
  id: string;
  hubProductId: string;
  kind: "BENEFIT" | "APPLICATION";
  text: string;
  sortOrder: number;
}

export interface HubDownload {
  id: string;
  title: string;
  /** Null for a download nobody has typed yet — it is on no resources page. */
  kind: DownloadKind | null;
  certScheme: CertScheme | null;
  gated: boolean;
  sortOrder: number;
  mediaAssetId: string;
  file: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string | null;
    /** First-page preview, or null if none has been rendered. */
    thumbnailUrl?: string | null;
  };
}


/** A product's attached 3D model (.glb), or null if none. */
export interface HubModel3D {
  mediaAssetId: string;
  filename: string;
  url: string;
}

export interface HubCustomPayload {
  hubProductId: string;
  dudaProductId: string;
  sku: string | null;
  name: string | null;
  logos: { sa: HubProductLogo[]; cert: HubProductLogo[] };
  specs: HubSpecRow[];
  benefits: HubTextItem[];
  applications: HubTextItem[];
  downloads: HubDownload[];
  model3d: HubModel3D | null;
  compatible: HubCompatible[];
  /** Duda category ids assigned to this product (stored Hub-side). */
  categoryIds: string[];
  /**
   * The description as authored — what the live Overview tab renders. Null
   * for a product the Hub has never written one for; Duda's copy is then the
   * only one, and the editor falls back to it.
   */
  descriptionHtml: string | null;
}



/** A "Compatible Products & Accessories" entry, as the API returns it. */
export interface HubCompatible {
  id: string;
  sortOrder: number;
  hubProductId: string;
  dudaProductId: string;
  name: string | null;
  sku: string | null;
  slug: string | null;
}

// --- Quote requests (public basket-page widget submissions) ---

export interface QuoteRequestItem {
  id: string;
  name: string;
  sku: string | null;
  options: Record<string, unknown> | null;
  price: string | null;
  quantity: number;
  /** The catalogue product the line matched, and its picture — null when none did. */
  dudaProductId: string | null;
  imageUrl: string | null;
}

export interface QuoteRequest {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string | null;
  /** The basket form's fields since 2026-10-02 — null on older quotes. */
  firstName: string | null;
  lastName: string | null;
  requiredBy: string | null;
  address: string | null;
  country: string | null;
  postcode: string | null;
  createdAt: string;
  emailSent: boolean;
  items: QuoteRequestItem[];
}

export interface QuotesResponse {
  emailEnabled: boolean;
  requests: QuoteRequest[];
}

/** One resource request — the "File Requests" form on a gated download. */
export interface ResourceRequest {
  id: string;
  name: string;
  /** Null only on rows from before the current form, which have none. */
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  phone: string | null;
  mobile: string | null;
  privacyConsent: boolean;
  marketingConsent: boolean;
  /** The consent wording agreed to, one sentence per line. */
  consentText: string | null;
  createdAt: string;
  file: {
    title: string | null;
    fileName: string | null;
    /** False once the download was removed from its product (the snapshot remains). */
    stillListed: boolean;
    productName: string | null;
    productSku: string | null;
    dudaProductId: string | null;
    imageUrl: string | null;
  };
}

export interface ResourceRequestsResponse {
  requests: ResourceRequest[];
}

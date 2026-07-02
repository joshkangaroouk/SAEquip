export interface StoreInfo {
  site_name: string;
  max_products: number | null;
  product_count: number;
  remaining: number | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  sku: string;
  status: string;
  stock_status: string;
  type: string;
  price: string | null;
  thumbnail: string | null;
  variation_count: number;
}

export interface MediaAsset {
  id: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  kind: string; // "image" | "file"
  alt: string | null;
  uploadedBy: string | null;
  createdAt: string;
  url: string; // public (image) or short-lived signed (file)
  usage: number;
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
  sku: string;
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
  sku: string;
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
  createdAt: string;
  mediaAsset: HubMediaAsset;
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
  hubProductId: string;
  mediaAssetId: string;
  title: string;
  gated: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  mediaAsset: HubMediaAsset;
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
}

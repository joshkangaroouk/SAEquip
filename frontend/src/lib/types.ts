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
  custom_field_count: number;
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

export interface DecoratedCustomField {
  id: string;
  label: string | null;
  kind: string; // "image" | "html" | ...
  value: string;
  image: DudaImage | null;
  unmapped: boolean;
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
  custom_fields: DecoratedCustomField[];
  managed_inventory: boolean;
  requires_shipping: boolean;
  categories: unknown[];
}

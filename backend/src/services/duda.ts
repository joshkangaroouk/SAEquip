import { env } from "../env.js";

/**
 * Duda store REST client (READ-ONLY).
 *
 * Path segments live in ONE place so they're trivial to correct if Duda's docs
 * differ from what we assumed. Auth is HTTP Basic (base64 "user:pass").
 */
const PATHS = {
  store: (site: string) => `/sites/multiscreen/${site}/ecommerce/store`,
  products: (site: string) => `/sites/multiscreen/${site}/ecommerce/products`,
  product: (site: string, productId: string) =>
    `/sites/multiscreen/${site}/ecommerce/products/${productId}`,
} as const;

// --- Types (verified against the live "099434f3" store) ---

export interface DudaImage {
  alt: string;
  url: string;
}

export interface DudaPrice {
  currency: string;
  price: string;
  compare_at_price: string | null;
}

export interface DudaSeo {
  product_url: string;
  title: string;
  description: string;
}

export interface DudaOptionChoice {
  id: string;
  value: string;
}

export interface DudaOption {
  id: string;
  name: string;
  type: string;
  choices: DudaOptionChoice[];
}

export interface DudaVariationOption {
  option_id: string;
  option_name: string;
  choice_id: string;
  choice_value: string;
}

export interface DudaVariation {
  id: string;
  sku: string;
  price_difference: string;
  status: string;
  images: DudaImage[];
  options: DudaVariationOption[];
  external_id?: string | null;
}

/** Custom fields are READ-ONLY and carry NO label from Duda — only id + value. */
export interface DudaCustomField {
  id: string;
  value: string; // HTML or a URL string
  image?: DudaImage | null;
}

export type DudaProductType = "PHYSICAL" | "DIGITAL" | "SERVICE" | "DONATION";
export type DudaProductStatus = "ACTIVE" | "HIDDEN";

export interface DudaProduct {
  id: string;
  name: string;
  type: DudaProductType | string;
  description: string; // HTML
  seo: DudaSeo;
  status: DudaProductStatus | string;
  sku: string;
  stock_status: string;
  images: DudaImage[];
  prices: DudaPrice[];
  managed_inventory: boolean;
  requires_shipping: boolean;
  categories: unknown[];
  options: DudaOption[];
  variations: DudaVariation[];
  custom_fields: DudaCustomField[];
  external_id?: string | null;
}

export interface DudaStore {
  site_name: string;
  features?: {
    max_products?: number;
    max_variations_per_product?: number;
    max_options?: number;
    max_choices_per_option?: number;
  };
}

export interface DudaProductList {
  results: DudaProduct[];
  total_responses: number;
  offset: number;
  limit: number;
}

/** Error carrying the upstream HTTP status + response body text. */
export class DudaApiError extends Error {
  readonly status: number;
  readonly body: string;
  readonly url: string;

  constructor(status: number, body: string, url: string) {
    super(`Duda API ${status} for ${url}: ${body.slice(0, 500)}`);
    this.name = "DudaApiError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

function authHeader(): string {
  const token = Buffer.from(`${env.DUDA_API_USER}:${env.DUDA_API_PASS}`).toString("base64");
  return `Basic ${token}`;
}

async function dudaRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${env.DUDA_API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DudaApiError(res.status, text, url);
  }

  // Some write responses have an empty body — don't choke on JSON.parse.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const dudaGet = <T>(path: string): Promise<T> => dudaRequest<T>("GET", path);

/**
 * The ONLY product keys this step is allowed to write. Notably absent:
 * images, options, variations, custom_fields, categories — those are managed
 * elsewhere, and sending them would REPLACE the live collections.
 */
export interface DudaProductUpdate {
  name?: string;
  description?: string;
  sku?: string;
  type?: DudaProductType;
  status?: DudaProductStatus;
  stock_status?: "IN_STOCK" | "OUT_OF_STOCK";
  requires_shipping?: boolean;
  managed_inventory?: boolean;
  quantity?: number;
  prices?: { price: string; compare_at_price?: string | null }[];
  seo?: { title?: string; description?: string; product_url?: string };
}

const EDITABLE_PRODUCT_KEYS = [
  "name",
  "description",
  "sku",
  "type",
  "status",
  "stock_status",
  "requires_shipping",
  "managed_inventory",
  "quantity",
  "prices",
  "seo",
] as const satisfies readonly (keyof DudaProductUpdate)[];

const site = () => env.DUDA_SITE_NAME;

export const duda = {
  getStore(): Promise<DudaStore> {
    return dudaGet<DudaStore>(PATHS.store(site()));
  },

  listProducts({ limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<DudaProductList> {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return dudaGet<DudaProductList>(`${PATHS.products(site())}?${qs.toString()}`);
  },

  getProduct(productId: string): Promise<DudaProduct> {
    return dudaGet<DudaProduct>(PATHS.product(site(), productId));
  },

  /**
   * PATCH only the provided editable fields, then re-fetch the full product.
   * The body is built from the whitelist above and undefined values are
   * stripped — collection fields (images/variations/custom_fields) can never
   * be sent, so a native-field edit never wipes the gallery/variations.
   */
  async updateProduct(productId: string, partial: DudaProductUpdate): Promise<DudaProduct> {
    const body: Record<string, unknown> = {};
    for (const key of EDITABLE_PRODUCT_KEYS) {
      if (partial[key] !== undefined) body[key] = partial[key];
    }
    await dudaRequest<unknown>("PATCH", PATHS.product(site(), productId), body);
    return this.getProduct(productId);
  },
};

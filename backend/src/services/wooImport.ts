import { parse } from "csv-parse/sync";

/**
 * WooCommerce CSV export → typed products, for the legacy-catalogue migration.
 *
 * Deliberately PURE: no network, no DB, no filesystem. The import script owns
 * all side effects, so this half can be reasoned about (and re-run) freely,
 * and the later content stages can reuse the same parse.
 *
 * The export is a wide, sparse sheet (346 columns) mixing WooCommerce's own
 * fields with ACF meta. Only Stage 1 fields are modelled as first-class
 * properties; everything else stays accessible on `raw` so Stages 2-3 can read
 * descriptions and the ACF repeaters without a second parser.
 */

/** A published parent product, as Stage 1 needs it. */
export interface WooProduct {
  /** WordPress post ID — the migration's idempotency key. Unique and stable. */
  wpId: string;
  /** WooCommerce `Type`: "simple", "variable", "simple, virtual"… */
  type: string;
  name: string;
  /** May be blank (3 of 96) or shared with another product (4 SKUs, 9 rows). */
  sku: string;
  /** Duda's create API requires a prices array; "0" where Woo has nothing. */
  price: string;
  /** Ordered gallery URLs. `[0]` becomes the Duda thumbnail. */
  images: string[];
  /** Every column, for the later content stages. */
  raw: Record<string, string>;
}

export interface IntegrityReport {
  total: number;
  missingSku: WooProduct[];
  /** SKU → the products sharing it. Only entries with 2+ products. */
  duplicateSkus: Record<string, WooProduct[]>;
  noImages: WooProduct[];
  totalImageRefs: number;
  uniqueImageUrls: string[];
  /** Not http(s), or containing whitespace — would fail Duda's ingest. */
  malformedImageUrls: string[];
}

/**
 * WooCommerce's `Published` column: 1 = publish, 0 = draft, -1 = private.
 * Only 1 is live on the site.
 */
const PUBLISHED = "1";

/**
 * `variation` rows are the CHILD rows of a variable product, not products in
 * their own right — they'd import as 386 phantom duplicates. Their parent
 * (`Type: "variable"`) is the row that represents the product.
 */
const VARIATION_TYPE = "variation";

/**
 * Parse the export and keep only what is actually live on the WordPress site.
 *
 * `columns: true` gives header-keyed rows; `bom: true` is required because the
 * export's first header is `﻿ID` and would otherwise never match.
 * `relax_column_count` guards against the trailing-comma raggedness these
 * exports sometimes have.
 */
export function parsePublishedProducts(csvText: string): WooProduct[] {
  const rows = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  return rows
    .filter((r) => (r.Type ?? "").trim() !== VARIATION_TYPE)
    .filter((r) => (r.Published ?? "").trim() === PUBLISHED)
    .map(toProduct);
}

function toProduct(raw: Record<string, string>): WooProduct {
  const price = (raw["Regular price"] ?? "").trim();
  return {
    wpId: (raw.ID ?? "").trim(),
    type: (raw.Type ?? "").trim(),
    name: (raw.Name ?? "").trim(),
    sku: (raw.SKU ?? "").trim(),
    // Duda rejects a create without `prices`, and SAEquip shows no price on the
    // front end (enquiry flow), so a blank Woo price is safely "0".
    price: price || "0",
    images: imageUrls(raw),
    raw,
  };
}

/**
 * The `Images` column is a comma-separated URL list in gallery order.
 *
 * Safe to split on "," because WooCommerce percent-encodes URLs; the 96
 * published products were checked and none contains a literal comma or
 * whitespace in a URL.
 */
export function imageUrls(raw: Record<string, string>): string[] {
  return (raw.Images ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

/** Duda ingests by fetching the URL, so anything not absolute http(s) fails. */
export function isIngestableUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/.test(url);
}

/**
 * Everything about the source data that a human should see BEFORE any write.
 * Surfaces the known defects (duplicate/missing SKUs) rather than letting them
 * fail silently mid-import.
 */
export function reportIntegrity(products: WooProduct[]): IntegrityReport {
  const bySku = new Map<string, WooProduct[]>();
  for (const p of products) {
    if (!p.sku) continue;
    const list = bySku.get(p.sku) ?? [];
    list.push(p);
    bySku.set(p.sku, list);
  }

  const duplicateSkus: Record<string, WooProduct[]> = {};
  for (const [sku, list] of bySku) {
    if (list.length > 1) duplicateSkus[sku] = list;
  }

  const allUrls = products.flatMap((p) => p.images);

  return {
    total: products.length,
    missingSku: products.filter((p) => !p.sku),
    duplicateSkus,
    noImages: products.filter((p) => p.images.length === 0),
    totalImageRefs: allUrls.length,
    uniqueImageUrls: [...new Set(allUrls)],
    malformedImageUrls: [...new Set(allUrls.filter((u) => !isIngestableUrl(u)))],
  };
}

/**
 * Reads an ACF repeater family into an ordered list of values.
 *
 * ACF exports each repeater row as its own column
 * (`Meta: <name>_<index>_<field>`) and ALSO writes a `_`-prefixed mirror
 * holding the internal field key — those mirrors must be ignored or every
 * value appears twice. Indices are sorted numerically because the export's
 * column order is not guaranteed and string sorting puts 10 before 2.
 *
 * Unused by Stage 1; here so Stage 3 (specs/benefits/applications/logos) reads
 * the same source of truth.
 */
export function acfRepeater(
  raw: Record<string, string>,
  name: string,
  field: string,
): string[] {
  const re = new RegExp(`^Meta: ${escapeRegExp(name)}_(\\d+)_${escapeRegExp(field)}$`);
  const found: { index: number; value: string }[] = [];

  for (const [key, value] of Object.entries(raw)) {
    const m = key.match(re);
    if (!m) continue;
    const v = (value ?? "").trim();
    if (v) found.push({ index: Number(m[1]), value: v });
  }

  return found.sort((a, b) => a.index - b.index).map((f) => f.value);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

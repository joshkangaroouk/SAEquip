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

/**
 * One row of a product's technical-spec table, as stored in `SpecRow`.
 *
 * Either side may be empty — never both — and each combination means
 * something different on the rendered table:
 *
 * | label | value | meaning |
 * |---|---|---|
 * | set | set | an ordinary spec |
 * | **empty** | set | ANOTHER LINE of the spec above (e.g. PROTECTION's six) |
 * | set | **empty** | a sub-heading inside the table ("SYSTEM INCLUDES") |
 *
 * The multi-line shape is how the source data already encodes it, not a
 * convention invented here — 225 of the 691 exported rows have a blank title.
 */
export interface WooSpecRow {
  label: string;
  value: string;
}

/**
 * Reads the `technical_specs` ACF repeater into ordered label/value rows.
 *
 * ⚠️ Cannot use `acfRepeater()`: that reads ONE field and drops blanks, which
 * is right for the single-column benefit/application repeaters but destroys
 * this one. Here a blank title is *meaningful* (it continues the row above)
 * and the two columns must stay index-aligned, so dropping blanks would
 * silently re-parent every continuation line to the wrong spec.
 *
 * Both sides go through `sanitise` — the caller passes `sanitisePlainText`,
 * keeping this module free of the sanitiser's `sanitize-html` dependency, and
 * therefore free of the import-graph weight that once broke a serverless
 * deploy. Values are stored as plain text and rendered with `textContent`.
 *
 * Rows blank on BOTH sides are ACF's trailing empties and are dropped. A
 * leading continuation row would have nothing to attach to, so it is reported
 * via `orphans` rather than silently kept or dropped (none exist today, and a
 * future re-export should say so loudly rather than shift a table by one).
 */
export function specRows(
  raw: Record<string, string>,
  sanitise: (s: string) => string,
): { rows: WooSpecRow[]; orphans: WooSpecRow[] } {
  const prefix = "technical_specs_repeat";
  const inner = "technical_specs_repeat_";
  const re = new RegExp(`^Meta: ${escapeRegExp(prefix)}_(\\d+)_${escapeRegExp(inner)}_(title|value)$`);

  const byIndex = new Map<number, { title: string; value: string }>();
  for (const [key, cell] of Object.entries(raw)) {
    const m = key.match(re);
    if (!m) continue;
    const i = Number(m[1]);
    const slot = byIndex.get(i) ?? { title: "", value: "" };
    if (m[2] === "title") slot.title = cell ?? "";
    else slot.value = cell ?? "";
    byIndex.set(i, slot);
  }

  const rows: WooSpecRow[] = [];
  const orphans: WooSpecRow[] = [];
  for (const i of [...byIndex.keys()].sort((a, b) => a - b)) {
    const slot = byIndex.get(i)!;
    const label = titleCaseSpecLabel(sanitise(slot.title));
    const value = sanitise(slot.value);
    if (!label && !value) continue; // ACF trailing empty
    if (!label && rows.length === 0) {
      orphans.push({ label, value });
      continue;
    }
    rows.push({ label, value });
  }
  return { rows, orphans };
}

/**
 * Tokens that must keep their exact casing when a shouty spec label is
 * converted to sentence case. Keyed by upper-case form.
 *
 * Derived from the 158 distinct labels actually in the catalogue, not guessed:
 * without this, `LED LIFE` becomes "Led Life" and `1 X EX AIR MOVER` becomes
 * "1 X Ex Air Mover".
 */
const SPEC_LABEL_ACRONYMS = new Map<string, string>(
  [
    "LED", "EX", "IP", "SA", "AC", "DC", "UV", "AR", "PSI", "PSIG", "VAC", "RPM",
    "CFM", "HEPA", "ATEX", "UKEX", "IECEx", "NPU", "HSG", "CDG", "BS", "UK",
  ].map((a) => [a.toUpperCase(), a]),
);

/**
 * Convert an ALL-CAPS spec label to capitalised words, preserving acronyms.
 *
 * ⚠️ CSS cannot do this. `text-transform:capitalize` only upper-cases the
 * first letter of each word and leaves the rest untouched, so on `CERTIFICATION`
 * it is a no-op — the text has to be transformed in the data.
 *
 * ⚠️ Only touches labels that are ENTIRELY upper case. 45 of the 158 distinct
 * labels are already deliberately mixed ("Free Airflow (with 30cm Connectors)"),
 * and running those through a title-caser would capitalise "with" and make them
 * worse. Shouting is the signal that a label was never cased on purpose.
 *
 * Two preservation rules, both conservative:
 *   - a token containing a DIGIT is kept verbatim — `440VAC`, `100PSIG`, `1M`,
 *     `30CM`. These are measurements and spec codes whose correct casing
 *     cannot be inferred, and getting one wrong is worse than leaving it loud.
 *   - a token in SPEC_LABEL_ACRONYMS is kept in its canonical form.
 *
 * Everything else has its letter RUNS capitalised rather than being split on
 * spaces alone, which is what makes `MIN/MAX PRESSURE` → "Min/Max Pressure"
 * and `POWER (WATTS)` → "Power (Watts)" come out right.
 */
export function titleCaseSpecLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  // Mixed case already ⇒ authored deliberately, leave alone.
  if (trimmed !== trimmed.toUpperCase()) return trimmed;

  return trimmed
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token) || !token) return token;
      if (/\d/.test(token)) return token; // measurement or code
      const acronym = SPEC_LABEL_ACRONYMS.get(token.replace(/[^A-Za-z]/g, "").toUpperCase());
      if (acronym && token.replace(/[^A-Za-z]/g, "").length === token.length) return acronym;
      return token.replace(/[A-Za-z]+/g, (run) => {
        const canonical = SPEC_LABEL_ACRONYMS.get(run.toUpperCase());
        if (canonical) return canonical;
        return run.charAt(0).toUpperCase() + run.slice(1).toLowerCase();
      });
    })
    .join("");
}


/**
 * The SA range logos a product carries, derived from its `Categories`.
 *
 * ⚠️ SA range logos are in NO logo field in the export. `associated_logos`
 * holds certification marks only, and the ranges have to come from the
 * Categories column — which mixes them in with industry sectors. Verified per
 * field before relying on it: `Name` carries the range for 3 of 96 products
 * and `Tags` never does (tags are sectors).
 *
 * ⚠️ Categories are matched EXACTLY, never by substring. "SA Cyclone Rental"
 * contains "SA Cyclone", so a substring match double-counts Cyclone and
 * silently inflates every range.
 *
 * Rental is orthogonal to the ranges — a product is both `SA Cyclone` and
 * `Rental` — which is why 139 links cover 94 products rather than 139.
 */
const SA_RANGE_CATEGORIES: Record<string, readonly string[]> = {
  Cyclone: ["SA Cyclone", "SA Cyclone Rental"],
  Endure: ["SA ENDURE"],
  Flexiheat: ["SA Flexiheat"],
  Lumin: ["SA Lumin"],
  Powernet: ["SA Powernet", "SA Powernet Rental"],
};

/**
 * Products whose SA range cannot be derived, with the range to use instead.
 *
 * Both are named LUMIN but sit outside the `SA Lumin` category, so the
 * derivation correctly finds nothing. Confirmed by Josh (2026-09-10) that
 * both are Lumin. Keyed on WordPress id because neither has a SKU — they are
 * the same two products on the SKU fix-list.
 */
const SA_RANGE_OVERRIDES: Record<string, readonly string[]> = {
  "13045": ["Lumin"], // SA LUMIN Tasklight Base Unit
  "13050": ["Lumin"], // SA LUMIN Tasklight Adjustable Floor Stand
};

export function productCategories(raw: Record<string, string>): string[] {
  return (raw["Categories"] ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function saRangeLogos(product: WooProduct): string[] {
  const override = SA_RANGE_OVERRIDES[product.wpId];
  if (override) return [...override];

  const cats = new Set(productCategories(product.raw));
  const found: string[] = [];
  for (const [range, matches] of Object.entries(SA_RANGE_CATEGORIES)) {
    if (matches.some((m) => cats.has(m))) found.push(range);
  }
  // Any rental category at all earns the Rental logo.
  if ([...cats].some((c) => c === "Rental" || c.endsWith("Rental"))) found.push("Rental");
  return found;
}

/**
 * The certification marks a product carries, from the `associated_logos`
 * repeater. Values are the raw CSV tokens (`ATEX`, `zone-1-2`, `madeinuk`…),
 * which the import maps onto Logo rows.
 */
export function certLogoValues(product: WooProduct): string[] {
  return acfRepeater(product.raw, "associated_logos", "associated_logos_name");
}

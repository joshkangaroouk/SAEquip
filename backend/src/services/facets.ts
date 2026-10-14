/**
 * A product's listing facets, worked out from its logos: the "Use" (ATEX
 * range or Industrial range), its SA range and its ATEX zones. Pure and
 * import-free, so the public routes, scripts and tests share one rule.
 *
 * ⚠️ SA ENDURE = Industrial range: industrial use only, NEVER for hazardous
 * areas (SA Equip, 14 Oct 2026). Every other SA range (CYCLONE, LUMIN,
 * POWERNET, FLEXIHEAT) is an ATEX range. "ATEX range" does not claim that the
 * product itself is certified (a bracket is not): the zone logos say that.
 *
 * Logos are matched on the media FILE first, as the import does; labels and
 * alt text can be renamed on the Logos page. A logo whose file is not one of
 * the known ones (say, a replaced image) falls back to its label/alt, so
 * replacing a logo image does not silently drop products out of a filter.
 * SA Rental is not a range and is ignored.
 */
export type Use = "atex" | "industrial";
export type RangeKey = "cyclone" | "endure" | "lumin" | "powernet" | "flexiheat";
export type ZoneKey = "zone-0" | "zone-1-2" | "zone-20" | "zone-21-22";
export interface FacetLogo {
  kind: string;
  filename?: string | null;
  label?: string | null;
  alt?: string | null;
}
export interface Facets {
  use: Use | null;
  range: RangeKey | null;
  zones: ZoneKey[];
}

const RANGE_FILES: Record<string, RangeKey> = {
  "cyclone.jpg": "cyclone", "endure.jpg": "endure", "lumin.jpg": "lumin", "powernet.jpg": "powernet", "flexiheat.jpg": "flexiheat",
};
const ZONE_FILES: Record<string, ZoneKey> = {
  "zone-0.png": "zone-0", "zone-1-2.png": "zone-1-2", "zone-20.png": "zone-20", "zone-21-22.png": "zone-21-22",
};
/** Fallbacks on label/alt, most specific first ("zone 21-22" before "zone 20"…). */
const RANGE_WORDS: [RegExp, RangeKey][] = [
  [/cyclone/i, "cyclone"], [/endure/i, "endure"], [/lumin/i, "lumin"], [/powernet/i, "powernet"], [/flexi\s*heat/i, "flexiheat"],
];
const ZONE_WORDS: [RegExp, ZoneKey][] = [
  [/zone\s*21\s*-\s*22/i, "zone-21-22"], [/zone\s*20\b/i, "zone-20"], [/zone\s*1\s*-\s*2/i, "zone-1-2"], [/zone\s*0\b/i, "zone-0"],
];
/** When a product somehow carries two ranges, ENDURE wins: the safe reading for a safety rule. */
const RANGE_ORDER: RangeKey[] = ["endure", "cyclone", "lumin", "powernet", "flexiheat"];
const ZONE_ORDER: ZoneKey[] = ["zone-0", "zone-1-2", "zone-20", "zone-21-22"];

const words = (l: FacetLogo) => `${l.label ?? ""} ${l.alt ?? ""}`;

export function productFacets(logos: FacetLogo[]): Facets {
  const ranges = new Set<RangeKey>();
  const zones = new Set<ZoneKey>();
  for (const l of logos) {
    const file = (l.filename ?? "").toLowerCase();
    if (l.kind === "SA_LOGO") {
      const r = RANGE_FILES[file] ?? RANGE_WORDS.find(([re]) => re.test(words(l)))?.[1];
      if (r) ranges.add(r);
    } else if (l.kind === "CERT_LOGO") {
      const z = ZONE_FILES[file] ?? ZONE_WORDS.find(([re]) => re.test(words(l)))?.[1];
      if (z) zones.add(z);
    }
  }
  const range = RANGE_ORDER.find((r) => ranges.has(r)) ?? null;
  return {
    use: range === "endure" ? "industrial" : range ? "atex" : null,
    range,
    zones: ZONE_ORDER.filter((z) => zones.has(z)),
  };
}

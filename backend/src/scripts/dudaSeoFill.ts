import "dotenv/config";
import { duda } from "../services/duda.js";
import { syncHubProduct } from "../services/hubProduct.js";
import { sanitisePlainText } from "../services/descriptionHtml.js";
import { prisma } from "../prisma.js";
import { productFacets } from "../services/facets.js";

/**
 * Write `seo.title` and `seo.description` for every product.
 *
 *   npm run duda:seo-fill --workspace=backend            # preview, writes nothing
 *   npm run duda:seo-fill --workspace=backend -- --confirm
 *   npm run duda:seo-fill --workspace=backend -- --confirm --force   # overwrite existing
 *
 * ⚠️ Probed before writing: a product's `seo` is NOT full-replacement.
 * Sending `{title}` alone preserves `product_url` AND a previously-set
 * `description` (verified on a throwaway). That matters because
 * `seo.product_url` is the slug the public widget resolves by and the live
 * page URL — blanking it would 404 every product. Note this contradicts the
 * defensive "send seo whole" rule the EDITOR follows; the editor is not wrong
 * to be careful, but a bulk write does not need to be.
 *
 * ⚠️ Existing values are never overwritten without `--force`. Anything a human
 * has written by hand beats anything generated from a template. The one
 * exception is this script's OWN sentence "Certified equipment for hazardous
 * areas from SA Equip." where it is not true (fixed 2026-10-15): it used to be
 * added to every short description, so 21 brackets, films and bags with no
 * certification logo claimed to be certified. Such a description is rewritten.
 */

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);

const BRAND = "SAEquip";
/** Google truncates around 60 characters; past that the tail is invisible. */
const TITLE_MAX = 60;
/** ~155 keeps the whole line visible on desktop and most mobile SERPs. */
const DESC_TARGET = 155;
const DESC_MIN = 70;

/**
 * `{Name} | SAEquip`, dropping the brand when the name alone fills the line.
 *
 * Primary keyword first, brand last — the product name IS the search term
 * here, so it must not be pushed out of the visible width by a suffix. Long
 * names are left whole rather than truncated: a cut-off product name reads as
 * broken, and Google will elide it more gracefully than a hard chop would.
 */
export function seoTitle(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  const withBrand = `${clean} | ${BRAND}`;
  return withBrand.length <= TITLE_MAX ? withBrand : clean;
}

/** Split into sentences without losing the terminator. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Sentences that describe the product, not the transaction.
 *
 * Several descriptions open with "Disclaimer: available for purchase only…"
 * or "Sales Team will confirm once quote is received." True, and useless as
 * the first thing a searcher reads — a meta description is ad copy, and
 * leading with a caveat wastes the only line you get. Dropped only when
 * something else remains, since for a couple of products it is the entire
 * description.
 */
function descriptive(all: string[]): string[] {
  const boilerplate = /^(disclaimer|please note|sales team|n\.?b\.?)\b/i;
  const kept = all.filter((s) => !boilerplate.test(s));
  return kept.length ? kept : all;
}

/** Significant words of a name, for a fuzzy "is this already mentioned?". */
function keyWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/**
 * A meta description from whatever the product actually has.
 *
 * Prefers whole sentences from the product's own description — copy a human
 * wrote about this product beats any template. Falls back to benefits, then
 * applications, then bare name plus SKU, so the two products with no content
 * at all still get something unique rather than nothing.
 */
export const CERTIFIED_TAIL = "Certified equipment for hazardous areas from SA Equip.";
/**
 * The closing sentence a short description gets, true for THIS product:
 * certified only when it carries a hazardous-area certification logo (EX,
 * IECEx, Inmetro, a Zone; not UKCA or Made in Britain), never for SA ENDURE.
 */
export function contextSentence(p: { certified: boolean; industrial: boolean; accessory: boolean }): string {
  if (p.industrial) return "Industrial equipment from SA Equip.";
  if (p.certified) return CERTIFIED_TAIL;
  if (p.accessory) return "An accessory for SA Equip's hazardous-area equipment.";
  return "From SA Equip.";
}

export function seoDescription(input: {
  name: string;
  descriptionHtml?: string | null;
  benefits: string[];
  applications: string[];
  sku?: string | null;
  /** The closing sentence for short copy, from contextSentence(). */
  context: string;
}): string {
  const body = sanitisePlainText(input.descriptionHtml ?? "");

  let out = "";
  for (const s of descriptive(sentences(body))) {
    if (!out) {
      out = s;
      if (out.length >= DESC_TARGET) break;
      continue;
    }
    if (`${out} ${s}`.length > DESC_TARGET) break;
    out = `${out} ${s}`;
  }

  // No usable description — build from the structured content instead.
  if (out.length < DESC_MIN) {
    const parts: string[] = [];
    const lead = out || input.name.trim();
    parts.push(lead.replace(/[.\s]+$/, "") + ".");
    for (const b of input.benefits) {
      const next = `${parts.join(" ")} ${b.replace(/[.\s]+$/, "")}.`;
      if (next.length > DESC_TARGET) break;
      parts.push(b.replace(/[.\s]+$/, "") + ".");
    }
    if (parts.join(" ").length < DESC_MIN && input.applications.length) {
      const apps = input.applications.slice(0, 3).join(", ");
      const next = `${parts.join(" ")} For ${apps}.`;
      if (next.length <= DESC_TARGET) parts.push(`For ${apps}.`);
    }
    out = parts.join(" ");
  }

  /*
   * The product NAME must appear. Two reasons, and the second is the one that
   * bites: it is the term people search for, and product names are unique in
   * Duda — so including it is what stops accessories with shared boilerplate
   * ("available for purchase only…") from sharing a meta description
   * verbatim. Five did before this.
   */
  /*
   * Fuzzy, not exact. An exact substring test produced "Trolley for EX
   * Heater. Trolley for SA FLEXIHEAT EX Heater." — the name IS mentioned,
   * just with the range name inserted mid-phrase. Matching on significant
   * words instead treats that as already covered.
   */
  const words = keyWords(input.name);
  const haystack = out.toLowerCase();
  const present = words.length
    ? words.filter((w) => haystack.includes(w)).length / words.length >= 0.7
    : true;
  if (!present) {
    out = `${input.name.trim().replace(/[.\s]+$/, "")}. ${out}`.trim();
  }

  // Short accessory copy — give it context rather than shipping a fragment.
  if (out.length < DESC_MIN) {
    const tail = input.context;
    if (`${out} ${tail}`.length <= DESC_TARGET + 5) out = `${out} ${tail}`;
    else if (input.sku) out = `${out} SKU ${input.sku}.`;
  }

  // One sentence longer than the whole budget: cut on a word boundary, never
  // mid-word, and mark the elision so it does not read as a typo.
  if (out.length > DESC_TARGET + 5) {
    const cut = out.slice(0, DESC_TARGET);
    const lastSpace = cut.lastIndexOf(" ");
    out = `${cut.slice(0, lastSpace > 40 ? lastSpace : DESC_TARGET).replace(/[,;:\s]+$/, "")}…`;
  }
  return out.replace(/\s+/g, " ").trim();
}

async function main() {
  const force = flag("force");
  const live = await duda.listAllProducts();
  const hub = await prisma.hubProduct.findMany({
    select: {
      dudaProductId: true,
      descriptionHtml: true,
      sku: true,
      isAccessory: true,
      textItems: { select: { kind: true, text: true }, orderBy: { sortOrder: "asc" } },
      logos: { select: { logo: { select: { kind: true, label: true, alt: true, mediaAsset: { select: { filename: true } } } } } },
    },
  });
  const byId = new Map(hub.map((h) => [h.dudaProductId, h]));

  const plan = live.map((p) => {
    const h = byId.get(p.id);
    const benefits = (h?.textItems ?? []).filter((t) => t.kind === "BENEFIT").map((t) => t.text);
    const applications = (h?.textItems ?? []).filter((t) => t.kind === "APPLICATION").map((t) => t.text);
    const logos = (h?.logos ?? []).map((l) => ({ kind: l.logo.kind, label: l.logo.label, alt: l.logo.alt, filename: l.logo.mediaAsset.filename }));
    const context = contextSentence({
      certified: logos.some((l) => l.kind === "CERT_LOGO" && !/ukca|made.?in.?brit/i.test(`${l.label} ${l.alt} ${l.filename}`)),
      industrial: productFacets(logos).use === "industrial",
      accessory: !!h?.isAccessory,
    });
    const existingDesc = (p.seo?.description ?? "").trim();
    return {
      id: p.id,
      name: p.name ?? "",
      existingTitle: (p.seo?.title ?? "").trim(),
      existingDesc,
      // Our own certification sentence on a product it is not true of.
      falseClaim: existingDesc.includes(CERTIFIED_TAIL) && context !== CERTIFIED_TAIL,
      title: seoTitle(p.name ?? ""),
      description: seoDescription({
        name: p.name ?? "",
        descriptionHtml: h?.descriptionHtml,
        benefits,
        applications,
        sku: h?.sku,
        context,
      }),
    };
  });

  /*
   * Last-resort de-duplication. Two products whose descriptions still match
   * exactly get the loser disambiguated by its SKU — duplicate meta
   * descriptions are a real ranking problem, and shipping 96 of these without
   * checking would be how you find out months later.
   */
  const seen = new Map<string, string>();
  for (const p of plan) {
    const first = seen.get(p.description);
    if (!first) {
      seen.set(p.description, p.name);
      continue;
    }
    const sku = byId.get(p.id)?.sku;
    if (sku && `${p.description} SKU ${sku}.`.length <= DESC_TARGET + 12) {
      p.description = `${p.description} SKU ${sku}.`;
    }
  }

  const work = plan.filter((p) => force || !p.existingTitle || !p.existingDesc || p.falseClaim);

  console.log(`\n${live.length} products, ${work.length} to write (${work.filter((p) => p.falseClaim).length} correcting a certification claim that is not true)\n`);
  for (const p of work) {
    console.log(`  ${p.name}${p.falseClaim ? `  (was: ${p.existingDesc})` : ""}`);
    console.log(`    title (${String(p.title.length).padStart(2)}) ${p.title}`);
    console.log(`    desc  (${String(p.description.length).padStart(3)}) ${p.description}\n`);
  }

  const longTitles = work.filter((p) => p.title.length > TITLE_MAX);
  const shortDescs = work.filter((p) => p.description.length < DESC_MIN);
  const dupeDesc = new Set<string>();
  const dupes = work.filter((p) => (dupeDesc.has(p.description) ? true : (dupeDesc.add(p.description), false)));
  console.log(`  titles over ${TITLE_MAX}: ${longTitles.length}${longTitles.length ? " → " + longTitles.map((p) => p.name).join(", ") : ""}`);
  console.log(`  descriptions under ${DESC_MIN}: ${shortDescs.length}${shortDescs.length ? " → " + shortDescs.map((p) => p.name).join(", ") : ""}`);
  console.log(`  duplicate descriptions: ${dupes.length}${dupes.length ? " → " + dupes.map((p) => p.name).join(", ") : ""}`);

  if (!flag("confirm")) {
    console.log("\n(preview only — add --confirm to write)\n");
    return;
  }

  console.log("\nWriting…\n");
  let ok = 0;
  const failures: string[] = [];
  for (const p of work) {
    try {
      // title + description only. product_url is preserved (probed), and not
      // sending it means this can never change a live URL by accident.
      // A correction rewrites only the description: the title may be a human's.
      const updated = await duda.updateProduct(p.id, {
        seo: p.existingTitle && !force ? { description: p.description } : { title: p.title, description: p.description },
      });
      await syncHubProduct(updated);
      ok++;
      console.log(`  ✓ ${p.name}`);
    } catch (err) {
      failures.push(`${p.name}: ${err instanceof Error ? err.message.slice(0, 140) : "?"}`);
    }
  }
  console.log(`\n=== ${ok}/${work.length} written ===`);
  for (const f of failures) console.log(`  ⚠ ${f}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

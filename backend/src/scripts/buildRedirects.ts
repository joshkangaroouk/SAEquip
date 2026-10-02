/**
 * Build the WordPress → Duda redirect map for the saequip.com cutover.
 *
 *   npm run redirects:build --workspace=backend
 *
 * READ-ONLY: it writes two files and changes nothing on any site.
 *   redirects/saequip-redirects.csv  — the map a loader applies, one rule per row
 *   redirects/REVIEW.md              — the rules, the counts, and every judgment call
 *
 * Inputs (gathered while WordPress is still live, kept in the gitignored
 * migration/redirects/): the Yoast sitemap, the WP REST lists of products,
 * product categories, product tags, pages, posts, product ranges and
 * distributors; migration/ledger.json (wpId → Duda product id) and
 * migration/downloads.json (which product offered each PDF).
 *
 * ⚠️ Every TARGET is fetched on the live Duda site and must answer 200, or the
 * row is marked BROKEN and REVIEW.md lists it. A redirect to a 404 is worse
 * than no redirect: it throws away the old URL's ranking AND lands the visitor
 * on an error page.
 *
 * ⚠️ A path that is the same on both sites gets NO rule: Duda already serves
 * `/product/x/` by 301-ing to `/product/x` (measured), so a rule would only add
 * a hop.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma.js";
import { toCsv } from "../services/csv.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = path.join(ROOT, "migration/redirects");
const OUT = path.join(ROOT, "redirects");
const DUDA = "https://saequip.multiscreensite.com";
const WP = "https://saequip.com";

const json = <T>(f: string): T => JSON.parse(readFileSync(path.join(SRC, f), "utf8")) as T;
const pathOf = (url: string) => new URL(url).pathname;
/** Duda strips a trailing slash itself, so sources and targets are compared without one. */
const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** How sure a mapping is — REVIEW.md lists everything below `equivalent`. */
type Confidence = "exact" | "equivalent" | "closest" | "fallback" | "missing" | "conflict";
interface Row {
  source: string;
  target: string;
  kind: string;
  confidence: Confidence;
  note: string;
}

const rows: Row[] = [];
let identical = 0;
function add(kind: string, sourcePath: string, target: string, confidence: Confidence, note = "") {
  const source = norm(sourcePath);
  if (norm(target) === source) {
    identical++;
    return;
  }
  rows.push({ source, target: norm(target), kind, confidence, note });
}

// ---------------------------------------------------------------- shared maps

/** WordPress industry slugs (categories AND tags) → Duda industry category. */
const INDUSTRY: Record<string, [string, Confidence]> = {
  utilities: ["utilities", "exact"],
  "water-treatment": ["utilities", "closest"],
  shipping: ["marine-commercial-ship-repair", "equivalent"],
  "shipbuilding-repair": ["marine-commercial-ship-repair", "equivalent"],
  shipbuilding: ["marine-commercial-ship-repair", "closest"],
  construction: ["construction-major-projects", "equivalent"],
  "civil-engineering": ["construction-major-projects", "closest"],
  tunnelling: ["construction-major-projects", "closest"],
  "infrastructure-maintenance": ["construction-major-projects", "closest"],
  petrochemicals: ["petrochemical-chemical-processing", "equivalent"],
  petrochemical: ["petrochemical-chemical-processing", "equivalent"],
  "chemical-plants": ["petrochemical-chemical-processing", "equivalent"],
  aviation: ["aviation-aerospace", "equivalent"],
  defence: ["defence-naval-shipbuilding", "equivalent"],
  distilleries: ["distilleries-breweries", "equivalent"],
  nuclear: ["nuclear", "exact"],
  "oil-gas": ["oil-gas", "exact"],
  "offshore-platforms": ["oil-gas", "closest"],
  "oil-re%ef%ac%81neries": ["oil-gas", "closest"],
  pharmaceuticals: ["pharmaceuticals", "exact"],
  pharmaceutical: ["pharmaceuticals", "exact"],
  renewable: ["renewables-hydrogen", "equivalent"],
  rail: ["rail-transport-engineering", "equivalent"],
};

/** WordPress product-type and SA-range slugs → Duda product-type category. */
const PRODUCT_TYPE: Record<string, [string, Confidence, string?]> = {
  "portable-ex-lighting": ["lighting-and-power", "equivalent"],
  "portable-ex-lighting-rental": ["lighting-and-power", "equivalent", "rental folds into the product type"],
  "portable-ex-power-distribution": ["lighting-and-power", "equivalent"],
  "portable-ex-power-rental": ["lighting-and-power", "equivalent", "rental folds into the product type"],
  "portable-ex-ventilation": ["fume-dust-lev-and-vapour-control", "equivalent"],
  "portable-ex-ventilation-rental": ["fume-dust-lev-and-vapour-control", "equivalent", "rental folds into the product type"],
  "portable-ex-heating": ["climate-control-and-heating", "equivalent"],
  "portable-ex-heating-rental": ["climate-control-and-heating", "equivalent", "rental folds into the product type"],
  "portable-ex-climate-control": ["climate-control-and-heating", "equivalent"],
  "portable-ex-climate-control-rental": ["climate-control-and-heating", "equivalent"],
  "sa-lumin": ["lighting-and-power", "closest", "SA range → its product type; Duda has no range pages"],
  "sa-lumin-rental": ["lighting-and-power", "closest", "SA range → its product type"],
  "sa-powernet": ["lighting-and-power", "closest", "SA range → its product type"],
  "sa-powernet-rental": ["lighting-and-power", "closest", "SA range → its product type"],
  "sa-cyclone": ["fume-dust-lev-and-vapour-control", "closest", "SA range → its product type"],
  "sa-cyclone-rental": ["fume-dust-lev-and-vapour-control", "closest", "SA range → its product type"],
  "sa-flexiheat": ["climate-control-and-heating", "closest", "SA range → its product type"],
  "sa-flexiheat-rental": ["climate-control-and-heating", "closest", "SA range → its product type"],
  "sa-endure": ["products", "fallback", "SA ENDURE spans lighting AND extraction, so no single type fits"],
  "sa-rental": ["products", "fallback", "no rental listing on Duda"],
  rental: ["products", "fallback", "no rental listing on Duda"],
  "habitat-systems-rental": ["products", "fallback", "empty category on WordPress"],
  "child-product": ["products", "fallback", "WooCommerce housekeeping category"],
  "con%ef%ac%81ned-spaces": ["site-challenges", "closest", "no confined-space challenge on Duda"],
  "tank-and-vessel-entry": ["site-challenges", "closest", "no tank-entry challenge on Duda"],
};

const cat = (slug: string) => `/category/${slug}`;

/** WordPress pages, hand-mapped. A null target means Duda has no such page — REVIEW.md asks for it to be created. */
const PAGES: Record<string, [string | null, Confidence, string?]> = {
  "/about/": ["/about-sa-equip", "equivalent"],
  "/about/careers/": ["/careers", "exact"],
  "/about/our-people/": ["/our-people", "exact"],
  "/about/our-story/": ["/our-story", "exact"],
  "/about/sa-equip-innovation/": ["/innovation", "equivalent"],
  "/contact/": ["/contact-us", "equivalent"],
  "/contact/thank-you/": ["/contact-us", "closest", "thank-you pages are post-submit only"],
  "/landing-page-thank-you/": ["/contact-us", "closest", "thank-you pages are post-submit only"],
  "/frequently-asked-questions/": ["/faqs", "equivalent"],
  "/cart/": ["/basket", "equivalent", "the quote basket replaces the cart"],
  "/checkout/": ["/basket", "closest", "there is no checkout — quotes go through the basket"],
  "/request-quote/": ["/basket", "closest", "the quote form lives on the basket page"],
  "/my-account/": ["/", "fallback", "no customer accounts on Duda"],
  "/blank-page/": ["/", "fallback", "an empty WordPress page"],
  "/newsletter/": ["/news-and-insights", "closest"],
  "/shop/": [cat("products"), "equivalent"],
  "/sa-equip-products/": [cat("products"), "equivalent"],
  "/sa-equip-rental-products/": [cat("products"), "fallback", "no rental listing on Duda"],
  "/portable-industrial-equipment/": [cat("products"), "closest"],
  "/portable-ventilation-and-lighting-rental/": [cat("products"), "closest"],
  "/lighting-power-rental/": [cat("lighting-and-power"), "closest"],
  "/temporary-lighting-hire/": [cat("lighting-and-power"), "closest", "a hire landing page"],
  "/industrial-lighting-hire/": [cat("lighting-and-power"), "closest", "a hire landing page"],
  "/industrial-heater-hire/": [cat("climate-control-and-heating"), "closest", "a hire landing page"],
  "/air-mover-hire/": [cat("fume-dust-lev-and-vapour-control"), "closest", "a hire landing page"],
  "/lev-systems/": [cat("fume-dust-lev-and-vapour-control"), "equivalent"],
  "/lev-systems-rental/": [cat("fume-dust-lev-and-vapour-control"), "closest"],
  "/multi-operator-lev-system/": [cat("fume-dust-lev-and-vapour-control"), "closest", "could point at a specific product instead"],
  "/portable-ex-lighting/": [cat("lighting-and-power"), "equivalent"],
  "/portable-ex-lighting-rental/": [cat("lighting-and-power"), "equivalent"],
  "/portable-ex-power-distribution/": [cat("lighting-and-power"), "equivalent"],
  "/portable-ex-power-rental/": [cat("lighting-and-power"), "equivalent"],
  "/portable-ex-ventilation/": [cat("fume-dust-lev-and-vapour-control"), "equivalent"],
  "/portable-ex-ventilation-rental/": [cat("fume-dust-lev-and-vapour-control"), "equivalent"],
  "/portable-ex-heating/": [cat("climate-control-and-heating"), "equivalent"],
  "/portable-ex-heating-rental/": [cat("climate-control-and-heating"), "equivalent"],
  "/portable-ex-climate-control/": [cat("climate-control-and-heating"), "equivalent"],
  "/portable-ex-climate-control-rental/": [cat("climate-control-and-heating"), "equivalent"],
  "/resources/": ["/news-and-insights", "closest", "the old resources hub"],
  "/resources/blog/": ["/news-and-insights", "equivalent"],
  "/resources/videos/": ["/videos", "equivalent"],
  "/resources/introex-2/": ["/e-learning", "closest", "IntroEx training"],
  "/resources/certificates/": ["/customer-support", "fallback", "downloads are not public on Duda yet"],
  "/resources/datasheets/": ["/customer-support", "fallback", "downloads are not public on Duda yet"],
  "/resources/manuals/": ["/customer-support", "fallback", "downloads are not public on Duda yet"],
  "/sa-equip-industries/": ["/industries", "equivalent"],
  "/sa-equip-industries/aviation/": ["/aviation", "equivalent", "the one industry with its own Duda page"],
  "/sa-equip-temporary-ventilation-lev-lighting-catalogue-2025/": [cat("products"), "fallback", "catalogue page — no Duda equivalent"],
  "/sa_equip_ex_catalogue_2025_catalogue-pdf/": [cat("products"), "fallback", "catalogue page — no Duda equivalent"],
  "/cookie-policy/": [null, "missing", "LEGAL PAGE — create it on Duda"],
  "/privacy-policy/": [null, "missing", "LEGAL PAGE — create it on Duda"],
  "/terms-conditions/": [null, "missing", "LEGAL PAGE — create it on Duda"],
  "/terms-conditions-3/": [null, "missing", "LEGAL PAGE (duplicate) — point at the same terms page"],
  "/qhsc-policy/": [null, "missing", "QHSE policy — create it on Duda"],
};

const PRODUCT_RANGE: Record<string, string> = {
  lighting: "lighting-and-power",
  "ex-lighting": "lighting-and-power",
  "ex-power": "lighting-and-power",
  ventilation: "fume-dust-lev-and-vapour-control",
  "ex-ventilation": "fume-dust-lev-and-vapour-control",
  "lev-systems": "fume-dust-lev-and-vapour-control",
  "ex-heating": "climate-control-and-heating",
};

// ------------------------------------------------------------------- products

async function main() {
  const ledger = JSON.parse(readFileSync(path.join(ROOT, "migration/ledger.json"), "utf8")) as Record<
    string,
    { wpId: string; dudaProductId: string; name: string }
  >;
  const hub = new Map(
    (await prisma.hubProduct.findMany({ select: { dudaProductId: true, slug: true, name: true } })).map((h) => [
      h.dudaProductId,
      h,
    ]),
  );
  const dudaCats = new Set((await prisma.categoryMirror.findMany({ select: { slug: true } })).map((c) => c.slug));

  const wpProducts = json<{ id: number; slug: string; link: string }[]>("wp-products.json");
  const dudaSlugOfWp = new Map<number, string>();
  for (const p of wpProducts) {
    const entry = ledger[String(p.id)];
    const target = entry && hub.get(entry.dudaProductId)?.slug;
    if (!target) {
      add("product", pathOf(p.link), cat("products"), "fallback", `wp#${p.id} has no Duda product`);
      continue;
    }
    dudaSlugOfWp.set(p.id, target);
    add("product", pathOf(p.link), `/product/${target}`, "exact", entry.name);
  }

  // Product-type and industry categories + tags.
  for (const c of json<{ slug: string; link: string; name: string; count: number }[]>("wp-product-cats.json")) {
    const ind = INDUSTRY[c.slug];
    const typ = PRODUCT_TYPE[c.slug];
    if (ind) add("product-category", pathOf(c.link), cat(ind[0]), ind[1], c.name);
    else if (typ) add("product-category", pathOf(c.link), cat(typ[0]), typ[1], typ[2] ?? c.name);
    else add("product-category", pathOf(c.link), cat("products"), "fallback", `unmapped: ${c.name}`);
  }
  for (const t of json<{ slug: string; link: string; name: string; count: number }[]>("wp-product-tags.json")) {
    const ind = INDUSTRY[t.slug];
    const typ = PRODUCT_TYPE[t.slug];
    if (ind) add("product-tag", pathOf(t.link), cat(ind[0]), ind[1], t.name);
    else if (typ) add("product-tag", pathOf(t.link), cat(typ[0]), typ[1], typ[2] ?? t.name);
    else if (["fumes", "lev", "hepa", "asbestos"].includes(t.slug))
      add("product-tag", pathOf(t.link), cat("fume-dust-lev-and-vapour-control"), "closest", t.name);
    else add("product-tag", pathOf(t.link), cat("industries"), "fallback", `${t.name} (${t.count} products)`);
  }

  for (const r of json<{ slug: string; link: string }[]>("wp-product-range.json")) {
    const t = PRODUCT_RANGE[r.slug];
    add("product-range", pathOf(r.link), cat(t ?? "products"), t ? "equivalent" : "fallback", r.slug);
  }
  // One wildcard rather than 15 rows: every distributor page goes to the same place.
  rows.push({ source: "/distributors/*", target: "/find-a-distributor", kind: "distributor", confidence: "equivalent", note: "wildcard — covers all 15 distributor pages" });

  // Pages.
  for (const p of json<{ link: string; title: { rendered: string } }[]>("wp-pages.json")) {
    const wpPath = pathOf(p.link);
    if (wpPath === "/" ) continue;
    const mapped = PAGES[wpPath];
    if (mapped) {
      const [target, confidence, note] = mapped;
      if (target) add("page", wpPath, target, confidence, note ?? "");
      else rows.push({ source: norm(wpPath), target: "", kind: "page", confidence, note: note ?? "" });
      continue;
    }
    const ind = wpPath.match(/^\/sa-equip-industries\/([^/]+)\/$/);
    if (ind && INDUSTRY[ind[1]]) {
      add("page", wpPath, cat(INDUSTRY[ind[1]][0]), INDUSTRY[ind[1]][1], "industry page → its category");
      continue;
    }
    // Same path on Duda? (customer-support, find-a-distributor, service-centre…)
    add("page", wpPath, wpPath, "exact", "same path on Duda");
  }

  // Blog posts and case studies: Duda serves posts at the ROOT (/<slug>).
  const dudaPosts = new Set(json<{ path: string }[]>("duda-blog-posts.json").map((p) => p.path));
  const urls = readFileSync(path.join(SRC, "wp-urls.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t"));
  for (const [kind, url] of urls) {
    const p = pathOf(url);
    if (kind === "post") {
      const slug = p.match(/^\/blog\/([^/]+)\/$/)?.[1];
      if (!slug) continue; // /resources/blog/ is handled as a page
      if (dudaPosts.has(slug)) add("blog-post", p, `/${slug}`, "exact");
      else add("blog-post", p, "/news-and-insights", "fallback", "post not on Duda");
    }
    if (kind === "case-study") {
      const slug = p.match(/^\/case-studies\/([^/]+)\/$/)?.[1];
      if (!slug) continue; // the index is the same path
      if (dudaPosts.has(slug)) add("case-study", p, `/${slug}`, "exact");
      else add("case-study", p, "/case-studies", "fallback", "case study not on Duda");
    }
  }

  // Datasheet / certificate PDFs → the product page that offered them.
  const downloads = JSON.parse(readFileSync(path.join(ROOT, "migration/downloads.json"), "utf8")) as {
    products: Record<string, { name: string; items: { url: string; title: string }[] }>;
  };
  const pdfTarget = new Map<string, { slug: string; title: string; also: number }>();
  for (const [wpId, prod] of Object.entries(downloads.products)) {
    const slug = dudaSlugOfWp.get(Number(wpId));
    if (!slug) continue;
    for (const item of prod.items) {
      const hit = pdfTarget.get(item.url);
      if (hit) hit.also++;
      else pdfTarget.set(item.url, { slug, title: `${prod.name} — ${item.title}`, also: 0 });
    }
  }
  for (const [url, t] of pdfTarget) {
    add("pdf", pathOf(url), `/product/${t.slug}`, "closest", `${t.title}${t.also ? ` (+${t.also} other product${t.also === 1 ? "" : "s"})` : ""}`);
  }

  // ------------------------------------------------------ verify every target
  const targets = [...new Set(rows.map((r) => r.target).filter(Boolean))];
  const broken = new Set<string>();
  for (const t of targets) {
    if (t.startsWith("/category/") && !dudaCats.has(t.slice(10))) {
      broken.add(t);
      continue;
    }
    const r = await fetch(`${DUDA}${t}`, { redirect: "manual" });
    if (r.status !== 200) broken.add(t);
    await new Promise((res) => setTimeout(res, 120));
  }
  for (const r of rows) if (r.target && broken.has(r.target)) r.note = `⚠️ TARGET DOES NOT LOAD ON DUDA. ${r.note}`;

  /*
   * ⚠️ And every SOURCE: a rule whose old address is ALSO a live Duda page
   * would redirect visitors away from that page and make it unreachable. Real
   * case: WordPress's /product/filters was a different product from the one
   * Duda now serves at /product/filters. Such a rule is withheld — the live
   * page wins — and listed for a human.
   */
  let conflicts = 0;
  for (const r of rows) {
    if (!r.source || r.source.includes("*") || r.kind === "pdf") continue;
    const res = await fetch(`${DUDA}${r.source}`, { redirect: "manual" });
    if (res.status === 200) {
      conflicts++;
      r.note = `NOT APPLIED — ${r.source} is a live Duda page, and the rule would hide it (WordPress meant: ${r.target}). ${r.note}`;
      r.confidence = "conflict";
      r.target = "";
    }
    await new Promise((res2) => setTimeout(res2, 120));
  }

  // ----------------------------------------------------------------- outputs
  mkdirSync(OUT, { recursive: true });
  const order: Confidence[] = ["conflict", "missing", "fallback", "closest", "equivalent", "exact"];
  rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.source.localeCompare(b.source));
  writeFileSync(
    path.join(OUT, "saequip-redirects.csv"),
    toCsv(
      ["source", "target", "kind", "confidence", "note"],
      rows.map((r) => [r.source, r.target, r.kind, r.confidence, r.note]),
    ),
  );

  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  const byConf = new Map<Confidence, number>();
  for (const r of rows) byConf.set(r.confidence, (byConf.get(r.confidence) ?? 0) + 1);

  const review = rows
    .filter((r) => ["conflict", "missing", "fallback", "closest"].includes(r.confidence) || broken.has(r.target))
    .filter((r) => r.kind !== "pdf")
    .sort((a, b) => order.indexOf(a.confidence) - order.indexOf(b.confidence) || a.kind.localeCompare(b.kind));

  const md = `# saequip.com → Duda redirect map — review

Generated by \`npm run redirects:build --workspace=backend\` on ${new Date().toISOString().slice(0, 10)}.
The map itself is [\`saequip-redirects.csv\`](saequip-redirects.csv); this file explains it and
lists the calls that need a human. **Nothing has been applied to the live site.**

## Summary

- **${rows.length} rules** for the old WordPress addresses that do not exist on Duda.
- **${identical} addresses need no rule** — same path on both sites; Duda already drops the
  trailing slash with a 301 of its own.
- **Every target was loaded on the live Duda site**: ${broken.size === 0 ? "all answer 200." : `**${broken.size} do NOT** — marked in the CSV and below.`}
- **Every old address was loaded on Duda too**: ${conflicts} ${conflicts === 1 ? "already serves a live Duda page, so its rule is" : "already serve a live Duda page, so their rules are"} withheld (a rule there would hide that page).
- Rows with an empty target are NOT to be applied (missing pages and conflicts).

| Kind | Rules |
|---|---|
${[...byKind].map(([k, n]) => `| ${k} | ${n} |`).join("\n")}

| Confidence | Rules | Meaning |
|---|---|---|
| exact | ${byConf.get("exact") ?? 0} | the same thing at a new address |
| equivalent | ${byConf.get("equivalent") ?? 0} | the same content, organised differently |
| closest | ${byConf.get("closest") ?? 0} | no direct equivalent; the nearest relevant page |
| fallback | ${byConf.get("fallback") ?? 0} | nothing close; a sensible general page |
| missing | ${byConf.get("missing") ?? 0} | **no page on Duda yet — create it, then point the rule at it** |
| conflict | ${byConf.get("conflict") ?? 0} | **withheld: the old address is a live Duda page, and the rule would hide it** |

## How it was mapped

- **Products**: by WordPress product id through the import ledger, never by name or SKU.
  Only products whose address changed get a rule.
- **Blog posts and case studies**: Duda serves posts at the site root (\`/<slug>\`), not under
  \`/blog/\`. Each was matched to the Duda post with the same slug.
- **Industries** (categories, tags and \`/sa-equip-industries/…\` pages): to the matching
  Duda industry category; Aviation keeps its own page.
- **Product types and SA ranges**: to the product-type category (Lighting and Power; Fume,
  Dust, LEV and Vapour Control; Climate Control and Heating). Rental variants fold in.
- **Distributor pages**: one wildcard rule to Find a Distributor.
- **PDF datasheets and certificates**: to the product page that offered them (the first
  one, where several shared a file) — see the decision below.

## Decisions for you

1. **Create the missing legal pages on Duda before cutover** — cookie policy, privacy policy,
   terms & conditions and the QHSE policy have no page on the new site. Their rules are in
   the CSV with an empty target until the pages exist.
2. **PDF links (${byKind.get("pdf") ?? 0} files)** currently go to the product page that offered
   them, because downloads are not public on Duda yet. Once the Download List widget is live
   that page will show the file again. The alternative is to keep the files reachable at their
   old addresses, which Duda cannot do.
3. **Hire landing pages** (air mover, heater, lighting hire) point at their product type.
   If SAEquip wants dedicated hire pages on Duda for SEO, create them and re-point.
4. **The judgment calls below** — everything that is not an exact or equivalent match.

## Judgment calls to check

| Old address | New address | Confidence | Note |
|---|---|---|---|
${review.map((r) => `| \`${r.source}\` | ${r.target ? `\`${r.target}\`` : "—"} | ${r.confidence} | ${r.note.replace(/\|/g, "/")} |`).join("\n")}

## Not covered

- **Product images** under \`/wp-content/uploads/\` — Duda re-hosted every product image under
  its own CDN, so old image addresses will 404. Low value to redirect.
- Anything not in the WordPress sitemap or its public lists (author archives, feeds, search
  pages). Watch Google Search Console's 404 report for a few weeks after cutover.

## Side findings on the Duda site

- Three pages have an SEO title copied from another page: **Aviation** and **Industries** are
  both titled "Careers | SA Equip", and **FAQs** is "Our Story | SA Equip".
`;
  writeFileSync(path.join(OUT, "REVIEW.md"), md);
  console.log(`${rows.length} rules, ${identical} need none, ${broken.size} broken targets, ${conflicts} conflicts withheld.`);
  console.log(`By confidence: ${[...byConf].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  console.log(`Wrote redirects/saequip-redirects.csv and redirects/REVIEW.md`);
  void WP;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

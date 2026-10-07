/**
 * Pure-function tests for the translation machinery (no network, no DB).
 *   npm run i18n:test --workspace=backend
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPassThrough, normaliseSource, sourceHash } from "../src/services/i18n/normalise.js";
import { validateTranslation } from "../src/services/i18n/validate.js";
import { normaliseLocale } from "../src/services/i18n/locales.js";
import { categoriesFromHtml, categoryNameFromHtml, cleanText, parseJsonLd, productNameFromHtml, productViewFromHtml, titleFromHtml } from "../src/services/i18n/dudaHarvest.js";
import { parseLang, productName, tr, categoryTitle, type Tables } from "../src/services/i18n/overlay.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};

// ---- normalising and hashing
check(sourceHash("Free  Airflow\n") === sourceHash(" Free Airflow"), "whitespace differences hash the same");
check(sourceHash("Café") === sourceHash("Café"), "NFC: composed and decomposed hash the same");
check(normaliseSource("  a \t b  ") === "a b", "normalise collapses whitespace");

// ---- what passes through untranslated
for (const s of ["Ex db eb ib mb pb IIB T4 Gb", "2560m3/hr", "IP65", "ATEX", "SAPH18440", "", "  "]) check(isPassThrough(s), `pass-through: "${s}"`);
for (const s of ["Weight", "Yes", "-20°C to +50°C", "Free Airflow (with 30cm Connectors)", "Oil refineries"]) check(!isPassThrough(s), `translated: "${s}"`);

// ---- the safety validator
const ok = (k: Parameters<typeof validateTranslation>[0], a: string, b: string) => validateTranslation(k, a, b).ok;
check(ok("SPEC_LABEL", "Zone 1", "Zona 1"), "Zone 1 → Zona 1 accepted");
check(!ok("SPEC_LABEL", "Zone 1", "Zona 2"), "Zone 1 → Zona 2 REJECTED (a changed number)");
check(ok("SPEC_LABEL", "Zone 1", "المنطقة ١"), "Arabic-Indic digits count as the same number");
check(!ok("LIST_ITEM", "ATEX certified for Zone 1", "Certifié pour la zone 1"), "a dropped certification mark is rejected");
check(!ok("LIST_ITEM", "Bright LED lighting", "Éclairage lumineux"), "a dropped acronym (LED) is rejected");
check(ok("LIST_ITEM", "Bright LED lighting", "Éclairage LED lumineux"), "…and kept, accepted");
check(ok("DESCRIPTION", "<p>PRODUCT CODE: SARF300</p>", "<p>CODE PRODUIT : SARF300</p>") && ok("DESCRIPTION", "<p>PRODUCT CODE: SARF300</p>", "<p>رمز المنتج: SARF300</p>"),
  "shouted English (PRODUCT CODE) may be translated; the code itself must stay");
check(!ok("DESCRIPTION", "<p>SA CYCLONE range</p>", "<p>Gamme SA Cyclone</p>"), "a brand in capitals must stay in capitals");
check(!ok("LIST_ITEM", "Robust housing", "Boîtier <b>robuste</b>"), "markup added to plain text is rejected");
check(!ok("LIST_ITEM", "Robust housing", "Voir https://evil.example"), "a URL added to plain text is rejected");
check(!ok("LIST_ITEM", "Robust housing", "   "), "an empty translation is rejected");
check(!ok("LIST_ITEM", "A long sentence about the product and its uses on site", "Oui"), "a translation that lost most of the text is rejected");
const html = '<p>Portable <strong>heater</strong> for <a href="/product/x">Zone 1</a>.</p>';
check(ok("DESCRIPTION", html, '<p>Calentador <strong>portátil</strong> para <a href="/product/x">Zona 1</a>.</p>'), "a description keeping its tags and link is accepted");
check(!ok("DESCRIPTION", html, '<p>Calentador portátil para <a href="/product/x">Zona 1</a>.</p>'), "a description that dropped a tag is rejected");
check(!ok("DESCRIPTION", html, '<p>Calentador <strong>portátil</strong> para <a href="https://evil.example">Zona 1</a>.</p>'), "a description whose link changed is rejected");
check(!ok("DESCRIPTION", html, '<p>Calentador <strong>portátil</strong> para <a href="/product/x">Zona 1</a>.<script>x</script></p>'), "a description with an added script is rejected");

// ---- languages
for (const [raw, want] of [["en-GB", "en"], ["ar", "ar"], ["zh-Hans", "zh"], ["zh-TW", null], ["pt", "pt-br"], ["PT_br", "pt-br"], ["de-AT", "de"], ["ja", null], ["", null], [undefined, null]] as const) {
  check(normaliseLocale(raw) === want, `normaliseLocale(${JSON.stringify(raw)}) → ${want}`);
}
check(parseLang("en") === null && parseLang("ar") === "ar" && parseLang("xx") === null && parseLang(["ar"]) === null, "parseLang: English, unknown and arrays give null");

// ---- Duda harvest parsers, on a real captured page
const prod = readFileSync(path.join(HERE, "fixtures/ar-product-ex-heater.html"), "utf8");
const cat = readFileSync(path.join(HERE, "fixtures/ar-category-lighting-and-power.html"), "utf8");
check(productNameFromHtml(prod) === "سخان EX", "the product's Arabic name is read from its JSON-LD", String(productNameFromHtml(prod)));
const crumbs = categoriesFromHtml(prod);
check(crumbs.get("climate-control-and-heating") === "التحكم بالمناخ والتدفئة", "category titles are read from the breadcrumbs", JSON.stringify([...crumbs]));
check(titleFromHtml(cat) === "الإضاءة والطاقة", "a category page's <title> is read", String(titleFromHtml(cat)));
check(categoryNameFromHtml(cat) === "الإضاءة والطاقة", "a category page's own name is the last entry of its breadcrumbs", String(categoryNameFromHtml(cat)));
// Shape measured on the French site: the category page is translated while a
// product page's breadcrumbs still carry the English.
const frCat = '<title>SEO title</title><script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":2,"item":{"name":"Produits"}},{"@type":"ListItem","position":1,"item":{"name":"Accueil","id":"/fr"}}]}</script>';
check(categoryNameFromHtml(frCat) === "Produits", "…taken by position, not array order", String(categoryNameFromHtml(frCat)));
check(categoryNameFromHtml("<title>Produits | SAEquip</title>") === "Produits", "…and falls back to the <title> without breadcrumbs");
// The quote basket's option names come from the page's productView
// (captured from the live French EX Heater page, 2026-10-07).
const pv = productViewFromHtml(readFileSync(path.join(HERE, "fixtures/fr-product-ex-heater-productview.txt"), "utf8"));
check(pv?.identifier === "01M1XRCFGGHYEJ0QGGXCJ3582N", "productView: the product's Duda id", String(pv?.identifier));
check(
  pv?.options.length === 1 && pv.options[0].id === "01KW9TRW04JDNAQXD6P8QKX15T" && pv.options[0].name === "Location-vente" &&
    pv.options[0].choices.map((c) => c.value).join() === "Location,Acheter",
  "productView: the option and its two choices, by id, in the page's language", JSON.stringify(pv?.options),
);
check(productViewFromHtml('x "productView": {"identifier":"a","note":"a } brace","options":[]} y')?.identifier === "a", "productView: a brace inside a string does not end the object");
check(productViewFromHtml("no data here") === null && productViewFromHtml('"productView": {broken') === null, "productView: absent or broken gives null");
check(parseJsonLd('<script type="application/ld+json">{broken</script><script type="application/ld+json">{"@type":"Product","name":"X"}</script>').length === 1,
  "a broken JSON-LD block does not hide the next one");
check(cleanText("<b>x</b>") === "x" && cleanText("a".repeat(301)) === null && cleanText("") === null && cleanText(3) === null, "harvested text is plain, short and non-empty");

// ---- overlay helpers fall back to English
const t: Tables = { locale: "ar", text: new Map([[`SPEC_LABEL:${sourceHash("Weight")}`, "الوزن"]]), product: new Map([["p1", "سخان EX"]]), category: new Map([["c1", "المنتجات"]]) };
check(tr(t, "SPEC_LABEL", "Weight") === "الوزن", "a stored translation is used");
check(tr(t, "SPEC_LABEL", "Height") === "Height" && tr(null, "SPEC_LABEL", "Weight") === "Weight", "missing text, or no tables, gives the English");
check(tr(t, "SPEC_VALUE", "2560m3/hr") === "2560m3/hr", "pass-through text is never looked up");
check(productName(t, "p1", "EX Heater") === "سخان EX" && productName(t, "p2", "Other") === "Other" && categoryTitle(t, "c1", "Products") === "المنتجات",
  "Duda names and titles, with English fallback");

// ---- the dashboard's translate-on-save helpers (frontend/src/lib/translator.ts)
// They run in the staff member's browser; jsdom stands in for the DOM. The
// "Chrome-like" fakes reproduce what Chrome 154's translator was MEASURED
// doing (2026-10-06): translating brand names, re-casing marks, writing
// decimal commas, mangling href, adding spaces inside tags, "& amp;".
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><body></body>");
Object.assign(globalThis, { document: dom.window.document, Node: dom.window.Node });
const { maskTerms, unmaskTerms, restoreMarks, translateHtml, protectTerms } = await import("../../frontend/src/lib/translator.ts");

const m = maskTerms("The SA CYCLONE SAF35 is ATEX and IECEx certified, 99.98% for Zone 1 sites. FREE AIR FLOW");
check(!/CYCLONE|SAF35|ATEX|IECEx|99\.98/.test(m.masked) && /\bSA\b/.test(m.masked) && /FREE AIR FLOW/.test(m.masked) && /Zone 1/.test(m.masked),
  "masking hides marks, codes, brands and decimals — not 'SA', shouted English or plain numbers", m.masked);
check(unmaskTerms(m.masked.replace("X1Q", "x1q"), m.terms) === "The SA CYCLONE SAF35 is ATEX and IECEx certified, 99.98% for Zone 1 sites. FREE AIR FLOW",
  "unmasking restores every term, even a placeholder the translator lower-cased");
check(maskTerms("Model X2Q spare").terms.length === 0, "text that already looks like a placeholder is sent unmasked");
check(restoreMarks("<p>SA FLEXIHEAT for sa use</p>", "<p>SA FlexiHeat pour sa utilisation</p>") === "<p>SA FLEXIHEAT pour sa utilisation</p>",
  "restoreMarks re-cases a re-cased mark, and leaves French 'sa' alone");
check(restoreMarks("FREE AIR FLOW", "débit d'air libre") === "débit d'air libre", "restoreMarks never forces shouted English (French 'air')");
check(restoreMarks('<a href="/LED">LED</a>', '<a href="/LED">led</a>') === '<a href="/LED">LED</a>', "restoreMarks touches text, not attributes");

// The real descriptions, from the gitignored export (i18n:export-sources) —
// skipped in a clone that has none.
const descs = (() => {
  try {
    return (JSON.parse(readFileSync(path.join(HERE, "../../migration/i18n/sources.json"), "utf8")) as { kind: string; sourceText: string }[])
      .filter((x) => x.kind === "DESCRIPTION");
  } catch {
    return [];
  }
})();
// Wrap each text run in »…« so leftover English is detectable.
const wrap = (s: string) => s.replace(/(^|>)([^<]+)/g, (all, a, b) => (b.trim() ? `${a}»${b}«` : all));
const chromeLike = async (s: string) =>
  wrap(s)
    .replace(/<a>/g, '<a href="/ product/x" class="junk"> ')
    .replace(/<\/a>/g, " </a>")
    .replace(/&/g, "& amp;")
    .replace(/\bCYCLONE\b/g, "旋风")
    .replace(/(\d)\.(\d)/g, "$1,$2");
const fakes: Record<string, (s: string) => Promise<string>> = {
  "keeps the tags": async (s) => wrap(s),
  "Chrome-like (links, entities, brands, decimals)": protectTerms(chromeLike),
  "drops every tag": async (s) => "»" + s.replace(/<[^>]+>/g, "") + "«",
};
if (descs.length) {
  for (const [name, fake] of Object.entries(fakes)) {
    let valid = 0;
    let leftover = 0;
    for (const d of descs) {
      const out = restoreMarks(d.sourceText, await translateHtml(d.sourceText, fake));
      if (validateTranslation("DESCRIPTION", d.sourceText, out).ok) valid++;
      if (/\p{L}/u.test(out.replace(/<[^>]+>/g, "").replace(/»[^«]*«/g, "").replace(/&[a-z]+;/g, ""))) leftover++;
    }
    check(valid === descs.length && leftover === 0, `translateHtml, translator that ${name}: all ${descs.length} real descriptions pass the validator, none left untranslated`,
      `${valid} valid, ${leftover} with English left`);
  }
} else {
  console.log("  (skipped: no migration/i18n/sources.json in this clone)");
}
const linked = await translateHtml('<p>Pair it with the <a href="/product/x">trolley</a>.</p>', protectTerms(chromeLike));
check(linked.includes('<a href="/product/x">»trolley«</a>') && !linked.includes("junk"), "a link mangled by the translator comes back exactly as in the English", linked);

console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);

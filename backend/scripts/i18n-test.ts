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
import { categoriesFromHtml, cleanText, parseJsonLd, productNameFromHtml, titleFromHtml } from "../src/services/i18n/dudaHarvest.js";
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

console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);

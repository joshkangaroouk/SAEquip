/**
 * Tests for the three quote widgets pasted into Duda (duda-widgets/, built by
 * scripts/build-quote-widgets.mjs). Each widget's REAL code runs in jsdom,
 * wrapped the way Duda wraps it — function (element, data, api) { … } — on
 * English and French pages built from Duda's real page data.
 *
 *   npm run quote-widgets:test --workspace=backend
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const W = (dir, ext) => readFileSync(path.join(ROOT, "duda-widgets", dir, `${dir}.${ext}`), "utf8");

let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};

const HEATER = "01M1XRCFGGHYEJ0QGGXCJ3582N";
const TROLLEY = "01M1XPJT6CCYYW1QPNW4HS39GW";
const OPT = "01KW9TRW04JDNAQXD6P8QKX15T";
const HIRE = "01KW9TRW04JDNAQXD6P8QKX15V";
const BUY = "01KW9TRW04JDNAQXD6P8QKX15W";
const ORIGIN = "https://saequip.multiscreensite.com";

const productView = (lang) => ({
  identifier: HEATER,
  name: lang === "fr" ? "Chauffage antidéflagrant" : "EX Heater",
  sku: "SAPH18440",
  seo_url: "ex-heater",
  image: "https://irp.cdn-website.com/x/heater.webp",
  displayed_price: 0,
  options: [
    {
      id: OPT,
      name: lang === "fr" ? "Location-vente" : "Hire/Purchase",
      opt_choices: [
        { id: HIRE, value: lang === "fr" ? "Location" : "Hire" },
        { id: BUY, value: lang === "fr" ? "Acheter" : "Purchase" },
      ],
    },
  ],
});

/** Duda's native radio option group, as its store renders it. */
const radios = (pv, checked) => `
  <div data-auto="radio-buttons-group">
    <div data-grab="radiogroup-title">${pv.options[0].name}</div>
    ${pv.options[0].opt_choices
      .map((c, i) => `<label><input type="radio" name="o" ${checked === i ? "checked" : ""}><p data-grab="radio-label">${c.value}</p></label>`)
      .join("")}
  </div>`;

/** What Duda renders for each widget's template fields. */
const dudaHtml = (dir) =>
  W(dir, "html")
    .replace("{{buttonText}}", "Add to Quote List")
    .replace("{{labelText}}", "Quote List")
    .replace(
      /\{\{#custom_link quotePageLink\}\}[\s\S]*?\{\{\/custom_link\}\}/,
      '<a href="/basket"><div class="dmWidget qc-view-btn"><span class="text">View Quote Basket</span></div></a>',
    )
    .replace(/\{\{#custom_link continueBrowsingLink\}\}([\s\S]*?)\{\{\/custom_link\}\}/, '<a href="/">$1</a>');

const LABELS = {
  fr: {
    lang: "fr",
    products: {
      [HEATER]: { name: "Chauffage antidéflagrant", slug: "ex-heater" },
      [TROLLEY]: { name: "Chariot pour chauffage EX", slug: "trolley-for-ex-heater" },
    },
    options: { [OPT]: "Location-vente" },
    choices: { [HIRE]: "Location", [BUY]: "Acheter" },
  },
  en: {
    lang: "en",
    products: { [HEATER]: { name: "EX Heater", slug: "ex-heater" }, [TROLLEY]: { name: "Trolley for EX Heater", slug: "trolley-for-ex-heater" } },
    options: { [OPT]: "Hire/Purchase" },
    choices: { [HIRE]: "Hire", [BUY]: "Purchase" },
  },
};

/**
 * One page. `widgets` run in order, each through Duda's wrapper. `basket`
 * seeds localStorage (it is one origin, so every language shares it).
 */
async function page({ path: urlPath, lang, widgets, pv, checked = 0, basket, labels = "ok", quoteStatus = 201 }) {
  const fetches = [];
  const posts = [];
  const body = [
    pv ? `<script>window.__ssr = {"productView": ${JSON.stringify(pv)}};</script>${radios(pv, checked)}` : "",
    ...widgets.map((w) => `<div class="w-${w}">${dudaHtml(w)}</div>`),
  ].join("\n");
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><head></head><body>${body}</body></html>`, {
    url: ORIGIN + urlPath,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  if (basket) window.localStorage.setItem("saequip_quote_basket", JSON.stringify(basket));
  window.matchMedia = () => ({ matches: false });
  window.dmAPI = { runOnReady: (_n, cb) => cb() };
  window.fetch = async (url, init) => {
    fetches.push(String(url));
    if (String(url).includes("/quote-labels")) {
      if (labels !== "ok") return { ok: false, json: async () => null };
      const l = /lang=([a-z-]+)/.exec(String(url))?.[1] ?? "en";
      return { ok: true, json: async () => JSON.parse(JSON.stringify(LABELS[l] ?? LABELS.en)) };
    }
    if (String(url).includes("/public/quotes")) {
      posts.push(JSON.parse(init.body));
      return { ok: quoteStatus < 300, status: quoteStatus, text: async () => JSON.stringify(quoteStatus < 300 ? { ok: true } : { ok: false, error: "English server text" }) };
    }
    throw new Error("unexpected fetch " + url);
  };
  for (const w of widgets) {
    const element = window.document.querySelector(`.w-${w}`);
    window.__run = { element, data: { inEditor: false, config: {} }, api: {} };
    window.eval(`(function (element, data, api) {\n${W(w, "js")}\n})(window.__run.element, window.__run.data, window.__run.api);`);
  }
  const settle = async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => window.setTimeout(r, 0));
  };
  await settle();
  const $ = (s) => window.document.querySelector(s);
  const $$ = (s) => [...window.document.querySelectorAll(s)];
  const stored = () => JSON.parse(window.localStorage.getItem("saequip_quote_basket") || "[]");
  return { window, $, $$, stored, fetches, posts, settle };
}

// ── 1. Add on the ENGLISH product page ───────────────────────────────────────
{
  const p = await page({ path: "/product/ex-heater", lang: "en", widgets: ["quote-header", "add-to-quote"], pv: productView("en") });
  check(p.$(".qc-eyebrow").textContent === "Your equipment enquiry" && p.$(".atq-btn").textContent === "Add to Quote List",
    "English page: the widgets' text is exactly as before");
  check(p.window.SAEquipQuote.v === 2 && p.window.SAEquipQuoteI18n.locale() === "en", "the v2 store and the language helper are installed");
  p.$("#atq-btn").click();
  await p.settle();
  const [line] = p.stored();
  check(line?.name === "EX Heater" && JSON.stringify(line.options) === '{"Hire/Purchase":"Hire"}' && line.sku === "SAPH18440",
    "a line keeps the name and options as shown, exactly as before", JSON.stringify(line));
  check(line?.dudaId === HEATER && line.slug === "ex-heater" && JSON.stringify(line.choices) === JSON.stringify({ [OPT]: HIRE }),
    "…and now also Duda's ids: product, slug and the chosen option's choice");
  check(p.$(".qc-name").textContent === "EX Heater" && p.$(".qc-sku").textContent === "SKU: SAPH18440" && p.$(".qc-meta").textContent === "Qty 1",
    "the header lists it in English");
  check(p.$(".qc-name a").getAttribute("href") === `${ORIGIN}/product/ex-heater`, "…linking to the English product page");
  check(p.fetches.some((u) => /quote-labels$/.test(u)) && !p.fetches.some((u) => u.includes("lang=")), "English asks for labels without a lang parameter");
  check(p.$(".qc-view a").getAttribute("href") === "/basket", "English: Duda's basket link is left alone");
}

// ── 2. The same basket on the FRENCH basket page ─────────────────────────────
const englishLine = {
  name: "EX Heater", sku: "SAPH18440", options: { "Hire/Purchase": "Hire" }, price: "", image: "x.webp",
  url: `${ORIGIN}/product/ex-heater`, quantity: 1, addedAt: "2026-10-07T10:00:00Z",
  dudaId: HEATER, slug: "ex-heater", choices: { [OPT]: HIRE },
};
const oldLine = {
  // Saved by the v1 widgets: no ids, an English link.
  name: "Trolley for EX Heater", sku: "", options: {}, price: "", image: "", url: `${ORIGIN}/product/trolley-for-ex-heater`, quantity: 2, addedAt: "2026-10-01T10:00:00Z",
};
{
  const p = await page({ path: "/fr/basket", lang: "fr", widgets: ["quote-header", "basket-page"], basket: [englishLine, oldLine] });
  const names = p.$$(".qp-item-name").map((e) => e.textContent);
  check(names[0] === "Chauffage antidéflagrant" && names[1] === "Chariot pour chauffage EX",
    "French page: an English-added line AND a v1 line (found by its link) read in French", JSON.stringify(names));
  check(p.$(".qp-item-name a").getAttribute("href") === `${ORIGIN}/fr/product/ex-heater`, "…and link to the French product page");
  check(p.$(".qp-opt").textContent === "Location-vente: Location", "…with the option in French", p.$(".qp-opt").textContent);
  check(p.$(".qp-title").textContent === "Votre panier de devis" && p.$(".qp-remove").textContent === "Retirer" && p.$("#qp-submit").textContent === "Envoyer la demande de devis",
    "the page's own text is French");
  check(p.$('label[for="qp-first"]').textContent.trim() === "Prénom *", "labels keep their required marker", p.$('label[for="qp-first"]').textContent);
  check(p.fetches.some((u) => u.endsWith("/quote-labels?lang=fr")), "labels are asked for in French");
  const when = p.$("#qp-when").options;
  check(when[1].textContent === "De toute urgence" && when[1].value === "Urgently", "'When needed' shows French but sends the English value");
  const country = p.$("#qp-country").options;
  check(country[1].textContent === "Royaume-Uni" && country[1].value === "United Kingdom (UK)", "countries: UK first, shown in French, sent in English",
    `${country[1].textContent} = ${country[1].value}`);
  const de = [...country].find((o) => o.value === "Germany");
  check(de?.textContent === "Allemagne" && country.length === 252, "…every country, in French", `${de?.textContent}, ${country.length}`);
  check(p.$("#qp-home").getAttribute("href") === "/fr/", "'Back to Home' goes to the French home page");
  check(p.$(".qc-view a").getAttribute("href") === "/fr/basket" && p.$(".qc-title [data-qi18n]").textContent === "Liste des devis",
    "the header: Duda's basket link gains /fr, and its title matches Duda's French wording");
  check(p.$(".qp-wrapper").getAttribute("lang") === "fr", "the widget says its language");

  // Submit.
  for (const [n, v] of [["firstName", "Zz"], ["lastName", "Test"], ["company", "Zz Ltd"], ["email", "zz@example.com"], ["phone", "01234 567890"]]) {
    p.$(`[name="${n}"]`).value = v;
  }
  p.$("#qp-country").value = "United Kingdom (UK)";
  p.$("#qp-when").value = "Urgently";
  p.$("#qp-form").dispatchEvent(new p.window.Event("submit", { cancelable: true }));
  await p.settle();
  const sent = p.posts[0];
  check(sent?.locale === "fr" && sent.country === "United Kingdom (UK)" && sent.requiredBy === "Urgently", "the quote says it is French; country and date go in English");
  check(sent?.items[0].dudaId === HEATER && JSON.stringify(sent.items[0].choices) === JSON.stringify({ [OPT]: HIRE }) && sent.items[0].name === "Chauffage antidéflagrant",
    "a line goes with its ids (the server turns them into English for staff)", JSON.stringify(sent?.items[0]));
  check(sent?.items[1].dudaId === TROLLEY && sent.items[1].quantity === 2, "the v1 line gains its product id from its link");
  check(p.$("#qp-thanks").style.display === "block" && p.$(".qp-thanks-title").textContent.startsWith("Merci") && p.stored().length === 0,
    "success: the French thank-you, and the basket is cleared");
  p.$("#qp-retrieve").click();
  await p.settle();
  check(p.stored()[0]?.dudaId === HEATER && p.stored().length === 2, "'Retrieve Basket' restores the lines with their ids");
}

// ── 3. Errors and validation, in French ──────────────────────────────────────
{
  const p = await page({ path: "/fr/basket", lang: "fr", widgets: ["basket-page"], basket: [englishLine], quoteStatus: 429 });
  p.$("#qp-form").dispatchEvent(new p.window.Event("submit", { cancelable: true }));
  await p.settle();
  check(p.$("#qp-status").textContent === "Veuillez renseigner : prénom, nom, nom de l'entreprise, e-mail, téléphone.", "missing fields are named in French",
    p.$("#qp-status").textContent);
  for (const [n, v] of [["firstName", "Zz"], ["lastName", "Test"], ["company", "Zz Ltd"], ["email", "zz@example.com"], ["phone", "01234"]]) p.$(`[name="${n}"]`).value = v;
  p.$("#qp-form").dispatchEvent(new p.window.Event("submit", { cancelable: true }));
  await p.settle();
  check(p.$("#qp-status").textContent === "Trop de demandes. Veuillez réessayer dans quelques minutes." && p.stored().length === 1,
    "a 429 shows a French message, never the server's English, and keeps the basket", p.$("#qp-status").textContent);
}

// ── 4. Adding the same product on the French page MERGES with the English line ─
{
  const p = await page({ path: "/fr/product/ex-heater", lang: "fr", widgets: ["quote-header", "add-to-quote"], pv: productView("fr"), basket: [englishLine] });
  check(p.$(".qc-name").textContent === "Chauffage antidéflagrant" && p.$(".qc-meta").textContent === "Qté 1", "the header shows the English line in French");
  p.$("#atq-btn").click();
  await p.settle();
  const b = p.stored();
  check(b.length === 1 && b[0].quantity === 2, "the same product and choice added in French merges into ONE line", JSON.stringify(b.map((l) => [l.name, l.quantity])));
  check(p.$(".atq-btn span")?.textContent === "Ajouté à la liste des devis", "the confirmation is French", p.$(".atq-btn span")?.textContent);
  // The button rests for 2s after an add (as it always has); wait it out.
  await new Promise((r) => p.window.setTimeout(r, 2100));
  p.$$('input[type="radio"]').forEach((r, i) => (r.checked = i === 1));
  p.$("#atq-btn").click();
  await p.settle();
  check(p.stored().length === 2 && JSON.stringify(p.stored()[1].choices) === JSON.stringify({ [OPT]: BUY }), "a different choice is a different line");
}

// ── 5. Older widgets, failures ───────────────────────────────────────────────
{
  // A v1 store already on the page (an older widget ran first) is replaced.
  const dom = await page({ path: "/product/ex-heater", lang: "en", widgets: [], pv: productView("en") });
  dom.window.SAEquipQuote = { get: () => [], add: () => [] };
  dom.window.__run = { element: dom.window.document.body, data: {}, api: {} };
  dom.window.document.body.insertAdjacentHTML("beforeend", `<div class="w-add">${dudaHtml("add-to-quote")}</div>`);
  dom.window.eval(`(function (element, data, api) {\n${W("add-to-quote", "js")}\n})(document.body, {}, {});`);
  dom.$("#atq-btn").click();
  await dom.settle();
  check(dom.window.SAEquipQuote.v === 2 && dom.stored()[0]?.dudaId === HEATER, "an older store on the page is replaced, so ids are kept");
}
{
  const p = await page({ path: "/fr/basket", lang: "fr", widgets: ["basket-page"], basket: [englishLine, oldLine], labels: "fail" });
  const names = p.$$(".qp-item-name").map((e) => e.textContent);
  check(names[0] === "EX Heater" && names[1] === "Trolley for EX Heater" && p.$(".qp-title").textContent === "Votre panier de devis",
    "labels unavailable: lines show as saved, nothing breaks", JSON.stringify(names));
  check(p.$(".qp-item-name a").getAttribute("href") === `${ORIGIN}/fr/product/ex-heater`, "…and still link in the page's language");
}
{
  const p = await page({ path: "/fr/product/ex-heater", lang: "fr", widgets: ["add-to-quote"], pv: productView("fr"), checked: -1 });
  p.$("#atq-btn").click();
  await p.settle();
  check(p.$("#atq-error").textContent === "Veuillez choisir : Location-vente" && p.stored().length === 0, "a missing option is asked for in French",
    p.$("#atq-error").textContent);
}
{
  const p = await page({ path: "/ar/basket", lang: "ar", widgets: ["basket-page"], basket: [englishLine] });
  check(p.$(".qp-wrapper").getAttribute("lang") === "ar" && /[؀-ۿ]/.test(p.$(".qp-title").textContent), "Arabic: the page's own text and lang");
  const opts = [...p.$("#qp-country").options];
  check(opts.length === 252 && opts.every((o) => o.disabled || o.value === "" || /[A-Za-z]/.test(o.value)), "Arabic: country values stay English");
}
{
  // /aviation is a page, not a language: English page, no prefix.
  const p = await page({ path: "/aviation", lang: "en", widgets: ["quote-header"], basket: [englishLine] });
  check(p.$(".qc-view a").getAttribute("href") === "/basket" && p.$(".qc-name a").getAttribute("href") === `${ORIGIN}/product/ex-heater`,
    "a page path that only looks like a language is not treated as one");
}

console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);

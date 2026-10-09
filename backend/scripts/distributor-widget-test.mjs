/**
 * Tests for the Find a Distributor widget pasted into Duda
 * (duda-widgets/find-a-distributor/). Its REAL code runs in jsdom, wrapped the
 * way Duda wraps it, on pages built the way Duda builds them: the template
 * rendered with the Content panel's values, and dmAPI's collections API
 * behaving as MEASURED on the live site (2026-10-09) — the collection is
 * "Distributors" on every language page, its rows are English, and Duda
 * hands the widget a TRANSLATED "Collection name" ("Distributeurs" on /fr/),
 * which it answers with "No collection for site alias…".
 *
 *   npm run distributor-widget:test --workspace=backend
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (ext) => readFileSync(path.join(ROOT, "duda-widgets/find-a-distributor", `find-a-distributor.${ext}`), "utf8");
const HTML = read("html");
const JS = read("js");

let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};

/* ── A small Handlebars renderer: the subset this template uses ──────────── */
function render(tpl, ctx) {
  const tokens = tpl.replace(/\{\{!--[\s\S]*?--\}\}/g, "").split(/(\{\{[^}]*\}\})/);
  let i = 0;
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const look = (scope, key) => (key.startsWith("this.") ? scope.this?.[key.slice(5)] : scope[key] ?? scope.root?.[key]);
  function block(scope, stop) {
    let out = "";
    while (i < tokens.length) {
      const t = tokens[i++];
      const m = /^\{\{\s*([#/]?)(\w+)?\s*([\w.]*)\s*\}\}$/.exec(t);
      if (!m) {
        out += t;
        continue;
      }
      const [, sig, word, arg] = m;
      if (sig === "/" || (sig === "" && word === "else")) {
        if (stop.includes(sig === "/" ? "/" : "else")) return { out, end: sig === "/" ? "/" : "else" };
        throw new Error("unbalanced " + t);
      }
      if (sig === "#" && word === "if") {
        const yes = block(scope, ["else", "/"]);
        let no = { out: "" };
        if (yes.end === "else") no = block(scope, ["/"]);
        const v = look(scope, arg);
        out += v && !(Array.isArray(v) && !v.length) ? yes.out : no.out;
      } else if (sig === "#" && word === "each") {
        const start = i;
        const list = look(scope, arg) || [];
        let body = "";
        if (!list.length) block(scope, ["/"]); // skip the body
        for (const item of list) {
          i = start;
          body += block({ this: item, root: scope.root || scope }, ["/"]).out;
        }
        out += body;
      } else {
        out += esc(look(scope, t.slice(2, -2).trim()));
      }
    }
    return { out, end: null };
  }
  return block(ctx, []).out;
}

// The live collection's rows (Duda MCP, 2026-10-09), trimmed to six.
const ROWS = [
  { name: "SA Equip – Global Headquarters", country: "United Kingdom", continents: "Europe", address: "10 Clifton View, Broxburn, EH52 5NE, United Kingdom", email: "info@saequip.com", phone: "+44 (0)333 257 1851", phone_link: "+443332571851", website: "https://saequip.com/", website_label: "saequip.com", image: "https://x/sa.jpg", image_alt: "", map_link: "https://maps/x" },
  { name: "SA Equip – European Office", country: "The Netherlands", continents: "Europe", address: "Oud Camp 22, Maasland", email: "", phone: "+31 (0)88 697 2590", phone_link: "+31886972590", website: "", website_label: "", image: "", image_alt: "", map_link: "" },
  { name: "SA Equip – Azerbaijan", country: "Azerbaijan", continents: "Europe, South East Asia", address: "Baku, Azerbaijan", email: "sales@saequip.com", phone: "", phone_link: "", website: "", website_label: "", image: "", image_alt: "", map_link: "" },
  { name: "Daly Middle East DWC LLC", country: "United Arab Emirates", continents: "Middle East", address: "Dubai South", email: "", phone: "+971 4 887 2049", phone_link: "+97148872049", website: "", website_label: "", image: "", image_alt: "", map_link: "" },
  { name: "DME Trading and Maintenance WLL", country: "Qatar", continents: "Middle East", address: "Doha, Qatar", email: "", phone: "", phone_link: "", website: "", website_label: "", image: "", image_alt: "", map_link: "" },
  { name: "Airclean Safety Products", country: "Germany", continents: "Europe", address: "Tomphecke 56, Mönchengladbach", email: "info@airclean.eu", phone: "", phone_link: "", website: "", website_label: "", image: "", image_alt: "", map_link: "" },
];

/**
 * A page. `config` is the Content panel as Duda hands it (`data.config`), and
 * the template is rendered with it; `templateRows` fills the "distributors"
 * Collection field instead of the runtime collection.
 */
async function page({ lang = "en", config = {}, templateRows = [] }) {
  const html = render(HTML, { ...config, distributors: templateRows });
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body><div id="w">${html}</div></body></html>`, {
    url: `https://saequip.multiscreensite.com/${lang === "en" ? "" : lang + "/"}find-a-distributor`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const asked = [];
  window.matchMedia = () => ({ matches: false });
  window.fetch = async () => ({ ok: false, json: async () => null });
  window.dmAPI = {
    runOnReady: (_n, cb) => cb(),
    loadCollectionsAPI: async () => ({
      data: (name) => ({
        get: async () => {
          asked.push(name);
          if (name !== "Distributors") throw new Error(`No collection for site alias: 8a8f03b5, name: ${name}`);
          return { values: ROWS.map((d, n) => ({ id: String(n), data: d })) };
        },
      }),
    }),
  };
  window.__run = { element: window.document.getElementById("w").firstElementChild, data: { inEditor: false, config } };
  window.eval(`(function (element, data, api) {\n${JS}\n})(window.__run.element, window.__run.data, {});`);
  const settle = async () => {
    for (let k = 0; k < 20; k++) await new Promise((r) => window.setTimeout(r, 0));
  };
  await settle();
  const $ = (s) => window.document.querySelector(s);
  const $$ = (s) => [...window.document.querySelectorAll(s)];
  const visible = () => $$("[data-sae-card]").filter((c) => !c.hidden);
  const search = async (q) => {
    $("[data-sae-search]").value = q;
    $("[data-sae-search]").dispatchEvent(new window.Event("input"));
    await new Promise((r) => window.setTimeout(r, 200));
  };
  return { window, $, $$, asked, visible, search };
}

// ── 1. English: exactly as before ────────────────────────────────────────────
{
  const p = await page({ lang: "en", config: { collection_name: "Distributors" } });
  check(p.visible().length === 6 && p.asked.join() === "Distributors", "English: the collection loads by its name, all six cards", p.asked.join());
  check(p.$(".sae-dist__heading").textContent === "Find a distributor in your area" && p.$("[data-sae-count]").textContent === "Showing 6 distributors in all regions",
    "English wording is unchanged", p.$("[data-sae-count]").textContent);
  check(p.$$(".sae-dist__filter-text").map((e) => e.textContent).join("|") === "All regions|Europe|Middle East|South East Asia", "English region filters");
  check(p.$(".sae-dist__country").textContent === "United Kingdom" && p.$(".sae-dist__name").textContent === "SA Equip – Global Headquarters", "English cards as entered");
}

// ── 2. French: Duda hands over a translated collection name ─────────────────
{
  const p = await page({ lang: "fr", config: { collection_name: "Distributeurs" } });
  check(p.asked.join() === "Distributeurs,Distributors" && p.visible().length === 6,
    "the translated name finds nothing, so the real collection is used — six cards, not none", p.asked.join());
  check(p.$(".sae-dist__heading").textContent === "Trouvez un distributeur près de chez vous" && p.$(".sae-dist__hq-title").textContent === "SA Equip – Siège mondial",
    "the template's default wording is French");
  check(p.$$(".sae-dist__filter-text").map((e) => e.textContent).join("|") === "Toutes les régions|Europe|Moyen-Orient|Asie du Sud-Est", "regions are French",
    p.$$(".sae-dist__filter-text").map((e) => e.textContent).join("|"));
  const countries = p.$$(".sae-dist__country").map((e) => e.textContent);
  check(countries.join("|") === "Royaume-Uni|Pays-Bas|Azerbaïdjan|Émirats arabes unis|Qatar|Allemagne", "countries are French", countries.join("|"));
  const names = p.$$(".sae-dist__name").map((e) => e.textContent);
  check(names[0] === "SA Equip – Siège mondial" && names[1] === "SA Equip – Bureau européen" && names[2] === "SA Equip – Azerbaïdjan" && names[3] === "Daly Middle East DWC LLC",
    "SA Equip's own offices are French; company names are left as they are", names.slice(0, 4).join("|"));
  check(p.$("[data-sae-count]").textContent === "6 distributeurs · Toutes les régions", "the count is French", p.$("[data-sae-count]").textContent);
  check(p.$("[data-sae-search]").getAttribute("placeholder") === "Rechercher par pays, ville ou entreprise" && p.$('label[for="sae-dist-search"]').textContent === "Rechercher un distributeur",
    "search placeholder and label are French");
  check(p.$("[data-sae-filters]").getAttribute("aria-label") === "Filtrer les distributeurs par région" && p.$(".sae-dist").getAttribute("lang") === "fr", "the filter's accessible name, and the widget's lang");
  await p.search("allemagne");
  check(p.visible().length === 1 && p.$("[data-sae-count]").textContent === "1 distributeur correspond à votre recherche · Toutes les régions",
    "searching the French country name finds it", p.$("[data-sae-count]").textContent);
  await p.search("germany");
  check(p.visible().length === 1, "…and the English one still does");
  await p.search("moyen-orient");
  check(p.visible().length === 2, "a French region name finds its distributors");
  await p.search("");
  p.$$(".sae-dist__filter").find((b) => b.textContent.includes("Moyen-Orient")).click();
  check(p.visible().length === 2 && p.$("[data-sae-count]").textContent === "2 distributeurs · Moyen-Orient", "the region filter still filters, by the English value",
    p.$("[data-sae-count]").textContent);
  await p.search("zzzz");
  check(p.$("[data-sae-count]").textContent === "Aucun résultat" && p.$(".sae-dist__empty-title").textContent === "Aucun distributeur ne correspond à votre recherche" && !p.$("[data-sae-empty]").hidden,
    "the empty state is French");
}

// ── 3. A Content field the site owner fills in is Duda's to translate ───────
{
  const p = await page({ lang: "fr", config: { collection_name: "Distributeurs", intro_heading: "Nos distributeurs", search_placeholder: "Pays ou société" } });
  check(p.$(".sae-dist__heading").textContent === "Nos distributeurs" && p.$("[data-sae-search]").getAttribute("placeholder") === "Pays ou société",
    "filled-in Content fields are left exactly as Duda gave them");
  check(p.$(".sae-dist__intro-text").textContent.startsWith("Sélectionnez votre région"), "…while an empty one still gets its translated default");
}

// ── 4. Other languages ──────────────────────────────────────────────────────
{
  const ar = await page({ lang: "ar", config: { collection_name: "الموزعون" } });
  check(ar.visible().length === 6 && ar.$("[data-sae-count]").textContent === "6 موزعين · جميع المناطق" && ar.$(".sae-dist__country").textContent === "المملكة المتحدة",
    "Arabic: cards load, the count uses Arabic's plural for 6, countries in Arabic", `${ar.$("[data-sae-count]").textContent} / ${ar.$(".sae-dist__country").textContent}`);
  const de = await page({ lang: "de", config: { collection_name: "Vertriebspartner" } });
  check(de.visible().length === 6 && de.$$(".sae-dist__filter-text")[2].textContent === "Naher Osten" && de.$$(".sae-dist__country")[5].textContent === "Deutschland",
    "German: cards load, regions and countries in German");
  const zh = await page({ lang: "zh", config: { collection_name: "经销商" } });
  check(zh.visible().length === 6 && zh.$("[data-sae-count]").textContent === "6 家经销商 · 所有地区", "Chinese: cards load and the count reads naturally",
    zh.$("[data-sae-count]").textContent);
}

// ── 5. The template's own collection field (no Collection name set) ─────────
{
  const p = await page({ lang: "fr", config: {}, templateRows: ROWS.slice(0, 2) });
  check(p.asked.length === 0 && p.visible().length === 2 && p.$("[data-sae-count]").textContent === "2 distributeurs · Toutes les régions",
    "with no Collection name the template's rows are used — and are now initialised (they never were)", p.$("[data-sae-count]").textContent);
  check(p.$(".sae-dist__country").textContent === "Royaume-Uni", "…translated the same way");
}

console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);

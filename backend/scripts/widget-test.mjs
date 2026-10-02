/**
 * Exercise the tabbed accordion and the renderExternalApp entry point.
 *   npm run widget:test --workspace=backend
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

// Resolved from this file, so it works whatever the cwd (npm run sets it to backend/).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, "../src/public-widget/widget.js"), "utf8");

let pass = 0;
let fail = 0;
const check = (ok, label, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};

const FULL = {
  name: "EX Heater", sku: "SAPH18440", slug: "ex-heater",
  dudaProductId: "01M1XRCFGGHYEJ0QGGXCJ3582N",
  descriptionHtml: "<p>First para.</p><p>Second para with <strong>bold</strong>.</p>",
  logos: { sa: [], cert: [] },
  specs: [
    { label: "CERTIFICATION", value: "Ex II 2 G D" },
    { label: "", value: "Ex db eb ib mb pb IIB T4 Gb" },
    { label: "", value: "db ib mb tb pb IIIC T135°C Db" },
    { label: "AIRFLOW", value: "2560m3/hr" },
    { label: "SYSTEM INCLUDES", value: "" },
    { label: "WEIGHT", value: "200kg" },
  ],
  benefits: ["IP65 Rated", "ATEX certified"],
  applications: ["Oil refineries"],
  downloads: [], model3dUrl: null,
  compatible: [
    { name: "Trolley for EX Heater", slug: "trolley-for-ex-heater", url: "/product/trolley-for-ex-heater", imageUrl: "https://irp.cdn-website.com/a.webp" },
    { name: "Duct Couplers", slug: "duct-couplers", url: "/product/duct-couplers", imageUrl: "https://irp.cdn-website.com/b.webp" },
    { name: "Manway Adaptor", slug: "manway-adaptor", url: "/product/manway-adaptor", imageUrl: null },
  ],
};

/** Boot the widget, optionally providing a fake dmAPI, then call init(). */
async function boot({ payload = FULL, props = {}, dmPageData = undefined, viaInit = true, body = "", dmHangs = false, settleMs = 40, amdLoader = false, tabsLayout = undefined, catPayload = undefined, cataloguePayload = undefined, url = undefined } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${body}<div id="host"></div></body></html>`, {
    url: url ?? "https://saequip.multiscreensite.com/product/ex-heater",
    runScripts: "dangerously", pretendToBeVisual: true,
  });
  const w = dom.window;
  let fetchedUrl = null;
  w.fetch = (u) => {
    fetchedUrl = String(u);
    // Tag mode hits a different endpoint, so the stub routes on the URL rather
    // than answering everything with the product payload.
    if (fetchedUrl.indexOf("/catalogue") !== -1) {
      return Promise.resolve({
        ok: cataloguePayload !== null && cataloguePayload !== undefined,
        status: cataloguePayload ? 200 : 500,
        json: () => Promise.resolve(cataloguePayload),
      });
    }
    if (fetchedUrl.indexOf("/by-category") !== -1) {
      return Promise.resolve({
        ok: catPayload !== null && catPayload !== undefined,
        status: catPayload ? 200 : 404,
        json: () => Promise.resolve(catPayload),
      });
    }
    return Promise.resolve({ ok: payload !== null, status: payload ? 200 : 404, json: () => Promise.resolve(payload) });
  };
  if (dmPageData !== undefined || dmHangs) {
    w.dmAPI = {
      dynamicPageApi: () => ({
        isDynamicPage: () => dmHangs || dmPageData !== null,
        // A promise that NEVER settles — the failure a try/catch cannot see.
        pageData: () => (dmHangs ? new Promise(() => {}) : Promise.resolve(dmPageData)),
      }),
    };
  }
  /*
   * jsdom does not evaluate media queries — its matchMedia (when present)
   * always reports matches:false. So the accordion-vs-tabs layout has to be
   * stubbed explicitly, or every test silently exercises one branch and the
   * other ships unverified.
   */
  if (tabsLayout !== undefined) {
    w.matchMedia = (q) => ({
      media: q,
      matches: tabsLayout,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    });
  }
  if (amdLoader) {
    // Minimal AMD loader: capture whatever the script defines as its module.
    w.define = (factory) => { w.__amdModule = factory(); };
    w.define.amd = {};
  }
  const tag = w.document.createElement("script");
  tag.src = "https://sa-equip-backend.vercel.app/public/widget.js";
  w.document.body.appendChild(tag);
  const run = w.document.createElement("script");
  run.textContent = SRC;
  w.document.body.appendChild(run);
  await new Promise((r) => setTimeout(r, 30));

  if (viaInit) {
    w.SAEquipHubWidget.init({ container: w.document.getElementById("host"), props });
    await new Promise((r) => setTimeout(r, settleMs));
  }
  return { w, d: w.document, fetchedUrl };
}

const labels = (d) => [...d.querySelectorAll(".saeh-tab-h")].map((b) => b.textContent.trim());
// Open state is a CLASS, not the `hidden` attribute — display:none cannot be
// transitioned from, so the panel could not slide. See the note in select().
const openPanels = (d) =>
  [...d.querySelectorAll(".saeh-tab-p")].filter((p) => p.classList.contains("saeh-open"));

async function main() {
  console.log("=== renderExternalApp interface ===");
  {
    const { w } = await boot({ viaInit: false });
    check(typeof w.SAEquipHubWidget === "object", "exposes the global");
    check(typeof w.SAEquipHubWidget.init === "function", "exports init()");
    check(typeof w.SAEquipHubWidget.clean === "function", "exports clean()");
  }
  {
    // A loader that takes the script's MODULE VALUE, not window[name], gets
    // undefined from a bare IIFE — which is how renderExternalApp loaded this
    // script and then never called init(), silently. Both contracts must hold.
    const { w } = await boot({ viaInit: false, amdLoader: true });
    const mod = w.__amdModule;
    check(!!mod, "defines an AMD module when define.amd is present");
    check(mod && typeof mod.init === "function" && typeof mod.clean === "function",
      "the AMD module exposes init() and clean()");
    check(mod === w.SAEquipHubWidget, "AMD and global expose the SAME interface");
  }

  console.log("\n=== all four tabs, in order ===");
  {
    const { d } = await boot({ props: { section: "tabs", slug: "ex-heater" } });
    check(labels(d).join(" | ") === "Overview | Technical Specs | Key Benefits | Applications",
      "tabs present and ordered", labels(d).join(" | "));
    check(openPanels(d).length === 1, "exactly one panel open");
    check(d.querySelector(".saeh-tab-h").getAttribute("aria-expanded") === "true", "first tab is the open one");
  }

  console.log("\n=== mobile opens nothing; desktop opens the first tab ===");
  {
    const { d } = await boot({ props: { section: "tabs", slug: "x" }, tabsLayout: true });
    check(openPanels(d).length === 1, "desktop: exactly one panel open");
    check(d.querySelector(".saeh-tab-h").getAttribute("aria-expanded") === "true",
      "desktop: it is the first");
  }
  {
    const { d } = await boot({ props: { section: "tabs", slug: "x" }, tabsLayout: false });
    check(openPanels(d).length === 0, "mobile: nothing open by default",
      String(openPanels(d).length));
    check([...d.querySelectorAll(".saeh-tab-h")].every((h) => h.getAttribute("aria-expanded") === "false"),
      "mobile: every header reports collapsed");

    // An accordion that can only open would strand the user with no way back
    // to the all-closed state it started in.
    const hs = [...d.querySelectorAll(".saeh-tab-h")];
    hs[1].click();
    check(openPanels(d).length === 1 && hs[1].getAttribute("aria-expanded") === "true",
      "mobile: clicking a header opens it");
    hs[1].click();
    check(openPanels(d).length === 0, "mobile: clicking it again closes it");
  }
  {
    // The tab layout must NOT toggle shut — a tab strip over an empty panel
    // area reads as broken rather than closed.
    const { d } = await boot({ props: { section: "tabs", slug: "x" }, tabsLayout: true });
    const h0 = d.querySelector(".saeh-tab-h");
    h0.click();
    check(openPanels(d).length === 1 && h0.getAttribute("aria-expanded") === "true",
      "desktop: re-clicking the open tab keeps it open");
  }

  console.log("\n=== EMPTY TABS ARE NOT RENDERED ===");
  {
    const { d } = await boot({ payload: { ...FULL, specs: [], benefits: [] }, props: { section: "tabs", slug: "x" } });
    check(labels(d).join(" | ") === "Overview | Applications", "only the populated tabs exist", labels(d).join(" | "));
    check(d.querySelectorAll(".saeh-tab-p").length === 2, "and only their panels");
  }
  {
    const { d } = await boot({
      payload: { ...FULL, descriptionHtml: "", specs: [], benefits: [], applications: [] },
      props: { section: "tabs", slug: "x" },
    });
    check(d.querySelectorAll(".saeh-tabs").length === 0, "no accordion at all when every tab is empty");
    check(d.getElementById("host").style.display === "none", "and the container collapses");
  }

  console.log("\n=== content reuses the existing designs ===");
  {
    const { d } = await boot({ props: { section: "tabs", slug: "x" } });
    check(!!d.querySelector(".saeh-prose p"), "Overview renders description HTML");
    const tcss = d.getElementById("saeh-styles").textContent;
    check(/\.saeh-tabs\{border:1px solid #ececec;overflow:hidden\}/.test(tcss),
      "the accordion has square corners");
    check(!/\.saeh-tabs\{[^}]*border-radius:10px/.test(tcss), "no 10px radius left on it");
    check(/\.saeh-prose ul,\.saeh-prose ol\{[^}]*padding-left:22px!important/.test(tcss),
      "list indent is !important, so the host reset cannot pull bullets outside");
    check(d.querySelectorAll(".saeh-tab-p")[1].querySelector("table.saeh-table") !== null, "Specs uses .saeh-table");
    check(d.querySelectorAll(".saeh-tab-p")[2].querySelector("ul.saeh-check") !== null, "Benefits uses .saeh-check (tick design)");
    check(d.querySelectorAll(".saeh-tab-p")[3].querySelector("ul.saeh-check") !== null,
      "Applications uses .saeh-check too — one list design, no per-path drift");
    check(d.querySelector("ul.saeh-apps") === null, "the dot-bullet variant is gone entirely");
  }

  console.log("\n=== static-page category mode (Industries pages) ===");
  const TAGGED = {
    category: { title: "Aviation & Aerospace", slug: "aviation-aerospace" },
    items: [
      { name: "EX Heater", slug: "ex-heater", url: "/product/ex-heater", imageUrl: "https://irp.cdn-website.com/a.webp" },
      { name: "EX Air Mover", slug: "ex-air-mover", url: "/product/ex-air-mover", imageUrl: null },
    ],
  };
  {
    const { d, fetchedUrl } = await boot({
      props: { section: "compatible", singlePage: true, productCategory: "aviation-aerospace" },
      catPayload: TAGGED,
    });
    check(
      fetchedUrl === "https://sa-equip-backend.vercel.app/public/products/by-category?category=aviation-aerospace",
      "category mode fetches by category, not by product",
      fetchedUrl,
    );
    check(d.querySelectorAll(".saeh-cp-card").length === 2, "renders a card per product in the category");
    // The whole point of the request: one renderer, so the Industries page
    // cannot drift from the product page's carousel.
    check(d.querySelector(".saeh-cp-track") !== null, "…using the same carousel markup");
    check(
      d.querySelector(".saeh-cp").getAttribute("data-count") === "2",
      "and the same data-count that drives arrow visibility",
    );
    check(
      d.querySelector(".saeh-root").className.indexOf("saeh-wide") !== -1,
      "opts out of the 920px cap, like the product-page carousel",
    );
    check(
      d.querySelector(".saeh-cp-h").textContent === "Compatible Products & Accessories",
      "heading falls back to the product-page wording",
      d.querySelector(".saeh-cp-h").textContent,
    );
  }
  {
    const { d } = await boot({
      props: { section: "compatible", singlePage: true, productCategory: "aviation-aerospace", heading: "Aviation Equipment" },
      catPayload: TAGGED,
    });
    check(d.querySelector(".saeh-cp-h").textContent === "Aviation Equipment", "heading is overridable");
  }
  {
    // A tag left selected from earlier experimentation must not hijack a
    // product page — `singlePage` is the switch, not the presence of a tag.
    const { d, fetchedUrl } = await boot({
      props: { section: "compatible", productCategory: "aviation-aerospace" },
      catPayload: TAGGED,
    });
    check(
      fetchedUrl.indexOf("/by-category") === -1,
      "a category alone does NOT switch a product page into category mode",
      fetchedUrl,
    );
    check(d.querySelectorAll(".saeh-cp-card").length === 3, "the product's own compatible list still wins");
  }
  {
    /*
     * Duda's content panel does not promise a literal boolean for a checkbox.
     * A strict `=== true` read "true"/1/"1" as OFF while Duda's own
     * "Show if: singlePage is true" rule read the same value as ON — the
     * widget and the editor disagreeing about one checkbox.
     */
    for (const on of [true, "true", 1, "1", "on", "yes"]) {
      const { fetchedUrl } = await boot({
        props: { section: "compatible", singlePage: on, productCategory: "aviation-aerospace" },
        catPayload: TAGGED,
      });
      check(
        fetchedUrl.indexOf("/by-category") !== -1,
        `singlePage=${JSON.stringify(on)} enters category mode`,
        fetchedUrl,
      );
    }
    for (const off of [false, "false", 0, "", undefined, "no"]) {
      const { fetchedUrl } = await boot({
        props: { section: "compatible", singlePage: off, productCategory: "aviation-aerospace" },
        catPayload: TAGGED,
      });
      check(
        fetchedUrl.indexOf("/by-category") === -1,
        `singlePage=${JSON.stringify(off)} stays in product mode`,
        fetchedUrl,
      );
    }
  }
  {
    // Duda's dropdown options are {value,label}; a loader passing the option
    // object straight through must not read as "nothing selected".
    const { d, fetchedUrl } = await boot({
      props: { section: "compatible", singlePage: true, productCategory: { value: "aviation-aerospace", label: "Aviation (3)" } },
      catPayload: TAGGED,
    });
    check(
      fetchedUrl === "https://sa-equip-backend.vercel.app/public/products/by-category?category=aviation-aerospace",
      "an option object works as well as a bare string",
      fetchedUrl,
    );
    check(d.querySelectorAll(".saeh-cp-card").length === 2, "and renders the same cards");
  }
  {
    const { d } = await boot({
      props: { section: "compatible", singlePage: true, productCategory: "" },
    });
    check(d.getElementById("host").style.display === "none", "category mode with no category collapses rather than erroring");
  }
  {
    const { d } = await boot({
      props: { section: "compatible", singlePage: true, productCategory: "gone" },
      catPayload: null,
    });
    check(d.getElementById("host").style.display === "none", "a deleted/renamed category (404) collapses too");
  }
  {
    const { d } = await boot({
      props: { section: "compatible", singlePage: true, productCategory: "aviation-aerospace", inEditor: true },
      catPayload: { category: { title: "Aviation & Aerospace", slug: "aviation-aerospace" }, items: [] },
    });
    check(
      d.getElementById("host").style.display !== "none",
      "but an empty category stays visible in the Duda editor, so the element can still be selected",
    );
  }

  {
    /*
     * The diagnostic that tells a stale shim from an unset value. Both produce
     * a widget that renders nothing on a static page; only propKeys separates
     * them, so it must be recorded whether or not tag mode engaged.
     */
    const { w } = await boot({ props: { section: "compatible" } });
    const li = w.__saequipHub.lastInit;
    check(Array.isArray(li.propKeys), "lastInit records which props arrived");
    check(li.propKeys.indexOf("singlePage") === -1, "an un-updated shim shows no singlePage key");
    check("mode" in li === false, "and no category mode was entered");
  }
  {
    const { w } = await boot({
      props: { section: "compatible", singlePage: false, productCategory: "" },
    });
    const li = w.__saequipHub.lastInit;
    check(
      li.propKeys.indexOf("singlePage") !== -1 && li.singlePage === false,
      "an updated shim with nothing ticked shows the key holding false",
    );
  }

  console.log("\n=== product listing: the page's category is the base filter ===");
  /*
   * ⚠️ The page's own category is a FIXED base, not a checkbox, and the sidebar
   * offers Site Challenges only. The fixture is built so both halves are
   * observable: P1 and P2 are the only Lighting and Power products, and only
   * P1 carries a challenge — so that page must offer exactly one option, and
   * never the Welding/Dust options that belong to products it is not showing.
   */
  const CAT = (id, title, slug, parentId) => ({ id, title, slug, parentId, depth: parentId === "ROOT" ? 0 : 1 });
  const CATALOGUE = {
    categories: [
      CAT("prod", "Products", "products", "ROOT"),
      CAT("lp", "Lighting and Power", "lighting-and-power", "prod"),
      CAT("fume", "Fume, Dust, LEV and Vapour Control", "fume-dust-lev-and-vapour-control", "prod"),
      CAT("ind", "Industries", "industries", "ROOT"),
      CAT("avi", "Aviation & Aerospace", "aviation---aerospace", "ind"),
      CAT("oil", "Oil & Gas", "oil---gas", "ind"),
      CAT("sc", "Site Challenges", "site-challenges", "ROOT"),
      CAT("weld", "Welding Fume Control", "welding-fume-control", "sc"),
      CAT("dust", "Dust Extraction", "dust-extraction", "sc"),
      CAT("dark", "Working in the Dark", "working-in-the-dark", "sc"),
    ],
    products: [
      { name: "P1", slug: "p1", url: "/product/p1", imageUrl: "https://x/1.jpg", categoryIds: ["lp", "avi", "dark"], certs: ["EX logo", "IECEx"] },
      { name: "P2", slug: "p2", url: "/product/p2", imageUrl: null, categoryIds: ["lp", "oil"], certs: [] },
      { name: "P3", slug: "p3", url: "/product/p3", imageUrl: "https://x/3.jpg", categoryIds: ["fume", "oil", "weld"], certs: ["UKCA"] },
      { name: "P4", slug: "p4", url: "/product/p4", imageUrl: null, categoryIds: ["fume", "avi", "dust"], certs: [] },
      { name: "P5", slug: "p5", url: "/product/p5", imageUrl: null, categoryIds: [], certs: [] },
    ],
  };
  const PL = { section: "product-list" };
  const AT = "https://saequip.multiscreensite.com/some-page";
  const CATEGORY = (slug) => `https://saequip.multiscreensite.com/category/${slug}`;
  const names = (d) => [...d.querySelectorAll(".saeh-pl-name")].map((n) => n.textContent);
  const opts = (d) => [...d.querySelectorAll(".saeh-pl-opt")].map((l) => l.querySelector(".saeh-pl-t").textContent);
  const tick = (d, id) => {
    const i = [...d.querySelectorAll(".saeh-pl-opt input")].find((x) => x.value === id);
    i.checked = !i.checked;
    i.dispatchEvent(new d.defaultView.Event("change"));
  };

  {
    const { d, w } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: CATEGORY("lighting-and-power") });
    check(w.__saequipHub.lastInit.categoryFrom === "url", "the page's category resolves from the url");
    check(names(d).join(",") === "P1,P2", "the grid shows ONLY that category's products", names(d).join(","));
    check(opts(d).join(",") === "Working in the Dark",
      "and the sidebar offers only the challenges those products actually have", opts(d).join(","));
    check(d.querySelectorAll(".saeh-pl-group").length === 1, "one group — industries and product types are not filters");
    check(d.querySelector(".saeh-pl-glabel").textContent === "Site Challenges", "labelled Site Challenges");
    check([...d.querySelectorAll(".saeh-pl-opt input")].every((i) => i.checked === false),
      "nothing is pre-ticked: the category is the base, not a selection");

    tick(d, "dark");
    check(names(d).join(",") === "P1", "ticking a challenge narrows within the category", names(d).join(","));
    tick(d, "dark");
    check(names(d).join(",") === "P1,P2", "unticking returns to the category, never the whole catalogue");
  }
  {
    // ⚠️ Duda renders "Oil & Gas" as `oil---gas`. A widget that slugified the
    // title would miss exactly the categories containing an ampersand.
    const { d } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: CATEGORY("oil---gas") });
    check(names(d).join(",") === "P2,P3", "an ampersand slug resolves", names(d).join(","));
    check(opts(d).join(",") === "Welding Fume Control",
      "a different category derives a different option set", opts(d).join(","));
  }
  {
    const { d } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: CATEGORY("industries") });
    check(names(d).join(",") === "P1,P2,P3,P4",
      "a PARENT page scopes to everything under it — a product sits on the leaves", names(d).join(","));
    check(opts(d).length === 3, "so all three challenges are offered", String(opts(d).length));
  }
  {
    const { d, w } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: CATEGORY("nope") });
    check(w.__saequipHub.lastInit.categoryFrom === "none", "an unknown slug resolves to nothing");
    check(names(d).length === 5, "…and falls back to the whole catalogue rather than an empty page");
  }
  {
    const { d, w } = await boot({
      props: { section: "product-list", category: "welding-fume-control" },
      cataloguePayload: CATALOGUE, url: "https://saequip.multiscreensite.com/anything",
    });
    check(names(d).join(",") === "P3", "an explicit prop resolves too", names(d).join(","));
    check(w.__saequipHub.lastInit.categoryFrom === "props", "recorded as resolved from props");
  }
  {
    const { d } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: AT });
    check(names(d).join(",") === "P1,P2,P3,P4,P5", "with no category, everything shows");
    tick(d, "weld");
    check(names(d).join(",") === "P3", "one challenge filters to its products", names(d).join(","));
    tick(d, "dust");
    check(names(d).join(",") === "P3,P4", "a second challenge WIDENS — they are OR, not AND", names(d).join(","));
    d.querySelector(".saeh-pl-clear").dispatchEvent(new d.defaultView.MouseEvent("click"));
    check(names(d).join(",") === "P1,P2,P3,P4,P5", "clear filters restores everything");
  }
  {
    // The filter group is named, not hard-coded, because the tree is expected
    // to be renamed — a rename should cost a content-panel edit, not a deploy.
    const { d } = await boot({
      props: { section: "product-list", filterGroup: "Industries" },
      cataloguePayload: CATALOGUE, url: AT,
    });
    check(d.querySelector(".saeh-pl-glabel").textContent === "Industries", "the filter group is configurable");
  }
  {
    const only = {
      categories: CATALOGUE.categories,
      products: [{ name: "Solo", slug: "s", url: "/product/s", imageUrl: null, categoryIds: ["lp"], certs: [] }],
    };
    const { d } = await boot({ props: PL, cataloguePayload: only, url: CATEGORY("lighting-and-power") });
    check(d.querySelectorAll(".saeh-pl-opt").length === 0, "no challenges in scope means no options at all");
    check(d.querySelector(".saeh-pl-clear") === null, "…and no Clear filters button offering to undo nothing");
    check(names(d).join(",") === "Solo", "…and the grid still renders");
  }

  console.log("\n=== product listing: cards and layout ===");
  {
    const { d } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: AT });
    const css = d.getElementById("saeh-styles").textContent;
    const card = d.querySelector("a.saeh-pl-card");
    check(card.getAttribute("href") === "/product/p1", "the whole card links to the product");
    check(d.querySelectorAll(".saeh-pl-btn").length === 5, "ONE button per card, not two");
    check(d.querySelector(".saeh-pl-btn").textContent === "View Product", "labelled View Product");
    check(
      [...card.querySelectorAll(".saeh-pl-chip")].map((c) => c.textContent).join(",") === "Working in the Dark",
      "chips come from the filter group only, not every category",
    );
    check(card.querySelector(".saeh-pl-certs").textContent === "EX logo, IECEx", "certs render as text");
    /*
     * ⚠️ One span per certification, each nowrap. A single joined string lets
     * the browser break anywhere — "Zone 1-2" wrapped as "Zone" / "1-2", which
     * reads as two separate marks. The separator is its own text node, so the
     * break opportunity is BETWEEN items and a comma never starts a line.
     */
    const certSpans = [...card.querySelectorAll(".saeh-pl-certs span")];
    check(certSpans.length === 2, "one span per certification, not one joined string", String(certSpans.length));
    check(certSpans.map((n) => n.textContent).join("|") === "EX logo|IECEx", "each carries only its own mark");
    check(/\.saeh-pl-certs span\{white-space:nowrap\}/.test(css), "…and each is unbreakable");
    check(/\.saeh-pl-chip\{[^}]*background:#fff/.test(css),
      "chips are white — #f1f1f1 was invisible on the body's #f4f4f4");
    // h4: the card title sits under the page's own heading levels, not beside them.
    check(card.querySelector(".saeh-pl-name").tagName === "H4", "the product title is an h4");
    const second = d.querySelectorAll(".saeh-pl-card")[1];
    check(second.querySelector(".saeh-pl-certs") === null, "a product with no certs gets no cert line");
    check(second.querySelector("img") === null, "a product with no image still renders a card");

    check(/\.saeh-pl-shot\{aspect-ratio:1\/1/.test(css), "the image area is square");
    check(/\.saeh-pl-shot img\{[^}]*object-fit:contain/.test(css),
      "and CONTAINS rather than crops — cropping industrial kit cuts the product out of frame");
    check(/\.saeh-pl-card\{[^}]*background:#fff/.test(css), "cards are white");

    check(/\.saeh-pl\{display:flex;flex-direction:column/.test(css), "stacked on mobile by default");
    check(/\.saeh-pl-grid\{display:grid;gap:20px;grid-template-columns:1fr\}/.test(css), "1 column on mobile");
    check(/@media\(min-width:561px\)\{\.saeh-pl-grid\{grid-template-columns:repeat\(2,1fr\)\}\}/.test(css), "2 on tablet");
    check(/\.saeh-pl-grid\{grid-template-columns:repeat\(3,1fr\)\}/.test(css), "3 on desktop");
    check(/\.saeh-pl-toggle\{display:none\}/.test(css), "the filter toggle is hidden on desktop");

    const btn = d.querySelector(".saeh-pl-toggle");
    const panel = d.querySelector(".saeh-pl-panel");
    check(btn.getAttribute("aria-controls") === panel.id, "the mobile toggle is wired to its panel");
    btn.dispatchEvent(new d.defaultView.MouseEvent("click"));
    check(btn.getAttribute("aria-expanded") === "true" && panel.classList.contains("saeh-open"),
      "and opens it");
  }

  console.log("\n=== product listing: the View Product button ===");
  {
    const { d } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: AT });
    const css = d.getElementById("saeh-styles").textContent;
    const cta = d.querySelector(".saeh-pl-btn");
    /*
     * ⚠️ The chevron is drawn INLINE, not fetched. It only appears on hover, so
     * a network-loaded icon is blank for exactly as long as the hover that
     * reveals it — the one moment it has to be there.
     */
    const svg = cta.querySelector("svg");
    check(!!svg, "the button carries an inline chevron");
    check(svg.querySelectorAll("path").length === 2, "a DOUBLE chevron — two strokes");
    check(svg.getAttribute("aria-hidden") === "true", "hidden from assistive tech: the label already says it");
    check(cta.textContent === "View Product", "…and adds no text of its own");
    check(/\.saeh-pl-btn\{[^}]*font-size:16px/.test(css), "16px, matching the site's buttons");
    check(/\.saeh-pl-btn\{[^}]*font-weight:400/.test(css), "at 400 weight");
    check(/\.saeh-pl-btn\{[^}]*text-transform:none/.test(css), "and NOT all caps");
    /*
     * ⚠️ The WRAPPER animates, never the svg. Animating the svg's own width
     * scales its viewBox content, so the chevron zoomed up from a dot instead
     * of sliding out from behind the label.
     */
    check(svg.parentNode.className === "saeh-pl-chevwrap", "the chevron sits in a clipping wrapper");
    check(/\.saeh-pl-chevwrap\{[^}]*width:0;overflow:hidden;opacity:0/.test(css),
      "which is what starts collapsed and invisible");
    check(/\.saeh-pl-btn svg\{width:19px;height:19px/.test(css),
      "while the svg keeps a FIXED size, so it slides rather than zooms");
    check(svg.getAttribute("width") === "19" && svg.getAttribute("height") === "19",
      "…and carries that size as attributes too, so it is right before the CSS lands");
    check(/\.saeh-pl-card:hover \.saeh-pl-chevwrap[^{]*\{[^}]*width:19px;opacity:1/.test(css),
      "and expands on hover, which is what slides the label left");
  }

  console.log("\n=== product listing: search and load more ===");
  {
    // 40 products so pagination is observable: 18, then 18, then 4.
    const many = {
      categories: CATALOGUE.categories,
      products: Array.from({ length: 40 }, (_, i) => ({
        name: i === 7 ? "Welding Torch" : `Item ${String(i).padStart(2, "0")}`,
        slug: `i${i}`, url: `/product/i${i}`, imageUrl: null,
        categoryIds: i % 2 ? ["weld"] : ["dust"], certs: [],
      })),
    };
    const { d } = await boot({ props: PL, cataloguePayload: many, url: AT });
    const cards = () => d.querySelectorAll(".saeh-pl-card").length;
    const moreBtn = () => d.querySelector(".saeh-pl-more");

    check(cards() === 18, "the first page shows 18", String(cards()));
    check(!!moreBtn(), "and offers load more");
    check(moreBtn().textContent.includes("+22"), "naming how many are left", moreBtn().textContent);

    /*
     * ⚠️ The already-rendered cards must be the SAME NODES afterwards. Emptying
     * the grid shrinks the document to almost nothing, the browser clamps
     * scrollY to the new maximum, and the cards appended a moment later cannot
     * put it back — so "load more" threw the visitor to the top of the page.
     * Appending never shrinks the page, so there is nothing to clamp.
     */
    const firstBefore = d.querySelector(".saeh-pl-card");
    const eighteenthBefore = d.querySelectorAll(".saeh-pl-card")[17];
    const btnBefore = moreBtn();
    /*
     * ⚠️ The button must be the SAME node too. A re-created one loses focus,
     * and refocusing the replacement scrolled the viewport down to it — a
     * click focuses a button, so that fired on every mouse click, not just
     * keyboard use. Loading more is not navigation: nothing may move the view.
     */
    let focused = 0;
    d.defaultView.HTMLElement.prototype.focus = function () {
      focused++;
    };
    moreBtn().dispatchEvent(new d.defaultView.MouseEvent("click"));
    check(moreBtn() === btnBefore, "the load-more button is reused, never re-created");
    check(focused === 0, "…so nothing calls focus(), which would scroll it into view");
    check(cards() === 36, "a click loads another 18", String(cards()));
    check(d.querySelector(".saeh-pl-card") === firstBefore,
      "the cards already on screen are APPENDED to, never re-created");
    check(d.querySelectorAll(".saeh-pl-card")[17] === eighteenthBefore, "…all the way to the last of them");
    check(moreBtn().textContent.includes("+4"), "and the remainder updates", moreBtn().textContent);

    moreBtn().dispatchEvent(new d.defaultView.MouseEvent("click"));
    check(cards() === 40, "the last click shows the rest");
    check(moreBtn() === null, "and the button goes away when nothing is left");
    check(focused === 0, "…still without a single focus() call");
  }
  {
    const many = {
      categories: CATALOGUE.categories,
      products: Array.from({ length: 40 }, (_, i) => ({
        name: i === 7 ? "Welding Torch" : `Item ${String(i).padStart(2, "0")}`,
        slug: `i${i}`, url: `/product/i${i}`, imageUrl: null,
        categoryIds: i % 2 ? ["weld"] : ["dust"], certs: [],
      })),
    };
    const { d } = await boot({ props: PL, cataloguePayload: many, url: AT });
    const search = d.querySelector(".saeh-pl-search input");
    const clearQ = d.querySelector(".saeh-pl-clearq");
    const type = (v) => {
      search.value = v;
      search.dispatchEvent(new d.defaultView.Event("input"));
    };
    const enter = () =>
      search.dispatchEvent(new d.defaultView.KeyboardEvent("keydown", { key: "Enter" }));

    /*
     * ⚠️ Search runs on ENTER, not on every keystroke. Re-rendering the grid
     * mid-word makes the list jump under your thumb on a phone with the
     * keyboard open — and "weld" would strand you on an empty page on the way
     * to "welding torch".
     */
    type("welding torch");
    check(d.querySelectorAll(".saeh-pl-card").length === 18, "typing alone does NOT filter");
    check(clearQ.className.indexOf("on") !== -1, "…though the clear button appears as soon as there is text");
    enter();
    check(
      [...d.querySelectorAll(".saeh-pl-name")].map((n) => n.textContent).join(",") === "Welding Torch",
      "Enter runs it, matching the product name",
    );

    // "Product or task": a category title is searchable too, so a site
    // challenge finds the products under it.
    type("welding fume");
    enter();
    check(d.querySelectorAll(".saeh-pl-card").length === 18, "a category title matches its products");
    check(d.querySelector(".saeh-pl-more").textContent.includes("+2"), "…and paginates them", d.querySelector(".saeh-pl-more").textContent);

    type("nothing at all");
    enter();
    check(!!d.querySelector(".saeh-pl-empty"), "no match shows the empty state");
    check(d.querySelector(".saeh-pl-filter") !== null, "…with the filters still on screen to widen from");

    clearQ.dispatchEvent(new d.defaultView.MouseEvent("click"));
    check(d.querySelectorAll(".saeh-pl-card").length === 18, "the X clears the search and restores the page");
    check(search.value === "", "…and empties the field");
    check(clearQ.className.indexOf("on") === -1, "…and hides itself again");
    check(clearQ.querySelector("svg path").getAttribute("stroke") === "currentColor",
      "the X is a stroked SVG, not the browser's own glyph");
  }
  {
    // Narrowing must reset the offset, or "load more" outlives what it loads.
    const many = {
      categories: CATALOGUE.categories,
      products: Array.from({ length: 40 }, (_, i) => ({
        name: `Item ${i}`, slug: `i${i}`, url: `/product/i${i}`, imageUrl: null,
        categoryIds: i < 20 ? ["weld"] : ["dust"], certs: [],
      })),
    };
    const { d } = await boot({ props: PL, cataloguePayload: many, url: AT });
    const before = d.querySelector(".saeh-pl-card");
    d.querySelector(".saeh-pl-more").dispatchEvent(new d.defaultView.MouseEvent("click"));
    check(d.querySelectorAll(".saeh-pl-card").length === 36, "36 loaded");
    tick(d, "weld");
    // A FILTER change does rebuild — the results are different products, so
    // reusing the nodes would show the wrong ones.
    check(d.querySelector(".saeh-pl-card") !== before, "a filter change rebuilds rather than appends");
    check(d.querySelectorAll(".saeh-pl-card").length === 18, "filtering resets to the first page", String(d.querySelectorAll(".saeh-pl-card").length));
  }

  console.log("\n=== product listing: styling ===");
  {
    const { d } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: AT });
    const css = d.getElementById("saeh-styles").textContent;
    check(/\.saeh-pl-shot\{[^}]*background:#fff/.test(css), "the image area is white, not grey");
    check(/\.saeh-pl-shot\{(?![^}]*padding)[^}]*\}/.test(css), "the image sits flush — no padding around it");
    check(/\.saeh-pl-shot\{[^}]*overflow:hidden/.test(css), "…and clips, so the hover zoom cannot spill");
    check(/\.saeh-pl-card:hover \.saeh-pl-shot img\{transform:scale\(1\.045\)\}/.test(css),
      "a small zoom on tile hover");
    check(/\.saeh-pl-body\{[^}]*background:#f4f4f4/.test(css), "the title and cert area is light grey");
    check(/\.saeh-pl-name\{[^}]*font-size:15px/.test(css), "titles are smaller");
    check(/\.saeh-pl-more\{[^}]*background:transparent[^}]*border:1px solid #111/.test(css),
      "load more is bordered by default");
    check(/\.saeh-pl-more:hover\{background:#111;color:#fff\}/.test(css), "and fills black on hover");
    check(/\.saeh-pl-empty\{[^}]*text-align:center/.test(css), "the empty message is centred");
    // ⚠️ Without this it is an ordinary grid item in column 1 of 3, and the
    // auto margins centre it within that first third rather than the grid.
    check(/\.saeh-pl-empty\{grid-column:1\/-1/.test(css),
      "…across the WHOLE grid, where the products would sit");
    // Duda's theme colour, with the brand yellow only as a fallback for the
    // editor preview — hard-coding it would drift the day the theme changes.
    check(/\.saeh-pl-filter\{border-top:5px solid var\(--color_7,#fed217\)\}/.test(css),
      "a 5px theme-coloured rule tops the filter bar on desktop");
    check(/\.saeh-pl-side\{flex:0 0 300px;max-width:300px/.test(css), "the sidebar is 300px on desktop");
    check(/\.saeh-pl-side\{[^}]*position:sticky;top:20px/.test(css), "…and sticky");
    check(/\.saeh-pl-side\{[^}]*max-height:calc\(100vh - 40px\);overflow-y:auto/.test(css),
      "…and scrolls internally, so a long filter list cannot outrun the viewport");
    check(/@keyframes saeh-pl-in\{from\{opacity:0;transform:translateY\(12px\)\}/.test(css),
      "cards fade up as they arrive");
    check(/@media\(prefers-reduced-motion:reduce\)\{[^@]*\.saeh-pl-card\{animation:none\}/.test(css),
      "…and not at all for anyone who asked for less motion");
    // The search must survive the mobile collapse, so it sits outside the panel.
    check(
      d.querySelector(".saeh-pl-panel .saeh-pl-search") === null &&
        d.querySelector(".saeh-pl-filter > .saeh-pl-search") !== null,
      "the search sits OUTSIDE the collapsible panel, so it stays visible on mobile",
    );
  }

  console.log("\n=== product listing: the filter panel's heading and search ===");
  {
    const { d } = await boot({ props: PL, cataloguePayload: CATALOGUE, url: AT });
    const css = d.getElementById("saeh-styles").textContent;
    const title = d.querySelector(".saeh-pl-title");
    check(title.tagName === "H6", "the panel heading is an h6", title.tagName);
    check(title.textContent === "Filter Products", "labelled Filter Products");
    check(d.querySelector(".saeh-pl-rule") !== null, "with a divider under it");
    check(/\.saeh-pl-rule\{height:1px;margin:0 16px/.test(css),
      "…inset, so it lines up with the input rather than running edge to edge");
    /*
     * ⚠️ The h6 and the mobile toggle carry the SAME words, so exactly one may
     * be visible at a time or the label is announced twice.
     */
    check(/\.saeh-pl-title,\.saeh-pl-rule\{display:none\}/.test(css), "heading hidden by default (mobile)…");
    check(/\.saeh-pl-title\{display:block\}/.test(css), "…and shown on desktop, where the toggle is hidden");

    const input = d.querySelector(".saeh-pl-search input");
    check(input.placeholder === "Search products...", "placeholder", input.placeholder);
    const label = d.querySelector(".saeh-pl-slabel");
    check(label.textContent === "Search within category", "the input has a visible label");
    // The group heading and the field label are peers in the panel, so they
    // share one treatment rather than being two different ones.
    const lbl = /\.saeh-pl-slabel\{[^}]*font-family:var\(--saeh-body\);font-size:14px;font-weight:600/.test(css);
    const grp = /\.saeh-pl-glabel\{font-family:var\(--saeh-body\);font-size:14px;font-weight:600/.test(css);
    check(lbl && grp, "the group heading matches the search label's type");
    check(!/\.saeh-pl-glabel\{[^}]*text-transform:uppercase/.test(css),
      "…including its case — the title renders as stored");
    // A real <label for>, not an aria-label: the accessible name should be the
    // one on screen.
    check(label.getAttribute("for") === input.id && !!input.id, "wired to the input by id");
    check(input.getAttribute("aria-label") === null, "…so no redundant aria-label overrides it");
    // ⚠️ Its own relative box. Against .saeh-pl-search the X would centre on
    // the label and input together, and sit low.
    check(d.querySelector(".saeh-pl-sbox .saeh-pl-clearq") !== null, "the clear button positions against the input alone");
    check(/\.saeh-pl-sbox\{position:relative\}/.test(css), "which is what carries the positioning context");
    /*
     * Matches the dashboard's field treatment: a 3px ring at HALF opacity plus
     * a tinted border, eased. box-shadow rather than a thicker border because
     * it takes no layout space, so the field cannot shift as it gains focus.
     *
     * ⚠️ The literal rgba must survive on its own. `color-mix` is what applies
     * the alpha to the THEME colour, but a browser that does not know it drops
     * the whole declaration — so the fallback cannot be merged into that rule.
     */
    check(/\.saeh-pl-search input:focus\{[^}]*box-shadow:0 0 0 3px rgba\(254,210,23,\.5\)\}/.test(css),
      "a half-opacity ring on focus, with a literal fallback that stands alone");
    check(/\.saeh-pl-search input:focus\{box-shadow:0 0 0 3px color-mix\(in srgb,var\(--color_7,#fed217\) 50%,transparent\)\}/.test(css),
      "…overridden by the theme colour where color-mix is supported");
    check(/\.saeh-pl-search input\{[^}]*transition:border-color \.15s/.test(css),
      "…and eased, like the dashboard's fields");
    check(/@media\(prefers-reduced-motion:reduce\)\{[^@]*\.saeh-pl-search input\{transition:none\}/.test(css),
      "…but not for anyone who asked for less motion");
  }

  {
    // "all" must not build this — it belongs to a category page, not a product.
    const { d } = await boot({ props: { section: "all", slug: "x" }, cataloguePayload: CATALOGUE });
    check(d.querySelector(".saeh-pl") === null, "the legacy \"all\" embed never builds the listing");
  }

  console.log("\n=== logo rows and compatible-card titles ===");
  {
    // Real logos, not the empty FULL fixture: an empty section renders
    // nothing, collapses, and never injects the stylesheet to assert against.
    const { d } = await boot({
      payload: {
        ...FULL,
        logos: { sa: [{ url: "https://x/cyclone.png", label: "Cyclone" }], cert: [] },
      },
      props: { section: "sa-logos", slug: "x" },
    });
    check(d.querySelectorAll(".saeh-logos img").length === 1, "the SA logo row renders its mark");
    const css = d.getElementById("saeh-styles").textContent;
    check(/\.saeh-logos img\{height:35px;width:auto/.test(css), "logos are 35px tall by default");
    check(/@media\(max-width:560px\)\{\.saeh-logos img\{height:28px\}\}/.test(css),
      "and 28px on mobile");
    // width:auto is what makes a uniform height possible at all, so a mobile
    // override that touched width would undo it for small screens only.
    check(!/@media\(max-width:560px\)\{\.saeh-logos img\{[^}]*width/.test(css),
      "the mobile override changes height only, leaving width:auto intact");
  }
  {
    const { d } = await boot({ props: { section: "compatible", slug: "x" } });
    const css = d.getElementById("saeh-styles").textContent;
    check(!/\.saeh-pl-name\{[^}]*text-transform:uppercase/.test(css),
      "compatible cards show the product name as stored, not uppercased");
    // ⚠️ The carousel card must carry NO visual rules of its own. It shares
    // .saeh-pl-card with the listing grid, and a second copy of the design is
    // exactly how the button ended up uppercase in one and sentence case in
    // the other.
    check(/\.saeh-cp-card\{flex:0 0 100%;scroll-snap-align:start\}/.test(css),
      "…because .saeh-cp-card is layout only");
    for (const dead of ["saeh-cp-name", "saeh-cp-body", "saeh-cp-shot", "saeh-cp-btn"]) {
      check(css.indexOf("." + dead) === -1, `no leftover .${dead} rule to drift from the grid`);
    }
  }

  console.log("\n=== motion: sliding panel, sliding tab indicator ===");
  {
    const { d } = await boot({ props: { section: "tabs", slug: "x" }, tabsLayout: false });
    const css = d.getElementById("saeh-styles").textContent;

    // The 0fr→1fr grid row is the whole mechanism; a max-height rewrite would
    // silently reintroduce the clipped-or-pausing panel this replaced.
    check(/\.saeh-tab-p\{[^}]*grid-template-rows:0fr/.test(css), "collapsed panel is a 0fr grid row");
    check(/\.saeh-tab-p\.saeh-open\{[^}]*grid-template-rows:1fr/.test(css), "open panel is 1fr");
    check(/\.saeh-tab-p\{[^}]*transition:grid-template-rows \.34s/.test(css), "and it transitions");

    // The clipping element must carry overflow and NOTHING else: padding or a
    // border here survives the collapse, leaving a 0fr row tens of px tall.
    const clip = /\.saeh-tab-c\{([^}]*)\}/.exec(css);
    check(!!clip && !/padding|border|margin/.test(clip[1]),
      "the clipping element has no padding/border/margin of its own", clip && clip[1]);
    check(/\.saeh-tab-b\{padding:18px 16px;border-top/.test(css),
      "padding and divider sit on the inner element instead");

    // visibility, not display — and delayed, or the content vanishes on frame
    // one and the slide plays against empty space.
    check(/\.saeh-tab-p\{[^}]*visibility:hidden[^}]*visibility 0s linear \.34s/.test(css),
      "a closed panel hides via visibility, delayed until the slide finishes");

    const panel = d.querySelector(".saeh-tab-p");
    check(panel.hidden === false, "the `hidden` attribute is no longer used (it would block the transition)");
    check(panel.querySelector(".saeh-tab-c > .saeh-tab-b") !== null, "panel nests clip > body");

    check(/@media\(prefers-reduced-motion:reduce\)/.test(css), "reduced motion is honoured");
  }
  {
    const { d } = await boot({ props: { section: "tabs", slug: "x" }, tabsLayout: true });
    const css = d.getElementById("saeh-styles").textContent;

    check(d.querySelector(".saeh-tab-bar") !== null, "the indicator element exists");
    check(/\.saeh-tab-bar\{display:none\}/.test(css), "and is hidden until it has been placed");
    check(/\.saeh-tabs\.saeh-slide \.saeh-tab-h\[aria-expanded='true'\]\{border-bottom-color:transparent\}/.test(css),
      "the per-header border switches off only under .saeh-slide");
    check(/\.saeh-tab-h\[aria-expanded='true'\]\{background:none;border-bottom-color:#ffd200\}/.test(css),
      "…so the instant underline remains the unconditional default");

    /*
     * The carousel-arrow lesson, asserted. jsdom performs no layout, so every
     * offset reads 0 — exactly the "measurement ran too early" case. The bar
     * must then stay OFF and leave the fallback underline showing, rather than
     * switching the border off and painting a zero-width bar, which is how a
     * tab ends up with no underline at all.
     */
    const wrap = d.querySelector(".saeh-tabs");
    check(!wrap.classList.contains("saeh-slide"),
      "an unmeasurable layout leaves .saeh-slide off, so the fallback underline holds");
    check(d.querySelector(".saeh-tab-h").getAttribute("aria-expanded") === "true",
      "and the active tab is still marked, so it is still underlined");
  }
  {
    // Mobile type step. 720px is the exact complement of the 721px tab
    // breakpoint, so these apply precisely in accordion layout.
    const { d } = await boot({ props: { section: "tabs", slug: "x" } });
    const css = d.getElementById("saeh-styles").textContent;
    const mq = /@media\(max-width:720px\)\{([^@]*?)\}(?:,|$)/.exec(css.replace(/\n/g, ""));
    check(/@media\(max-width:720px\)\{\.saeh-prose,\.saeh-list li\{font-size:14px\}\.saeh-table\{font-size:13px\}\}/.test(css),
      "mobile: content 14px, spec table 13px", mq && mq[1]);
    check(/\.saeh-table\{width:100%;border-collapse:collapse;font-size:15px/.test(css),
      "and the desktop size is untouched at 15px");
  }

  console.log("\n=== four widgets on one page keep their own wiring ===");
  {
    // The report that prompted this: "cert-logos is showing tabs, 3d-viewer is
    // showing cert-logos". Nothing here indexes or orders sections, so prove
    // that four inits on one page each render exactly what they asked for.
    const { w, d } = await boot({ viaInit: false });
    const wanted = ["sa-logos", "cert-logos", "tabs", "specs"];
    const hosts = wanted.map((name) => {
      const div = d.createElement("div");
      div.id = "w-" + name;
      d.body.appendChild(div);
      w.SAEquipHubWidget.init({ container: div, props: { section: name, slug: "x" } });
      return div;
    });
    await new Promise((r) => setTimeout(r, 60));
    const stamped = hosts.map((h) => h.getAttribute("data-saeh-section"));
    check(stamped.join("|") === wanted.join("|"), "each container renders its OWN section", stamped.join("|"));
    check(d.querySelector("#w-tabs .saeh-tabs") !== null, "only the tabs widget builds an accordion");
    check(d.querySelector("#w-cert-logos .saeh-tabs") === null, "cert-logos does NOT build an accordion");
    check(w.__saequipHub.inits.length === 4, "all four inits are recorded, not just the last",
      String(w.__saequipHub.inits.length));
    check(w.__saequipHub.inits.map((i) => i.resolvedSection).join("|") === wanted.join("|"),
      "and each records the section it was asked for");
  }

  console.log("\n=== crossed props cannot misroute a widget ===");
  {
    // Reproduces the reported failure: four shims evaluated first, their
    // callbacks running afterwards with a SHARED props object that by then
    // holds the last widget's section. Without the attribute rule every
    // container would render "3d-viewer".
    const { w, d } = await boot({ viaInit: false });
    const wanted = ["sa-logos", "cert-logos", "compatible", "3d-viewer"];
    const hosts = wanted.map((name) => {
      const div = d.createElement("div");
      div.id = "x-" + name;
      // The shim stamps this synchronously, per element.
      div.setAttribute("data-saeh-section", name);
      d.body.appendChild(div);
      return div;
    });
    const shared = { section: "3d-viewer", slug: "x" }; // the last widget's props
    for (const div of hosts) w.SAEquipHubWidget.init({ container: div, props: shared });
    await new Promise((r) => setTimeout(r, 80));

    const got = hosts.map((h) => h.getAttribute("data-saeh-section"));
    check(got.join("|") === wanted.join("|"), "each container keeps its OWN section", got.join("|"));
    check(d.querySelector("#x-compatible .saeh-cp-track") !== null,
      "the compatible widget renders a carousel, not the 3D banner");
    check(d.querySelector("#x-compatible .saeh-3d-cta") === null, "and no 3D banner leaked into it");
    const inits = w.__saequipHub.inits.slice(-4);
    check(inits.every((i) => i.sectionFrom === "container attribute"), "the attribute is what was used");
    check(d.querySelector("#x-compatible .saeh-cp").getAttribute("data-count") === "3",
      "count published on the crossed-props render too");
    check(inits.filter((i) => i.sectionMismatch).length === 3,
      "and the three disagreements are recorded rather than hidden",
      String(inits.filter((i) => i.sectionMismatch).length));
  }

  console.log("\n=== the accordion is full width, the narrow sections are not ===");
  {
    const { d } = await boot({ props: { section: "tabs", slug: "x" } });
    check(d.querySelector(".saeh-root").classList.contains("saeh-wide"),
      "tabs opt out of the 920px cap via .saeh-wide");
  }
  {
    const { d } = await boot({ props: { section: "specs", slug: "x" } });
    check(!d.querySelector(".saeh-root").classList.contains("saeh-wide"),
      "a standalone spec table keeps the cap");
  }

  console.log("\n=== 3D call-to-action: flat, sharp, icon+text left / button right ===");
  {
    const { d, w } = await boot({
      payload: { ...FULL, model3dUrl: "https://example.test/m.glb" },
      props: { section: "3d-viewer", slug: "x" },
    });
    const cta = d.querySelector(".saeh-3d-cta");
    check(!!cta, "the CTA renders");
    // The icon and headline must be ONE grouped block, or space-between
    // pushes the headline into the middle of the banner.
    const kids = [...cta.children].map((c) => c.className);
    check(kids.length === 2 && /saeh-3d-cta-main/.test(kids[0]) && /saeh-3d-btn/.test(kids[1]),
      "two children: grouped icon+title, then the button", kids.join(" + "));
    const main = cta.querySelector(".saeh-3d-cta-main");
    check(!!main.querySelector(".saeh-3d-icon") && !!main.querySelector(".saeh-3d-cta-title"),
      "icon and title are both inside the left group");
    const cube = main.querySelector(".saeh-3d-icon");
    check(cube.querySelectorAll("path").length === 1, "the cube glyph is a single path",
      String(cube.querySelectorAll("path").length));
    // currentColor, not the asset's #000000 — otherwise `.saeh-3d-icon{color:}`
    // is silently ignored and the colour can't be changed from CSS at all.
    check(cube.getAttribute("stroke") === "currentColor", "cube strokes currentColor, not a hardcoded black");
    check(cube.getAttribute("stroke-width") === "1.6", "stroke-width 1.6 — heavier crowds the faces at 34px");
    // The edges are open subpaths, so butt caps leave visible notches at every
    // corner. round is load-bearing here, not decoration.
    check(cube.getAttribute("stroke-linecap") === "round" && cube.getAttribute("stroke-linejoin") === "round",
      "round caps AND joins (open subpaths would notch at the corners)");
    check(cube.getAttribute("fill") === "none", "unfilled");
    check(cta.querySelector(".saeh-btn") === null,
      "does NOT reuse the black .saeh-btn pill");
    const css = w.document.getElementById("saeh-styles").textContent;
    const rule = css.match(/\.saeh-3d-cta\{[^}]*\}/)[0];
    check(/background:#eceef1/.test(rule), "banner background is #eceef1");
    check(!/border(?!-)/.test(rule) && !/border-radius/.test(rule), "no border and no radius", rule);
    const btn = css.match(/\.saeh-3d-btn\{[^}]*\}/)[0];
    check(/background:#fed217/.test(btn) && /color:#000/.test(btn), "button is #fed217 with black text");
    check(/border-radius:0/.test(btn), "button is sharp");
    check(/min-height:44px/.test(btn), "button keeps a 44px tap target");
    check(/font-family:var\(--saeh-head\)/.test(css.match(/\.saeh-3d-cta-title\{[^}]*\}/)[0]),
      "headline uses the Barlow heading family");
    check(/\.saeh-3d-cta-title\{[^}]*font-size:20px/.test(css), "headline is 20px");
    // The label must be its own element, or the chevron would sit inside the
    // button's accessible name and read as part of "View 3D Mode".
    const label = cta.querySelector(".saeh-3d-btn > span");
    check(label && label.textContent === "View 3D Mode", "button label is a separate span", label?.textContent);
    const ico = cta.querySelector(".saeh-3d-btn-icon");
    check(!!ico && ico.tagName === "IMG", "the chevron renders as an <img>");
    check(/^https:\/\/irp\.cdn-website\.com\/8a8f03b5\/icon\/chevron\+right_8187511\.svg$/.test(ico.getAttribute("src")),
      "points at the Duda-hosted chevron", ico.getAttribute("src"));
    check(ico.getAttribute("alt") === "" && ico.getAttribute("aria-hidden") === "true",
      "the chevron is decorative, not part of the button's name");
    check(ico.getAttribute("width") === "20" && ico.getAttribute("height") === "20",
      "width/height attributes reserve the box before it loads");
    check(ico.nextSibling === null && label.nextSibling === ico, "the chevron sits AFTER the label");
    const iconCss = css.match(/\.saeh-3d-btn-icon\{[^}]*\}/)[0];
    check(/width:20px/.test(iconCss) && /height:20px/.test(iconCss), "and is 20x20 in CSS too");
    check(/font-family:var\(--saeh-body\)/.test(btn), "button label is Inter, not Barlow");
    check(/text-transform:none/.test(btn), "button is NOT uppercase");
    // A dead CDN URL must leave a text-only button, never a broken-image glyph
    // on a live product page.
    ico.dispatchEvent(new w.Event("error"));
    check(ico.style.display === "none", "a failed icon load hides the image");
    check(cta.querySelector(".saeh-3d-btn").textContent === "View 3D Mode", "leaving the label intact");
    check(/@media\(max-width:520px\)[^@]*\.saeh-3d-btn\{flex:1 1 100%/.test(css),
      "button goes full width on narrow screens");
  }

  console.log("\n=== spec table: multi-line specs and sub-headings ===");
  {
    const { d } = await boot({ props: { section: "specs", slug: "x" } });
    const trs = [...d.querySelectorAll(".saeh-table tr")];
    check(trs.length === 6, "one row per LINE, not per spec", String(trs.length));
    const labels = trs.map((r) => r.querySelector("td.saeh-label").textContent);
    check(labels.join("|") === "CERTIFICATION|||AIRFLOW|SYSTEM INCLUDES|WEIGHT",
      "the label reads once per group, blank on continuation lines", labels.join("|"));
    check(trs[1].classList.contains("saeh-cont") && trs[2].classList.contains("saeh-cont"),
      "continuation lines are marked .saeh-cont");
    check(!trs[0].classList.contains("saeh-cont"), "a group's first line is not");
    check(trs[4].classList.contains("saeh-sub"), "a label with no value is a .saeh-sub heading");
    check(trs[4].querySelectorAll("td")[1].textContent === "", "and its value cell is empty");
    // Striping must follow the GROUP, or a 3-line spec reads as 3 unrelated
    // ones. Groups here: CERTIFICATION(0) AIRFLOW(1) SYSTEM INCLUDES(2) WEIGHT(3).
    const alt = trs.map((r) => (r.classList.contains("saeh-alt") ? "1" : "0")).join("");
    check(alt === "000101", "stripes follow the group, not the row index", alt);
    const css = d.getElementById("saeh-styles").textContent;
    check(/tr\.saeh-alt\{background:#fafafa\}/.test(css), "striping is class-driven");
    check(!/tr:nth-child\(even\)/.test(css), "the row-parity stripe rule is gone");
  }
  {
    // Fail-soft: a leading blank label has nothing to continue. Showing it as
    // its own row beats dropping content on a page nobody is watching.
    const { d } = await boot({
      payload: { ...FULL, specs: [{ label: "", value: "orphaned" }, { label: "A", value: "b" }] },
      props: { section: "specs", slug: "x" },
    });
    const cells = [...d.querySelectorAll(".saeh-table tr")].map((r) =>
      [...r.querySelectorAll("td")].map((c) => c.textContent).join("="));
    check(cells.join(" | ") === "=orphaned | A=b", "a leading blank label still renders", cells.join(" | "));
  }
  {
    const { d } = await boot({ payload: { ...FULL, specs: [] }, props: { section: "specs", slug: "x" } });
    check(d.querySelectorAll(".saeh-table").length === 0, "no specs ⇒ no table");
    check(d.getElementById("host").style.display === "none", "and the mount collapses");
  }

  console.log("\n=== compatible products carousel ===");
  {
    const { d } = await boot({ props: { section: "compatible", slug: "x" } });
    check(!!d.querySelector(".saeh-cp-track"), "renders a track");
    const h = d.querySelector(".saeh-cp-h");
    check(h && h.tagName === "H3", "heading is an h3", h?.tagName);
    check(h && h.textContent === "Compatible Products & Accessories", "sentence case, not shouted", h?.textContent);
    check(d.querySelector(".saeh-cp-sec") !== null, "section carries its own vertical padding class");
    check(d.querySelector(".saeh-root").classList.contains("saeh-wide"),
      "opts out of the 920px cap so four cards fill the container");
    const cards = [...d.querySelectorAll(".saeh-cp-card")];
    check(cards.length === 3, "one card per item", String(cards.length));
    check(cards.every((c) => c.tagName === "A"), "the whole card is the link");
    check(cards[0].getAttribute("href") === "/product/trolley-for-ex-heater", "links to /product/<slug>",
      cards[0].getAttribute("href"));
    // ⚠️ The SAME card as the listing grid, by construction rather than by two
    // designs being kept in step.
    check(cards.every((c) => c.classList.contains("saeh-pl-card")),
      "carousel cards ARE listing cards, plus the carousel's own sizing class");
    const names = cards.map((c) => c.querySelector(".saeh-pl-name").textContent);
    check(names.join("|") === "Trolley for EX Heater|Duct Couplers|Manway Adaptor", "names in order", names.join("|"));
    check(cards.every((c) => c.querySelector(".saeh-pl-name").tagName === "H4"), "titles are h4, as in the grid");
    check(cards.every((c) => !!c.querySelector(".saeh-pl-btn")), "every card has a View Product button");
    // Pinned because the casing lives in the STRING: nothing in CSS uppercases
    // it, so nothing else would catch a drift back to shouting. The rest of
    // the widget's display type IS uppercase, which is what makes this easy to
    // "correct" by accident.
    check(
      cards[0].querySelector(".saeh-pl-btn").textContent === "View Product",
      "and its label is sentence case",
      cards[0].querySelector(".saeh-pl-btn").textContent,
    );
    check(cards[0].querySelector(".saeh-pl-btn svg") !== null,
      "…with the same inline double chevron the grid uses");
    // The compatible payload carries neither, and the shared renderer must
    // omit the section rather than leave an empty one.
    check(cards[0].querySelector(".saeh-pl-chips") === null, "no chips — the payload has no categories");
    check(cards[0].querySelector(".saeh-pl-certs") === null, "no cert line — the payload has no certs");
    // An item with no mirrored thumbnail must still render a card, not a
    // broken <img> — 96/96 have one today but a new product will not until
    // its first sync.
    check(cards[2].querySelector(".saeh-pl-shot img") === null,
      "an item with no imageUrl renders no <img>");
    check(cards[0].querySelector(".saeh-pl-shot img").getAttribute("loading") === "lazy",
      "thumbnails are lazy — a carousel is mostly off-screen");
    const navs = [...d.querySelectorAll(".saeh-cp-nav")];
    check(navs.length === 2, "prev and next exist");
    check(navs.every((n) => n.getAttribute("aria-label")), "arrows are labelled for screen readers");
    // jsdom reports zero layout, so the overflow measurement finds none and
    // the arrows hide. That IS the contract: arrows appear only when the track
    // actually overflows, never from the item count.
    check(d.querySelector(".saeh-cp").getAttribute("data-count") === "3",
      "the card count is published for the CSS rules", d.querySelector(".saeh-cp").getAttribute("data-count"));
    check(/max-width:560px\)\{[^}]*\.saeh-cp\{flex-wrap:wrap/.test(
      d.getElementById("saeh-styles").textContent), "on mobile the row wraps");
    check(/\.saeh-cp-track\{order:1;flex:0 0 100%\}/.test(
      d.getElementById("saeh-styles").textContent),
      "mobile: track takes the full width and the arrows wrap below it");
    const css = d.getElementById("saeh-styles").textContent;
    check(/\.saeh-cp-sec\{padding:12% 0\}/.test(css), "12% vertical padding on mobile");
    check(/min-width:561px\)\{\.saeh-cp-sec\{padding:9% 0\}/.test(css), "9% on tablet");
    check(/min-width:881px\)\{\.saeh-cp-sec\{padding:5% 0\}/.test(css), "5% on desktop");
    check(/\.saeh-cp\{display:flex/.test(css), "arrows and track are a flex row, so arrows cannot overlap a card");
    check(/justify-content:safe center/.test(css), "cards centre when they fit, start when they overflow");
    check(/\.saeh-cp-nav:hover:not\(\[disabled\]\)\{background:#fed217/.test(css), "arrows go yellow on hover");
    check(/\.saeh-cp-nav\[disabled\]\{border-color:#d8d8d8/.test(css), "arrows grey out at either end");
    /*
     * Arrow visibility is CSS keyed on data-count, so it can be asserted
     * exactly — the old measurement could only be asserted as "hidden in a
     * zero-layout DOM", which is precisely the case that kept passing while
     * the live page showed arrows next to two cards.
     */
    const hides = (media) => {
      const m = css.match(new RegExp(media.replace(/[.()\-]/g, (c) => "\\" + c) + "\\{(.*?)\\}\\}"));
      return m ? m[1] : "";
    };
    check(/@media\(max-width:560px\)\{\.saeh-cp\[data-count='1'\] \.saeh-cp-nav\{display:none\}\}/.test(css),
      "mobile (1-up): arrows hidden for 1 card only");
    const tablet = hides("@media(min-width:561px) and (max-width:880px)");
    check(["1", "2", "3"].every((n) => tablet.includes(`data-count='${n}'`)) && !tablet.includes("data-count='4'"),
      "tablet (3-up): hidden for 1-3 cards, shown from 4");
    const desktop = css.slice(css.indexOf("@media(min-width:881px){.saeh-cp[data-count"));
    check(["1", "2", "3", "4"].every((n) => desktop.includes(`data-count='${n}'`)) && !desktop.includes("data-count='5'"),
      "desktop (4-up): hidden for 1-4 cards, shown from 5");
    check(/\.saeh-cp-card\{flex:0 0 100%/.test(css), "1-up full width on mobile");
    check(/min-width:561px\)\{\.saeh-cp-card\{flex-basis:calc\(\(100% - 32px\) \/ 3\)/.test(css), "3-up on tablet");
    check(/min-width:881px\)\{\.saeh-cp-card\{flex-basis:calc\(\(100% - 48px\) \/ 4\)/.test(css), "4-up on desktop");
    check(/\.saeh-cp-card\{flex:0 0 /.test(css), "cards never grow or shrink — they keep their width when a row is short");
    // The three breakpoints, in one place, so a future change to one of them
    // has to acknowledge the set.
    const widths = [...css.matchAll(/\.saeh-cp-card\{flex(?:-basis)?:(?:0 0 )?([^;}]+)/g)].map((m) => m[1]);
    check(widths.length === 3, "exactly three card widths are declared", widths.join(" | "));
  }
  {
    const { d } = await boot({ payload: { ...FULL, compatible: [] }, props: { section: "compatible", slug: "x" } });
    check(d.querySelectorAll(".saeh-cp-track").length === 0, "no items ⇒ no carousel");
    check(d.getElementById("host").style.display === "none", "and the mount collapses");
  }

  console.log("\n=== the dashboard preview's copy of the cube glyph ===");
  {
    // Widgets.tsx hand-maintains a duplicate of this markup so /widgets is a
    // byte-accurate preview. The CSS copy silently drifted twice before
    // widget:sync-css existed; the SVG has no generator, so pin it here.
    const tsx = readFileSync(path.join(HERE, "../../frontend/src/pages/Widgets.tsx"), "utf8");
    const inWidget = SRC.match(/var CUBE_ICON_PATH =\s*\n\s*"(.*?)";/s)?.[1];
    const inPreview = tsx.match(/<path d="(M12 2\.75.*?)" \/>/s)?.[1];
    check(!!inWidget && !!inPreview, "found the path in both files");
    check(inWidget === inPreview, "widget.js and Widgets.tsx render the SAME cube path",
      inWidget === inPreview ? `${inWidget.length} chars` : "DRIFTED");
  }

  console.log("\n=== typography: Barlow headings, Inter 16 body ===");
  {
    const { w } = await boot({ props: { section: "tabs", slug: "x" } });
    const css = w.document.getElementById("saeh-styles").textContent;
    check(/--saeh-head:'Barlow'/.test(css) && /--saeh-body:'Inter'/.test(css), "both families are declared");
    check(/\.saeh-root\{font-family:var\(--saeh-body\);font-size:16px/.test(css), "body is Inter 16px");
    for (const sel of [".saeh-h", ".saeh-tab-h", ".saeh-3d-cta-title", ".saeh-btn"]) {
      const r = css.match(new RegExp(sel.replace(".", "\\.") + "\\{[^}]*\\}"))[0];
      check(/font-family:var\(--saeh-head\)/.test(r), `${sel} uses the heading family`);
    }
    const rule = (sel) =>
      css.match(new RegExp(sel.replace(/[.\s]/g, (c) => (c === "." ? "\\." : "\\s")) + "\\{[^}]*\\}"))[0];
    // Accordion content: 15px in #878787. The spec table's left column is the
    // one exception and must stay near-black.
    for (const sel of [".saeh-prose", ".saeh-table", ".saeh-list li"]) {
      const r = rule(sel);
      check(/font-size:15px/.test(r), `${sel} is 15px`, r.match(/font-size:[^;}]*/)?.[0]);
      check(/color:#878787/.test(r), `${sel} is #878787`, r.match(/color:[^;}]*/)?.[0]);
    }
    check(/color:#111/.test(rule(".saeh-table td.saeh-label")), "the spec label column stays black",
      rule(".saeh-table td.saeh-label").match(/color:[^;}]*/)?.[0]);
    // The downloads section and its lead form are NOT accordion content and
    // keep the 16px body size.
    for (const sel of [".saeh-dl-title", ".saeh-in", ".saeh-msg"]) {
      check(/font-size:16px/.test(rule(sel)), `${sel} keeps 16px`, rule(sel).match(/font-size:[^;}]*/)?.[0]);
    }
    // The modal is appended to <body>, outside .saeh-root, so it inherits none
    // of the custom properties unless they are declared on it directly.
    check(/\.saeh-root,\.saeh-3d-overlay\{--saeh-head/.test(css),
      "the 3D modal declares the families too (it lives outside .saeh-root)");
  }

  console.log("\n=== switching tabs ===");
  {
    const { d } = await boot({ props: { section: "tabs", slug: "x" } });
    const hs = [...d.querySelectorAll(".saeh-tab-h")];
    hs[2].click();
    check(hs[2].getAttribute("aria-expanded") === "true", "clicked tab opens");
    check(hs[0].getAttribute("aria-expanded") === "false", "previous tab closes");
    check(openPanels(d).length === 1, "still exactly one panel open");
    check(openPanels(d)[0].getAttribute("aria-labelledby") === hs[2].id, "the open panel is the right one");
  }

  console.log("\n=== accessibility wiring ===");
  {
    const { d } = await boot({ props: { section: "tabs", slug: "x" } });
    const h = d.querySelector(".saeh-tab-h");
    const p = d.getElementById(h.getAttribute("aria-controls"));
    check(h.tagName === "BUTTON" && h.type === "button", "headers are type=button (won't submit a Duda form)");
    check(!!p, "aria-controls points at a real panel");
    check(p.getAttribute("aria-labelledby") === h.id, "panel is labelled by its header");
    const ids = [...d.querySelectorAll(".saeh-tab-p")].map((x) => x.id);
    check(new Set(ids).size === ids.length && ids.every(Boolean), "panel ids are unique");
  }

  console.log("\n=== product identity: Duda's API is preferred over the URL ===");
  {
    const { fetchedUrl } = await boot({
      props: { section: "tabs" },
      dmPageData: { identifier: "01M1XRCFGGHYEJ0QGGXCJ3582N", seo_url: "trolley-for-ex-heater" },
    });
    check(/dudaId=01M1XRCFGGHYEJ0QGGXCJ3582N/.test(fetchedUrl), "uses dudaId from pageData()", fetchedUrl?.split("?")[1]);
  }
  {
    const { fetchedUrl } = await boot({ props: { section: "tabs" }, dmPageData: null });
    check(/slug=ex-heater/.test(fetchedUrl), "falls back to the URL slug when not a dynamic page", fetchedUrl?.split("?")[1]);
  }
  {
    const { fetchedUrl } = await boot({ props: { section: "tabs", dudaId: "EXPLICIT" }, dmPageData: { identifier: "IGNORED" } });
    check(/dudaId=EXPLICIT/.test(fetchedUrl), "an explicit prop wins over pageData()");
  }
  {
    // A pageData() that never settles must NOT strand the widget forever.
    // Unguarded, this renders nothing at all and looks exactly like "no
    // content for this product" — silent, and with no console trace.
    const { fetchedUrl, w, d } = await boot({ props: { section: "tabs" }, dmHangs: true, settleMs: 1800 });
    check(/slug=ex-heater/.test(fetchedUrl), "a hanging pageData() times out to the URL slug", fetchedUrl?.split("?")[1]);
    check(w.__saequipHub.pageDataTimedOut === true, "the timeout is recorded for diagnosis");
    check(w.__saequipHub.lastInit.refFrom === "url", "lastInit.refFrom reports the fallback", w.__saequipHub.lastInit.refFrom);
    check(d.querySelectorAll(".saeh-tab-h").length === 4, "and it still renders all four tabs");
  }

  console.log("\n=== editor mode keeps the placeholder ===");
  {
    const dom = new JSDOM('<!doctype html><html><body><div id="host">PLACEHOLDER</div></body></html>',
      { url: "https://my.duda.co/site/8a8f03b5/product", runScripts: "dangerously", pretendToBeVisual: true });
    const w = dom.window;
    w.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    const t = w.document.createElement("script"); t.src = "https://x/public/widget.js"; w.document.body.appendChild(t);
    const r = w.document.createElement("script"); r.textContent = SRC; w.document.body.appendChild(r);
    await new Promise((res) => setTimeout(res, 20));
    const host = w.document.getElementById("host");
    w.SAEquipHubWidget.init({ container: host, props: { section: "tabs", slug: "x", inEditor: true } });
    await new Promise((res) => setTimeout(res, 40));
    check(host.style.display !== "none", "container NOT collapsed in the editor");
    check(host.textContent.indexOf("PLACEHOLDER") !== -1, "placeholder content left intact");
  }

  console.log("\n=== clean() and legacy DOM mounts ===");
  {
    const { w, d } = await boot({ props: { section: "tabs", slug: "x" } });
    w.SAEquipHubWidget.clean({ container: d.getElementById("host") });
    check(d.getElementById("host").innerHTML === "", "clean() empties the container");
    check(!!d.getElementById("saeh-styles"), "but leaves the shared stylesheet for sibling widgets");
  }
  {
    const { d } = await boot({ body: '<div class="saequip-hub" data-section="benefits"></div>', viaInit: false });
    check(!!d.querySelector(".saeh-check li"), "legacy HTML/Embed mounts still render");
  }
  {
    const { d } = await boot({ body: '<div class="saequip-hub" data-section="all"></div>', viaInit: false });
    check(d.querySelectorAll(".saeh-tabs").length === 0, '"all" excludes tabs, so nothing is duplicated');
    check(!!d.querySelector(".saeh-table") && !!d.querySelector(".saeh-check"), 'but "all" still renders the flat sections');
  }


  console.log("\n=== init() tolerates every plausible renderExternalApp shape ===");
  {
    const shapes = [
      ["documented  {container, props}", (w, host) => w.SAEquipHubWidget.init({ container: host, props: { section: "benefits", slug: "x" } })],
      ["{element, props}             ", (w, host) => w.SAEquipHubWidget.init({ element: host, props: { section: "benefits", slug: "x" } })],
      ["positional (el, props)      ", (w, host) => w.SAEquipHubWidget.init(host, { section: "benefits", slug: "x" })],
      ["props spread at top level   ", (w, host) => w.SAEquipHubWidget.init({ container: host, section: "benefits", slug: "x" })],
    ];
    for (const [label, call] of shapes) {
      const { w, d } = await boot({ viaInit: false });
      call(w, d.getElementById("host"));
      await new Promise((r) => setTimeout(r, 40));
      check(!!d.querySelector(".saeh-check li"), label);
    }
  }

  console.log("\n=== lastInit records what Duda passed (console diagnostics) ===");
  {
    const { w, d } = await boot({ viaInit: false });
    w.SAEquipHubWidget.init({ container: d.getElementById("host"), props: { section: "benefits", slug: "x" } });
    await new Promise((r) => setTimeout(r, 30));
    const li = w.__saequipHub.lastInit;
    check(li && li.resolvedSection === "benefits", "records the section it resolved", String(li && li.resolvedSection));
    check(li && li.gotContainer === true, "records whether it got a container");
    check(typeof w.SAEquipHubWidget.version === "string", "exposes a version marker", w.SAEquipHubWidget.version);
  }

  console.log("\n=== The 3D viewer's third-party script is pinned and integrity-checked ===");
  {
    const ver = SRC.match(/model-viewer@([\d.]+)\//);
    check(!!ver, "model-viewer is pinned to an exact version", ver && ver[1]);
    check(/MODEL_VIEWER_SRI = "sha384-[A-Za-z0-9+/=]{64}"/.test(SRC), "an sha384 integrity hash is declared");
    check(/s\.integrity = MODEL_VIEWER_SRI;/.test(SRC) && /s\.crossOrigin = "anonymous";/.test(SRC),
      "the loader sets integrity + crossorigin on the script tag");
  }

  console.log("\n=== Overview HTML is rebuilt from an allowlist (XSS) ===");
  {
    // The description is staff-authored and stored as written, and the public
    // endpoint cannot sanitise it (sanitize-html crashes the function on
    // Vercel) — so the widget is the boundary. Each vector must arrive inert.
    const EVIL =
      '<p>Safe <strong>bold</strong> and <a href="/product/ex-heater">a link</a>.</p>' +
      '<script>window.__pwned = "script"</script>' +
      '<img src="x" onerror="window.__pwned = \'img\'">' +
      '<p onclick="window.__pwned = \'click\'" style="color:red" class="x">Handler para</p>' +
      '<a href="javascript:window.__pwned=\'js\'">js link</a>' +
      '<a href="JaVa\tScRiPt:window.__pwned=\'tab\'">tab link</a>' +
      '<a href="data:text/html,<script>alert(1)</script>">data link</a>' +
      '<a href="https://example.com/x" target="_blank">external</a>' +
      '<iframe src="https://evil.example"></iframe>' +
      '<svg><script>window.__pwned = "svg"</script></svg>' +
      '<div><span>Wrapped text survives</span></div>' +
      '<style>body{display:none}</style>' +
      '<ul><li>Item</li></ul><h3>Heading</h3><hr>';
    const { w, d } = await boot({ payload: { ...FULL, descriptionHtml: EVIL }, props: { section: "tabs" } });
    await new Promise((r) => setTimeout(r, 60));
    const prose = d.querySelector(".saeh-prose");
    check(!!prose, "Overview still renders");
    check(w.__pwned === undefined, "no vector executed", String(w.__pwned));
    check(!prose.querySelector("script,img,iframe,svg,style"), "script/img/iframe/svg/style are gone");
    check(![...prose.querySelectorAll("*")].some((e) => [...e.attributes].some((a) => /^on|^style$|^class$/i.test(a.name))),
      "no event-handler, style or class attributes survive");
    const hrefs = [...prose.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    check(hrefs.every((h) => h === null || /^(\/|https:)/.test(h)), "only relative and https hrefs survive", JSON.stringify(hrefs));
    check(hrefs.includes("/product/ex-heater") && hrefs.includes("https://example.com/x"), "real links are kept", JSON.stringify(hrefs));
    const ext = [...prose.querySelectorAll("a")].find((a) => a.getAttribute("href") === "https://example.com/x");
    check(ext && ext.getAttribute("rel") === "noopener noreferrer", "target=_blank gets rel=noopener", ext && ext.getAttribute("rel"));
    check(!!prose.querySelector("p strong") && !!prose.querySelector("ul li") && !!prose.querySelector("h3") && !!prose.querySelector("hr"),
      "allowed formatting is kept");
    check(/Wrapped text survives/.test(prose.textContent) && !prose.querySelector("div,span"), "unknown wrappers are unwrapped, text kept");
    check(/js link/.test(prose.textContent) && /Handler para/.test(prose.textContent), "text of refused links/handlers is kept");
  }

  console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });

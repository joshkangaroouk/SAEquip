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
  specs: [{ label: "Power", value: "18kW" }, { label: "Airflow", value: "2560m3/hr" }],
  benefits: ["IP65 Rated", "ATEX certified"],
  applications: ["Oil refineries"],
  downloads: [], model3dUrl: null,
};

/** Boot the widget, optionally providing a fake dmAPI, then call init(). */
async function boot({ payload = FULL, props = {}, dmPageData = undefined, viaInit = true, body = "", dmHangs = false, settleMs = 40, amdLoader = false } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${body}<div id="host"></div></body></html>`, {
    url: "https://saequip.multiscreensite.com/product/ex-heater",
    runScripts: "dangerously", pretendToBeVisual: true,
  });
  const w = dom.window;
  let fetchedUrl = null;
  w.fetch = (u) => {
    fetchedUrl = String(u);
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
const openPanels = (d) => [...d.querySelectorAll(".saeh-tab-p")].filter((p) => !p.hidden);

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
    check(d.querySelectorAll(".saeh-tab-p")[1].querySelector("table.saeh-table") !== null, "Specs uses .saeh-table");
    check(d.querySelectorAll(".saeh-tab-p")[2].querySelector("ul.saeh-check") !== null, "Benefits uses .saeh-check (tick design)");
    check(d.querySelectorAll(".saeh-tab-p")[3].querySelector("ul.saeh-check") !== null,
      "Applications uses .saeh-check too — one list design, no per-path drift");
    check(d.querySelector("ul.saeh-apps") === null, "the dot-bullet variant is gone entirely");
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

  console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });

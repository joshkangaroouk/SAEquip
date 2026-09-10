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
    check(cube.getAttribute("stroke-width") === "2", "stroke-width 2, as the asset specifies");
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

  console.log("\n=== the dashboard preview's copy of the cube glyph ===");
  {
    // Widgets.tsx hand-maintains a duplicate of this markup so /widgets is a
    // byte-accurate preview. The CSS copy silently drifted twice before
    // widget:sync-css existed; the SVG has no generator, so pin it here.
    const tsx = readFileSync(path.join(HERE, "../../frontend/src/pages/Widgets.tsx"), "utf8");
    const inWidget = SRC.match(/var CUBE_ICON_PATH =\s*\n\s*"(.*?)";/s)?.[1];
    const inPreview = tsx.match(/<path d="(M4 7\.5.*?)" \/>/s)?.[1];
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
    // Per-selector rather than a blanket "no 18px anywhere": .saeh-prose h4-h6
    // is legitimately 18px, being a heading.
    for (const sel of [".saeh-prose", ".saeh-table", ".saeh-list li", ".saeh-dl-title", ".saeh-in", ".saeh-msg"]) {
      const r = css.match(new RegExp(sel.replace(/[.\s]/g, (c) => (c === "." ? "\\." : "\\s")) + "\\{[^}]*\\}"))[0];
      check(/font-size:16px/.test(r), `${sel} is 16px`, r.match(/font-size:[^;}]*/)?.[0]);
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

  console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });

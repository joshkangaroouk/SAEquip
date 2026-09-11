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
async function boot({ payload = FULL, props = {}, dmPageData = undefined, viaInit = true, body = "", dmHangs = false, settleMs = 40, amdLoader = false, tabsLayout = undefined } = {}) {
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
    check(/\.saeh-cp-name\{[^}]*text-transform:none/.test(css),
      "compatible cards show the product name as stored, not uppercased");
    check(!/\.saeh-cp-name\{[^}]*text-transform:uppercase/.test(css),
      "…and nothing re-shouts it");
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
    const names = cards.map((c) => c.querySelector(".saeh-cp-name").textContent);
    check(names.join("|") === "Trolley for EX Heater|Duct Couplers|Manway Adaptor", "names in order", names.join("|"));
    check(cards.every((c) => !!c.querySelector(".saeh-cp-btn")), "every card has a View Product button");
    // An item with no mirrored thumbnail must still render a card, not a
    // broken <img> — 96/96 have one today but a new product will not until
    // its first sync.
    check(cards[2].querySelector("img.saeh-cp-shot img, .saeh-cp-shot img") === null,
      "an item with no imageUrl renders no <img>");
    check(cards[0].querySelector(".saeh-cp-shot img").getAttribute("loading") === "lazy",
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

  console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} passed, ${fail} failed\n`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });

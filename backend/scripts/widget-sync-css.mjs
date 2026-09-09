/**
 * Regenerate the WIDGET_CSS constant in frontend/src/pages/Widgets.tsx from
 * the live widget, so the dashboard previews really are byte-accurate.
 *
 *   npm run widget:sync-css --workspace=backend
 *
 * That constant is a copy of the widget's own stylesheet, and its comment
 * claims to be verbatim. It had already drifted twice — carrying the old 18px
 * logo gap, the max-height/max-width logo sizing, the 22px section margins and
 * the U+2713 glyph tick after each of those changed, while also missing whole
 * rules. Transcribing by hand is what caused that, so this extracts the CSS
 * the browser actually receives instead of anyone retyping it.
 *
 * Run it after ANY change to injectStyles() in widget.js.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WIDGET = path.join(HERE, "../src/public-widget/widget.js");
const TARGET = path.join(HERE, "../../frontend/src/pages/Widgets.tsx");

// Boot the widget so injectStyles() runs, then read the <style> it produced.
const dom = new JSDOM(
  '<!doctype html><html><body><div class="saequip-hub" data-section="benefits"></div></body></html>',
  { url: "https://saequip.multiscreensite.com/product/x", runScripts: "dangerously" },
);
const w = dom.window;
w.fetch = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        name: "x", sku: "x", slug: "x", logos: { sa: [], cert: [] }, specs: [],
        benefits: ["x"], applications: [], downloads: [], model3dUrl: null,
      }),
  });
const tag = w.document.createElement("script");
tag.src = "https://x/public/widget.js";
w.document.body.appendChild(tag);
const run = w.document.createElement("script");
run.textContent = readFileSync(WIDGET, "utf8");
w.document.body.appendChild(run);
await new Promise((r) => setTimeout(r, 60));

const css = w.document.getElementById("saeh-styles")?.textContent;
if (!css) {
  console.error("✗ no injected stylesheet found — did the widget fail to boot?");
  process.exit(1);
}

// One rule per line, so a future diff is readable.
const pretty = css.replace(/\}(?!$)/g, "}\n").trim();

const src = readFileSync(TARGET, "utf8");
const start = src.indexOf("const WIDGET_CSS = `");
const end = src.indexOf("`;", start);
if (start === -1 || end === -1) {
  console.error("✗ could not locate the WIDGET_CSS template literal in", TARGET);
  process.exit(1);
}

// Escape only what a template literal cannot hold verbatim.
const escaped = pretty.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const next = src.slice(0, start) + "const WIDGET_CSS = `\n" + escaped + "\n" + src.slice(end);

if (next === src) {
  console.log("✓ already in sync — nothing to change\n");
} else {
  writeFileSync(TARGET, next);
  console.log(`✓ regenerated WIDGET_CSS (${pretty.split("\n").length} rules)\n`);
}

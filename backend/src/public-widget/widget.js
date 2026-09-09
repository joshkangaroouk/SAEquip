/*
 * SAEquip Product Hub — embeddable public widget (vanilla JS, no framework).
 *
 * ONE full embed (backward compatible):
 *   <div id="saequip-product-hub" data-slug="ex-heater"></div>
 *   <script src="https://YOUR-BACKEND/public/widget.js" defer></script>
 *
 * SECTION-SCOPED mounts (place each section independently on the page):
 *   <div class="saequip-hub" data-section="sa-logos"  data-slug="ex-heater"></div>
 *   <div class="saequip-hub" data-section="downloads" data-slug="ex-heater"></div>
 *   <script src="https://YOUR-BACKEND/public/widget.js" defer></script>
 *
 * DUDA WIDGET BUILDER (preferred — this is the only way the content also shows
 * inside Duda's editor, because a plain HTML/Embed element gets no product
 * context there). From the widget's JS:
 *
 *   api.scripts.renderExternalApp(
 *     'https://YOUR-BACKEND/public/widget.js?v=1',
 *     element,
 *     { section: 'tabs', dudaId: <id>, inEditor: data.inEditor },
 *     { amd: false, name: 'SAEquipHubWidget' }
 *   );
 *
 * - Sections: sa-logos | cert-logos | tabs | 3d-viewer | specs | benefits |
 *   applications | downloads | all
 * - "tabs" is the tabbed accordion (Overview / Technical Specs / Key Benefits
 *   / Applications). "all" EXCLUDES it, since the accordion already contains
 *   those sections and rendering both would duplicate every one.
 * - Mount selector (legacy embeds): #saequip-product-hub | .saequip-hub | [data-saequip-hub]
 * - Product identity, in order: props.dudaId/slug/sku -> Duda's
 *   dmAPI.dynamicPageApi().pageData() -> the /product/<slug> URL. The Duda API
 *   is preferred because `identifier` is the stable product id, whereas a slug
 *   changes when SEO is edited and a SKU is neither unique nor always present.
 * - The content API is fetched ONCE per slug (memoized on a window global), even
 *   with many mounts or several copies of this script on the page.
 * - Renders inline into each mount, so the mount auto-sizes to its content
 *   (no iframe / no manual resize needed). Fails quietly; never breaks the host.
 */
(function () {
  "use strict";

  var STYLE_ID = "saeh-styles";
  var RENDERED_ATTR = "data-saeh-rendered";
  var MOUNT_SELECTOR = "#saequip-product-hub, .saequip-hub, [data-saequip-hub]";
  var ALL_SECTIONS = ["cert-logos", "sa-logos", "3d-viewer", "tabs", "specs", "benefits", "applications", "downloads"];
  var VALID = { "sa-logos": 1, "cert-logos": 1, "3d-viewer": 1, "tabs": 1, "specs": 1, "benefits": 1, "applications": 1, "downloads": 1 };
  var MODEL_VIEWER_SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js";

  // Capture the executing script NOW — currentScript is null inside async
  // callbacks and on deferred re-execution.
  var thisScript = document.currentScript;

  function findApiBase() {
    var src = (thisScript && thisScript.src) || "";
    if (!src) {
      var tag = document.querySelector('script[src*="/public/widget.js"]');
      if (tag) src = tag.src || tag.getAttribute("src") || "";
    }
    try {
      return new URL(src, window.location.href).origin;
    } catch (e) {
      return "";
    }
  }

  // Shared, cross-script state — one object per page, so multiple copies of this
  // script (one per Duda embed) share the API base and the memoized fetches.
  var hub = window.__saequipHub || (window.__saequipHub = { api: "", fetches: {} });
  if (!hub.api) hub.api = findApiBase();

  // ---- tiny DOM helpers (textContent only — never inject HTML) ----
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function input(type, placeholder, cls, required) {
    var i = document.createElement("input");
    i.type = type;
    i.className = cls;
    if (placeholder) i.placeholder = placeholder;
    if (required) i.required = true;
    return i;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      // No outer margin. In production each section is its OWN Duda HTML/Embed
      // element, so Duda's element spacing already positions it — a margin here
      // just adds space that can't be tuned from the Duda editor, on every
      // embed. The widget contributes zero vertical space of its own.
      ".saeh-root{font-family:inherit;color:#1a1a1a;max-width:920px;margin:0;line-height:1.5;box-sizing:border-box}",
      ".saeh-root *{box-sizing:border-box}",
      // Sections are flush too, but keep separation BETWEEN them for the
      // legacy full embed (`data-section="all"`), where several sections share
      // one mount and would otherwise butt together. Using the adjacent-sibling
      // selector rather than a blanket margin means the first and last section
      // still contribute no outer space.
      ".saeh-section{margin:0}",
      ".saeh-section + .saeh-section{margin-top:22px}",
      ".saeh-h{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#111;margin:0 0 12px;border-left:4px solid #ffd200;padding-left:10px}",
      // `gap` covers BOTH axes on a wrapping flex container, so one value gives
      // 10px between logos in a row and 10px between wrapped rows.
      ".saeh-logos{display:flex;flex-wrap:wrap;gap:10px;align-items:center}",
      // Fixed height + auto width renders every logo at exactly the same
      // height regardless of aspect ratio.
      //
      // This replaced `max-height:56px;max-width:150px`, which was the cause of
      // logos appearing at different heights: a wide logo hit the 150px width
      // cap before it ever reached 56px tall, so it rendered shorter than a
      // square one. A max-* pair cannot produce a uniform height.
      //
      // `flex:0 0 auto` is load-bearing, not decoration: without
      // `flex-shrink:0` a flex item is allowed to compress below its natural
      // width, and since the height is pinned the image would squash
      // horizontally instead of wrapping to the next line.
      ".saeh-logos img{height:35px;width:auto;flex:0 0 auto;display:block}",
      // --- tabbed accordion ---
      // Mobile-first: the DOM is header,panel,header,panel… so with no layout
      // rules at all it already reads and behaves as an accordion.
      ".saeh-tabs{border:1px solid #ececec;border-radius:10px;overflow:hidden}",
      ".saeh-tab-h{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;margin:0;font-family:inherit;text-align:left;background:#fafafa;border:0;border-top:1px solid #ececec;padding:14px 16px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#111;cursor:pointer}",
      ".saeh-tab-h:first-child{border-top:0}",
      ".saeh-tab-h:hover{background:#f2f2f2}",
      ".saeh-tab-h[aria-expanded='true']{background:#fff}",
      // Chevron drawn from two borders — no glyph, so it can't be reshaped by
      // the host page's font (the same trap the U+2713 tick fell into).
      ".saeh-tab-h:after{content:'';flex:0 0 auto;width:8px;height:8px;border-right:2px solid #111;border-bottom:2px solid #111;transform:rotate(45deg);margin-top:-4px;transition:transform .15s ease}",
      ".saeh-tab-h[aria-expanded='true']:after{transform:rotate(225deg);margin-top:2px}",
      ".saeh-tab-h:focus-visible{outline:2px solid #111;outline-offset:-2px}",
      ".saeh-tab-p{padding:18px 16px;background:#fff;border-top:1px solid #ececec}",
      // Prose inside the Overview panel. Paragraphs are flush to match how
      // Duda renders the description natively (see CLAUDE.md).
      ".saeh-prose{font-size:18px;font-weight:400}",
      ".saeh-prose p{margin:0}",
      ".saeh-prose p + p{margin-top:12px}",
      ".saeh-prose ul,.saeh-prose ol{margin:12px 0;padding-left:22px}",
      ".saeh-prose h4,.saeh-prose h5,.saeh-prose h6{margin:14px 0 6px;font-size:16px;font-weight:700}",
      ".saeh-prose a{color:inherit;text-decoration:underline}",
      ".saeh-prose hr{border:0;border-top:1px solid #ececec;margin:16px 0}",
      ".saeh-prose > *:first-child{margin-top:0}",
      ".saeh-prose > *:last-child{margin-bottom:0}",
      ".saeh-table{width:100%;border-collapse:collapse;font-size:18px;font-weight:400;font-style:normal}",
      ".saeh-table td{padding:9px 12px;border-bottom:1px solid #ececec;vertical-align:top}",
      ".saeh-table tr:nth-child(even){background:#fafafa}",
      ".saeh-table td.saeh-label{font-weight:600;width:40%;color:#333}",
      ".saeh-list{list-style:none;padding:0;margin:0}",
      ".saeh-list li{position:relative;padding:5px 0 5px 26px;font-size:18px;font-weight:400;font-style:normal}",
            // The tick is a real SVG, not the U+2713 glyph it used to be. That
      // character's shape is whatever the host page's font decides, and most
      // render it as a wavy, hand-drawn stroke — which is not something CSS
      // can correct. A data-URI SVG is font-independent and crisp at any size,
      // and keeps this a pure :before with no markup change.
      ".saeh-check li:before{content:'';position:absolute;left:0;top:6px;width:17px;height:17px;border-radius:50%;background:#ffd200 url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E\") center/11px 11px no-repeat}",
      ".saeh-apps li:before{content:'';position:absolute;left:7px;top:12px;width:6px;height:6px;background:#111;border-radius:50%}",
      ".saeh-dl{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ececec}",
      // No divider under the final row. The dashboard's preview copy of this
      // CSS had this rule while the real widget never did, so the live download
      // list carried a trailing border the preview said it should not.
      ".saeh-dl:last-child{border-bottom:0}",
      ".saeh-dl-title{flex:1 1 auto;font-size:18px;font-weight:400;font-style:normal;min-width:140px}",
      // font-family:inherit is required here even though .saeh-root already sets
      // it — browsers never inherit font into <button>/<input> from ancestors by
      // default (a longstanding UA-stylesheet quirk), so every form control in
      // this widget needs it declared explicitly or it falls back to the OS UI font.
      ".saeh-btn{display:inline-block;font-family:inherit;background:#111;color:#fff;border:none;border-radius:5px;padding:9px 18px;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;text-decoration:none;line-height:1.2}",
      ".saeh-btn:hover{background:#333}",
      ".saeh-btn:disabled{opacity:.6;cursor:default}",
      ".saeh-form{flex-basis:100%;display:none;flex-wrap:wrap;gap:8px;margin-top:10px;padding:14px;background:#f7f7f7;border-radius:8px}",
      ".saeh-form.saeh-open{display:flex}",
      ".saeh-in{flex:1 1 180px;font-family:inherit;padding:9px;border:1px solid #ccc;border-radius:5px;font-size:18px;font-weight:400;font-style:normal}",
      ".saeh-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}",
      ".saeh-msg{flex-basis:100%;font-size:18px;font-weight:400;font-style:normal;margin-top:2px}",
      ".saeh-ok{color:#137333}",
      ".saeh-err{color:#c5221f}",
      ".saeh-3d-cta{border:1px solid #ececec;border-radius:10px;padding:32px 20px;text-align:center;background:linear-gradient(180deg,#fafafa,#f4f4f5)}",
      ".saeh-3d-icon{width:32px;height:32px;color:#111;display:block;margin:0 auto 12px}",
      ".saeh-3d-cta-title{font-size:16px;font-weight:700;color:#111;margin:0 0 16px}",
      // Appended straight to <body>, OUTSIDE .saeh-root — an explicit inherit
      // here (rather than relying on the cascade reaching body) is what makes
      // this modal pick up Duda's page font too, not just the in-page sections.
      ".saeh-3d-overlay{position:fixed;inset:0;z-index:999999;background:rgba(17,17,17,.72);display:flex;font-family:inherit}",
      ".saeh-3d-sheet{position:relative;margin:40px;flex:1;min-width:0;background:#fff;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)}",
      ".saeh-3d-close{position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;border-radius:50%;border:none;background:rgba(17,17,17,.06);color:#111;font-family:inherit;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}",
      ".saeh-3d-close:hover{background:rgba(17,17,17,.12)}",
      ".saeh-3d-stage{flex:1;min-height:0;background:#f4f4f5}",
      ".saeh-3d-mv{width:100%;height:100%;display:block;--poster-color:transparent;outline:none}",
      ".saeh-3d-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:14px;border-top:1px solid #ececec;flex-shrink:0}",
      "@media(max-width:520px){.saeh-table td.saeh-label{width:auto}.saeh-dl{align-items:flex-start}.saeh-3d-sheet{margin:16px}}",
      // Wider screens: lift every header into a row above the panels using
      // flex `order`, turning the accordion into tabs WITHOUT duplicating the
      // headers in the DOM. The panel is flex-basis:100% so it always drops to
      // its own line, and its top border doubles as the tab strip's baseline.
      "@media(min-width:721px){" +
        ".saeh-tabs{display:flex;flex-wrap:wrap;border:0;border-radius:0;overflow:visible}" +
        ".saeh-tab-h{order:1;width:auto;flex:0 0 auto;border:0;border-bottom:3px solid transparent;background:none;padding:12px 20px 10px;font-size:13px}" +
        ".saeh-tab-h:hover{background:none;color:#000}" +
        ".saeh-tab-h[aria-expanded='true']{background:none;border-bottom-color:#ffd200}" +
        // The chevron only means something in accordion mode.
        ".saeh-tab-h:after{display:none}" +
        ".saeh-tab-h:first-child{padding-left:0}" +
        ".saeh-tab-p{order:2;flex-basis:100%;padding:22px 0 0;background:none}" +
      "}",
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  function logoSection(title, logos) {
    var sec = el("div", "saeh-section");
    if (title) sec.appendChild(el("div", "saeh-h", title));
    var row = el("div", "saeh-logos");
    logos.forEach(function (l) {
      if (!l || !l.url) return;
      var img = document.createElement("img");
      img.src = l.url;
      img.alt = l.alt || l.label || "";
      img.loading = "lazy";
      row.appendChild(img);
    });
    sec.appendChild(row);
    return sec;
  }

  // The bare table / list, with no section heading. Split out so the tabbed
  // accordion reuses the EXACT same markup and styling as the standalone
  // sections — inside a tab the heading is redundant, since the tab label
  // already says "Technical Specs".
  function specsTable(specs) {
    var table = el("table", "saeh-table");
    var tbody = el("tbody");
    specs.forEach(function (s) {
      var tr = el("tr");
      tr.appendChild(el("td", "saeh-label", s.label));
      tr.appendChild(el("td", null, s.value));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function itemList(items, checklist) {
    var ul = el("ul", "saeh-list " + (checklist ? "saeh-check" : "saeh-apps"));
    items.forEach(function (t) {
      ul.appendChild(el("li", null, t));
    });
    return ul;
  }

  /**
   * The product page's main widget: Overview / Technical Specs / Key Benefits
   * / Applications as a tabbed accordion.
   *
   * ONE set of buttons serves both layouts. The DOM order is
   * header,panel,header,panel… — i.e. accordion-native — and on wider screens
   * CSS flex `order` lifts every header into a row above the panels. That
   * avoids the usual approach of duplicating the headers (a tablist for
   * desktop plus per-panel headers for mobile), which ships the same labels
   * twice to assistive tech and to search engines.
   *
   * ⚠️ Deliberately the DISCLOSURE pattern (`aria-expanded` + `aria-controls`)
   * rather than `role="tab"`/`role="tablist"`. Tab roles carry a promise about
   * keyboard behaviour and layout that would be a lie in accordion mode, and
   * the same element cannot honestly be both. Disclosure is truthful in both.
   *
   * A panel with no content is never built, so its button never exists — an
   * empty tab is impossible rather than merely hidden. If every panel is empty
   * this returns null and the caller collapses the mount entirely.
   */
  function tabsSection(data) {
    var panels = [];

    if (data.descriptionHtml && String(data.descriptionHtml).trim()) {
      panels.push({ id: "overview", label: "Overview", build: function () {
        var body = el("div", "saeh-prose");
        // The ONLY place this widget injects HTML rather than textContent.
        // Safe because /public/products/content sanitises descriptionHtml on
        // the way out through the same allowlist the widget renders, so a
        // <script> typed into the dashboard's raw-HTML description editor
        // cannot arrive here. Do not point this at any other field.
        body.innerHTML = data.descriptionHtml;
        return body;
      } });
    }
    if (data.specs && data.specs.length) {
      panels.push({ id: "specs", label: "Technical Specs", build: function () { return specsTable(data.specs); } });
    }
    if (data.benefits && data.benefits.length) {
      panels.push({ id: "benefits", label: "Key Benefits", build: function () { return itemList(data.benefits, true); } });
    }
    if (data.applications && data.applications.length) {
      panels.push({ id: "applications", label: "Applications", build: function () { return itemList(data.applications, false); } });
    }

    if (!panels.length) return null;

    var sec = el("div", "saeh-section");
    var wrap = el("div", "saeh-tabs");
    // Unique per instance, so several accordions on one page cannot collide on
    // the aria-controls / id pairing.
    var uid = "saeh-t" + Math.random().toString(36).slice(2, 9);
    var headers = [];

    panels.forEach(function (p, i) {
      var panelId = uid + "-" + p.id;

      var h = document.createElement("button");
      h.type = "button"; // never submit a surrounding Duda form
      h.className = "saeh-tab-h";
      h.id = panelId + "-h";
      h.setAttribute("aria-expanded", i === 0 ? "true" : "false");
      h.setAttribute("aria-controls", panelId);
      h.appendChild(el("span", null, p.label));

      var panel = el("div", "saeh-tab-p");
      panel.id = panelId;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", h.id);
      panel.appendChild(p.build());
      if (i !== 0) panel.hidden = true;

      headers.push(h);
      wrap.appendChild(h);
      wrap.appendChild(panel);
    });

    function select(index) {
      panels.forEach(function (_p, i) {
        var open = i === index;
        headers[i].setAttribute("aria-expanded", open ? "true" : "false");
        // `hidden` rather than a class: it keeps the panel out of the
        // accessibility tree and out of in-page find, which display:none via a
        // class would also do but less explicitly.
        wrap.children[i * 2 + 1].hidden = !open;
      });
    }

    headers.forEach(function (h, i) {
      h.addEventListener("click", function () {
        select(i);
      });
      // Arrow keys move between headers. Home/End jump to the ends. Buttons
      // already handle Enter/Space natively.
      h.addEventListener("keydown", function (ev) {
        var k = ev.key;
        var next =
          k === "ArrowRight" || k === "ArrowDown" ? i + 1
          : k === "ArrowLeft" || k === "ArrowUp" ? i - 1
          : k === "Home" ? 0
          : k === "End" ? headers.length - 1
          : -1;
        if (next === -1) return;
        ev.preventDefault();
        var target = headers[(next + headers.length) % headers.length];
        target.focus();
      });
    });

    sec.appendChild(wrap);
    return sec;
  }

  function specsSection(specs) {
    var sec = el("div", "saeh-section");
    sec.appendChild(el("div", "saeh-h", "Technical Specifications"));
    sec.appendChild(specsTable(specs));
    return sec;
  }

  function listSection(title, items, checklist) {
    var sec = el("div", "saeh-section");
    sec.appendChild(el("div", "saeh-h", title));
    sec.appendChild(itemList(items, checklist));
    return sec;
  }

  function validationMessage(body) {
    if (body && body.details && body.details.fieldErrors) {
      var fe = body.details.fieldErrors;
      var parts = [];
      Object.keys(fe).forEach(function (k) {
        if (fe[k] && fe[k].length) parts.push(fe[k][0]);
      });
      if (parts.length) return parts.join(" ");
    }
    return "Please check your details and try again.";
  }

  function leadForm(downloadId) {
    var form = el("form", "saeh-form");
    var name = input("text", "Name", "saeh-in", true);
    var email = input("email", "Email", "saeh-in", true);
    var company = input("text", "Company (optional)", "saeh-in", false);
    var honeypot = input("text", "", "saeh-hp", false);
    honeypot.name = "website";
    honeypot.tabIndex = -1;
    honeypot.setAttribute("autocomplete", "off");
    honeypot.setAttribute("aria-hidden", "true");
    var submit = el("button", "saeh-btn", "Get download");
    submit.type = "submit";
    var msg = el("div", "saeh-msg");

    form.appendChild(name);
    form.appendChild(email);
    form.appendChild(company);
    form.appendChild(honeypot);
    form.appendChild(submit);
    form.appendChild(msg);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "saeh-msg";
      msg.textContent = "";
      var payload = {
        name: name.value.trim(),
        email: email.value.trim(),
        website: honeypot.value,
      };
      if (company.value.trim()) payload.company = company.value.trim();

      submit.disabled = true;
      submit.textContent = "Submitting…";
      fetch(hub.api + "/public/downloads/" + encodeURIComponent(downloadId) + "/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (body) {
              return { status: res.status, body: body };
            });
        })
        .then(function (r) {
          submit.disabled = false;
          submit.textContent = "Get download";
          if (r.status === 429) {
            msg.className = "saeh-msg saeh-err";
            msg.textContent = "Too many requests — please try again shortly.";
            return;
          }
          if (r.status >= 400) {
            msg.className = "saeh-msg saeh-err";
            msg.textContent = validationMessage(r.body);
            return;
          }
          msg.className = "saeh-msg saeh-ok";
          msg.textContent = "Thanks — your download is starting.";
          if (r.body && r.body.fileUrl) {
            window.open(r.body.fileUrl, "_blank", "noopener");
          }
        })
        .catch(function () {
          submit.disabled = false;
          submit.textContent = "Get download";
          msg.className = "saeh-msg saeh-err";
          msg.textContent = "Something went wrong. Please try again.";
        });
    });

    return form;
  }

  function downloadRow(d) {
    var row = el("div", "saeh-dl");
    row.appendChild(el("span", "saeh-dl-title", d.title));
    if (!d.gated && d.fileUrl) {
      var a = el("a", "saeh-btn", "Download");
      a.href = d.fileUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("download", "");
      row.appendChild(a);
    } else {
      var btn = el("button", "saeh-btn", "Download");
      btn.type = "button";
      var form = leadForm(d.id);
      btn.addEventListener("click", function () {
        form.classList.toggle("saeh-open");
      });
      row.appendChild(btn);
      row.appendChild(form);
    }
    return row;
  }

  function downloadsSection(downloads) {
    var sec = el("div", "saeh-section");
    sec.appendChild(el("div", "saeh-h", "Downloads"));
    downloads.forEach(function (d) {
      sec.appendChild(downloadRow(d));
    });
    return sec;
  }

  // Loads the <model-viewer> custom element once, however many 3D sections /
  // script copies end up on the page. Fails quiet — the section just stays empty.
  function loadModelViewer(cb) {
    if (window.customElements && customElements.get("model-viewer")) {
      cb();
      return;
    }
    if (!hub.mvPromise) {
      hub.mvPromise = new Promise(function (resolve) {
        var s = document.createElement("script");
        s.type = "module";
        s.src = MODEL_VIEWER_SRC;
        s.onload = function () {
          resolve();
        };
        s.onerror = function () {
          resolve();
        };
        (document.head || document.documentElement).appendChild(s);
      });
    }
    hub.mvPromise.then(cb);
  }

  // Small cube/box glyph (same shape as the AR icon convention) — built via
  // createElementNS rather than innerHTML, matching the "textContent only,
  // never inject HTML" rule the rest of this file follows.
  function cubeIcon() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "saeh-3d-icon");
    var p1 = document.createElementNS(NS, "path");
    p1.setAttribute("d", "M12 2.5 21 7v10l-9 4.5L3 17V7z");
    var p2 = document.createElementNS(NS, "path");
    p2.setAttribute("d", "M3 7l9 4.5L21 7M12 11.5V21");
    svg.appendChild(p1);
    svg.appendChild(p2);
    return svg;
  }

  function closeModel3dModal(overlay) {
    if (overlay.__escHandler) document.removeEventListener("keydown", overlay.__escHandler);
    document.documentElement.style.overflow = overlay.__prevOverflow || "";
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  // Builds and opens the full-screen 3D viewer modal. Torn down completely on
  // close (not just hidden) so a re-open always starts clean.
  function openModel3dModal(url) {
    var overlay = el("div", "saeh-3d-overlay");
    var sheet = el("div", "saeh-3d-sheet");
    overlay.appendChild(sheet);

    // Click on the backdrop (outside the sheet) closes; clicks inside the
    // sheet never reach this listener because they never bubble past it.
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModel3dModal(overlay);
    });

    var closeBtn = el("button", "saeh-3d-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close 3D viewer");
    closeBtn.addEventListener("click", function () {
      closeModel3dModal(overlay);
    });
    sheet.appendChild(closeBtn);

    var stage = el("div", "saeh-3d-stage");
    sheet.appendChild(stage);
    var bar = el("div", "saeh-3d-bar");
    sheet.appendChild(bar);

    overlay.__prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden"; // lock background scroll while open

    overlay.__escHandler = function (e) {
      if (e.key === "Escape") closeModel3dModal(overlay);
    };
    document.addEventListener("keydown", overlay.__escHandler);

    document.body.appendChild(overlay);

    loadModelViewer(function () {
      try {
        if (!window.customElements || !customElements.get("model-viewer")) return;
        var mv = document.createElement("model-viewer");
        mv.setAttribute("src", url);
        mv.setAttribute("camera-controls", "");
        mv.setAttribute("auto-rotate", "");
        mv.setAttribute("ar", "");
        mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
        mv.setAttribute("environment-image", "neutral");
        mv.setAttribute("shadow-intensity", "0.9");
        mv.className = "saeh-3d-mv";
        stage.appendChild(mv);

        var spin = el("button", "saeh-btn", "Pause spin");
        spin.type = "button";
        spin.addEventListener("click", function () {
          if (mv.hasAttribute("auto-rotate")) {
            mv.removeAttribute("auto-rotate");
            spin.textContent = "Resume spin";
          } else {
            mv.setAttribute("auto-rotate", "");
            spin.textContent = "Pause spin";
          }
        });
        var reset = el("button", "saeh-btn", "Reset view");
        reset.type = "button";
        reset.addEventListener("click", function () {
          mv.cameraOrbit = "0deg 75deg auto";
          if (typeof mv.jumpCameraToGoal === "function") mv.jumpCameraToGoal();
        });
        bar.appendChild(spin);
        bar.appendChild(reset);
      } catch (e) {
        /* never break the host page */
      }
    });
  }

  // The inline section is now just a CTA — the actual viewer only loads (and
  // model-viewer's JS only downloads) once someone clicks through, so visitors
  // who never open it pay no cost at all.
  function model3dSection(url) {
    var sec = el("div", "saeh-section saeh-3d-cta");
    sec.appendChild(cubeIcon());
    sec.appendChild(el("div", "saeh-3d-cta-title", "View the product in 3D view!"));
    var btn = el("button", "saeh-btn", "View 3D Mode");
    btn.type = "button";
    btn.addEventListener("click", function () {
      openModel3dModal(url);
    });
    sec.appendChild(btn);
    return sec;
  }

  // Build the DOM node for one named section, or null if that section is empty.
  function buildSection(name, data) {
    var logos = data.logos || { sa: [], cert: [] };
    if (name === "cert-logos") return logos.cert && logos.cert.length ? logoSection("", logos.cert) : null;
    if (name === "sa-logos") return logos.sa && logos.sa.length ? logoSection("", logos.sa) : null;
    if (name === "3d-viewer") return data.model3dUrl ? model3dSection(data.model3dUrl) : null;
    if (name === "tabs") return tabsSection(data);
    if (name === "specs") return data.specs && data.specs.length ? specsSection(data.specs) : null;
    if (name === "benefits") return data.benefits && data.benefits.length ? listSection("Key Benefits", data.benefits, true) : null;
    if (name === "applications") return data.applications && data.applications.length ? listSection("Applications", data.applications, true) : null;
    if (name === "downloads") return data.downloads && data.downloads.length ? downloadsSection(data.downloads) : null;
    return null;
  }

  // ---- fetch (memoized once per slug across all mounts + script copies) ----
  /**
   * Fetch a product's content, memoized per identifier across every mount and
   * every copy of this script on the page.
   *
   * `ref` is {key, value} where key is "dudaId" | "slug" | "sku". Keying the
   * cache on both means a page using dudaId and a page using slug can't
   * collide, and it lets the endpoint's three lookup modes all be used.
   */
  function fetchContent(ref) {
    var cacheKey = ref.key + ":" + ref.value;
    if (!hub.fetches[cacheKey]) {
      hub.fetches[cacheKey] = fetch(
        hub.api + "/public/products/content?" + ref.key + "=" + encodeURIComponent(ref.value),
        { credentials: "omit" },
      )
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .catch(function () {
          return null;
        });
    }
    return hub.fetches[cacheKey];
  }

  /**
   * Ask Duda which product this page represents.
   *
   * Strongly preferred over parsing the URL: `identifier` is the Duda product
   * id — the same value stored as HubProduct.dudaProductId — so it is unique
   * and stable, whereas the slug changes whenever someone edits a product's
   * SEO URL and the SKU is neither unique (4 are duplicated) nor always
   * present (3 products have none).
   *
   * It also works INSIDE the Duda editor, which URL parsing cannot: the editor
   * URL is my.duda.co/site/<id>/product, with no product in it. Verified
   * against a live store page — isDynamicPage() is true and pageData() returns
   * the full product, in the editor as well as on the published site.
   *
   * Async, and resolves to null whenever dmAPI is absent (any non-Duda host,
   * or a plain HTML embed), so every caller must have a fallback.
   */
  function dudaPageProduct() {
    try {
      if (typeof dmAPI === "undefined" || !dmAPI || typeof dmAPI.dynamicPageApi !== "function") {
        return Promise.resolve(null);
      }
      var dynPage = dmAPI.dynamicPageApi();
      if (!dynPage || typeof dynPage.isDynamicPage !== "function" || !dynPage.isDynamicPage()) {
        return Promise.resolve(null);
      }
      return Promise.resolve(dynPage.pageData()).then(
        function (pd) {
          return pd || null;
        },
        function () {
          return null;
        },
      );
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /** Turn whatever identifier we have into the {key, value} the API expects. */
  function refFrom(opts) {
    if (opts.dudaId) return { key: "dudaId", value: String(opts.dudaId) };
    if (opts.slug) return { key: "slug", value: String(opts.slug) };
    if (opts.sku) return { key: "sku", value: String(opts.sku) };
    return null;
  }

  function pathSlug() {
    var m = ((window.location && window.location.pathname) || "").match(/\/product\/([^\/?#]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  // First data-slug found on any mount, else the /product/<slug> path.
  function pageSlug(mounts) {
    for (var i = 0; i < mounts.length; i++) {
      var ds = mounts[i].getAttribute("data-slug");
      if (ds && ds.trim()) return ds.trim();
    }
    return pathSlug();
  }

  // "all" deliberately EXCLUDES "tabs": the accordion contains the description,
  // specs, benefits and applications, so rendering both would duplicate every
  // one of them on the page. "all" stays the legacy flat layout; "tabs" is the
  // new grouped one, and they are alternatives rather than additive.
  var ALL_EXCLUDES = { tabs: 1 };

  function sectionsForName(raw) {
    var name = (raw || "").trim().toLowerCase();
    if (!name || name === "all") {
      return ALL_SECTIONS.filter(function (n) { return !ALL_EXCLUDES[n]; });
    }
    return VALID[name] ? [name] : []; // unknown value → render nothing (fail-closed)
  }

  function sectionsFor(mount) {
    return sectionsForName(mount.getAttribute("data-section"));
  }

  /**
   * True when `parent` contains nothing except `node` — no other elements and
   * no non-whitespace text.
   *
   * This is the safety check that makes collapsing upwards acceptable: an
   * ancestor is only ever hidden while our (empty) mount is the sole thing in
   * it, so a container that also holds real page content is never touched.
   */
  function holdsOnly(parent, node) {
    var kids = parent.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === node) continue;
      if (k.nodeType === 1) return false; // another element
      if (k.nodeType === 3 && k.nodeValue && k.nodeValue.trim()) return false; // real text
    }
    return true;
  }

  /**
   * Hide a mount that has nothing to show, and collapse the Duda container
   * holding it.
   *
   * Hiding the mount alone is not enough: Duda's HTML/Embed element is a
   * wrapper with its own padding and min-height, so an empty widget still
   * leaves a visible gap on the product page. Duda gives no way to
   * conditionally hide an element, so the widget removes its own footprint.
   *
   * Walks up at most COLLAPSE_MAX_DEPTH levels and stops the moment an
   * ancestor contains anything besides our mount, so the worst case is a
   * slightly smaller gap rather than missing page content. Set
   * `data-collapse="false"` on a mount to opt out.
   */
  var COLLAPSE_MAX_DEPTH = 4;

  function collapseMount(mount) {
    try {
      if ((mount.getAttribute("data-collapse") || "").toLowerCase() === "false") return;
      mount.style.display = "none";
      var node = mount;
      for (var i = 0; i < COLLAPSE_MAX_DEPTH; i++) {
        var parent = node.parentElement;
        if (!parent || parent === document.body || parent === document.documentElement) break;
        if (!holdsOnly(parent, node)) break;
        parent.style.display = "none";
        node = parent;
      }
    } catch (e) {
      /* never break the host page */
    }
  }

  /**
   * Render `sections` for `ref` into `container`. The single place content is
   * built, shared by the legacy DOM-scanned mounts and by the Widget Builder
   * entry point, so the two can never drift apart.
   *
   * `onEmpty` decides what "nothing to show" means for the caller: the DOM
   * mounts collapse the Duda element, while a Widget Builder widget hands
   * control back so it can leave an editor placeholder in place.
   */
  function renderInto(container, sections, ref, onEmpty) {
    if (!hub.api || !ref || !sections.length) return onEmpty();
    return fetchContent(ref)
      .then(function (data) {
        try {
          if (!data) return onEmpty(); // unknown product / fetch error
          var root = el("div", "saeh-root");
          for (var i = 0; i < sections.length; i++) {
            var node = buildSection(sections[i], data);
            if (node) root.appendChild(node);
          }
          if (!root.childNodes.length) return onEmpty();
          injectStyles();
          container.innerHTML = "";
          container.appendChild(root);
        } catch (e) {
          /* never break the host page */
        }
      })
      .catch(function () {});
  }

  function renderMount(mount, slug) {
    if (mount.getAttribute(RENDERED_ATTR)) return; // idempotency: skip already-processed mounts
    mount.setAttribute(RENDERED_ATTR, "1"); // claim synchronously so re-exec skips it
    renderInto(mount, sectionsFor(mount), refFrom({ slug: slug }), function () {
      // The common case: this product has no content for the requested
      // section, so leave no trace on the page.
      collapseMount(mount);
    });
  }

  function processMounts() {
    var mounts = document.querySelectorAll(MOUNT_SELECTOR);
    if (!mounts.length) return;
    var shared = pageSlug(mounts);
    for (var i = 0; i < mounts.length; i++) {
      var own = (mounts[i].getAttribute("data-slug") || "").trim();
      renderMount(mounts[i], own || shared);
    }
  }

  // ---------------------------------------------------------------------------
  // Entry point A — Duda Widget Builder, via api.scripts.renderExternalApp
  // ---------------------------------------------------------------------------
  /**
   * Called by Duda with the widget's container and props.
   *
   * Product identity is resolved in this order:
   *   1. props.dudaId / props.slug / props.sku, if the widget shim supplied one
   *   2. Duda's own dynamic-page API (works in the EDITOR as well as live)
   *   3. the /product/<slug> URL, as a last resort
   *
   * Empty behaviour differs from the DOM-mount path on purpose. In the editor
   * we leave the container exactly as Duda rendered it, so whatever
   * placeholder is configured stays visible and the element remains
   * selectable and positionable. On the live site an empty widget hides
   * itself, matching the section embeds.
   */
  function init(opts) {
    opts = opts || {};
    var container = opts.container || opts.element;
    var props = opts.props || {};
    if (!container) return;

    try {
      if (props.apiBase) hub.api = String(props.apiBase);
      var sections = sectionsForName(props.section);
      var inEditor = props.inEditor === true || props.inEditor === "true";

      var onEmpty = function () {
        if (inEditor) return; // keep the editor placeholder and the element's box
        collapseMount(container);
      };

      var direct = refFrom(props);
      if (direct) {
        renderInto(container, sections, direct, onEmpty);
        return;
      }

      dudaPageProduct().then(function (pd) {
        var ref =
          refFrom({ dudaId: pd && pd.identifier, slug: pd && pd.seo_url }) ||
          refFrom({ slug: pathSlug() });
        renderInto(container, sections, ref, onEmpty);
      });
    } catch (e) {
      /* never break the host page */
    }
  }

  /**
   * Called by Duda before re-rendering or removing the widget.
   *
   * Only empties the container — the injected <style> and the memoized fetches
   * are page-level and shared by every instance, so tearing them down here
   * would break sibling widgets that are still on the page.
   */
  function clean(opts) {
    try {
      var container = (opts && (opts.container || opts.element)) || null;
      if (container) container.innerHTML = "";
    } catch (e) {
      /* never break the host page */
    }
  }

  // The global renderExternalApp looks up when called with {amd:false,
  // name:"SAEquipHubWidget"}. Assigned unconditionally so a second copy of the
  // script simply refreshes the same interface.
  window.SAEquipHubWidget = { init: init, clean: clean };

  // ---------------------------------------------------------------------------
  // Entry point B — legacy HTML/Embed mounts, scanned from the DOM
  // ---------------------------------------------------------------------------
  // Kept working alongside the Widget Builder path so the live site never
  // depends on the new path until it has been proven on real product pages.
  function bootstrapDomMounts() {
    try {
      processMounts();
    } catch (e) {
      /* never break the host page */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapDomMounts);
  } else {
    bootstrapDomMounts();
  }
})();

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
 * context there). The whole of the widget's JS:
 *
 *   (function (el, section, inEditor) {
 *     // Stamped SYNCHRONOUSLY, before any async work. This is what makes a widget
 *     // immune to another widget's props arriving later — see widget.js init().
 *     el.setAttribute('data-saeh-section', section);
 *
 *     var SRC = 'https://sa-equip-backend.vercel.app/public/widget.js?v=17';
 *     var L = window.__saehLoader || (window.__saehLoader = {});
 *     if (!L.p) L.p = new Promise(function (res, rej) {
 *       var s = document.createElement('script');
 *       s.src = SRC; s.async = true; s.onload = res; s.onerror = rej;
 *       document.head.appendChild(s);
 *     });
 *     L.p.then(function () {
 *       window.SAEquipHubWidget.init({ container: el, props: { section: section, inEditor: inEditor } });
 *     }).catch(function () {});
 *   })(element, 'compatible', data.inEditor);
 *
 * ⚠️ The section is passed as an IIFE PARAMETER and stamped on the element,
 * not held in a `var`. Both matter. A `var` is only private if the IIFE really
 * is there, and every shim's callback runs after every shim has been
 * evaluated — so any shared binding holds the LAST widget's value by then.
 * That is how the compatible widget rendered the 3D viewer's content on the
 * live page while the editor, which initialises widgets one at a time, looked
 * perfectly fine.
 *
 * ⚠️ It calls init() ITSELF rather than going through
 * api.scripts.renderExternalApp. That API was observed, on a live product
 * page, fetching this script and then never calling init() — proven from the
 * console: the ?v= query string showed the shim had run and loaded us,
 * window.SAEquipHubWidget.version read back correctly, a manual
 * init({container, props}) rendered perfectly, yet __saequipHub.lastInit was
 * undefined. Loading a script is four lines and fully deterministic, so it is
 * not worth depending on a loader whose invocation contract we cannot see. The
 * AMD export at the bottom of this file covers renderExternalApp anyway, for
 * anyone who prefers it.
 *
 * The shared promise on window.__saehLoader means the four widgets on a
 * product page fetch this script ONCE between them, not four times.
 *
 * ⚠️ The shim is SYNCHRONOUS on purpose — do not wrap it in an async IIFE that
 * awaits before rendering. An earlier version awaited dmAPI...pageData() to
 * pass a `dudaId` prop; an await that never settles renders nothing at all,
 * with no error anywhere. (Measured since: pageData() actually resolves in
 * ~1ms on the live page, so that was not the outage — but the failure mode is
 * real and there is nothing here worth awaiting.) The product lookup belongs
 * below in dudaPageProduct(), where it is time-boxed and falls back to the
 * URL slug.
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
  var ALL_SECTIONS = ["cert-logos", "sa-logos", "3d-viewer", "tabs", "specs", "benefits", "applications", "downloads", "compatible"];
  var VALID = { "sa-logos": 1, "cert-logos": 1, "3d-viewer": 1, "tabs": 1, "specs": 1, "benefits": 1, "applications": 1, "downloads": 1, "compatible": 1 };
  var MODEL_VIEWER_SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js";

  /**
   * Chevron on the 3D button, hosted in Duda's own media library.
   *
   * ⚠️ The path contains the Duda SITE ID (8a8f03b5), so it dies if the site
   * is ever migrated again — the asset library is per-site. That is survivable
   * rather than fatal: the <img> hides itself on error, leaving a text-only
   * button instead of a broken-image glyph. Keeping it in Duda is deliberate
   * so staff can swap the icon without a deploy.
   */
  var CHEVRON_ICON_SRC = "https://irp.cdn-website.com/8a8f03b5/icon/chevron+right_8187511.svg";

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
      /*
       * TYPOGRAPHY — Barlow for headings, Inter 16px for body.
       *
       * ⚠️ This deliberately REPLACES `font-family:inherit`, which every rule
       * here used to carry so the widget silently adopted whatever font the
       * Duda page used. Inheriting is normally the right instinct for an
       * embedded widget, so it needs a reason to have changed: the sections are
       * now specified to a fixed pair rather than to "whatever the page does".
       *
       * ⚠️ It also makes the widget depend on the HOST page loading these two
       * families — the widget must never inject a third-party stylesheet onto
       * a client's public site. Checked against the live product page: Duda's
       * own font stylesheet already serves Inter (variable, 100..900) and
       * Barlow (100-900), so nothing is needed. But if the site's theme fonts
       * are ever changed in Duda, these families may stop being served and the
       * widget will quietly fall back to the stack below — no error, just a
       * different-looking widget. Re-check the page's font stylesheet after any
       * theme change.
       *
       * Declared on .saeh-3d-overlay too, because that modal is appended to
       * <body> outside .saeh-root and so inherits nothing from it.
       */
      ".saeh-root,.saeh-3d-overlay{--saeh-head:'Barlow','Barlow Fallback',system-ui,sans-serif;--saeh-body:'Inter','Inter Fallback',system-ui,sans-serif}",
      /*
       * Accordion CONTENT is 15px #878787 — prose, spec values and list items.
       * The spec table's LEFT column stays near-black (#111) so the label
       * still leads the eye across the row; it is the only content that does.
       *
       * Set on the shared .saeh-prose/.saeh-table/.saeh-list rules rather than
       * scoped under .saeh-tab-p, even though the request was about the tabs
       * widget: those three designs render ONLY inside the accordion in
       * production (the standalone specs/benefits/applications sections exist
       * but no Duda widget places them), so scoping would create a second
       * visual treatment of the same content with nothing to keep the two in
       * step — the drift that put a dot bullet on Applications for months.
       *
       * ⚠️ #878787 on white is ~3.6:1, under the 4.5:1 WCAG AA needs for body
       * text. A deliberate brand choice, recorded so it is not mistaken for an
       * oversight; #767676 is the darkest grey that clears AA if it is ever
       * revisited.
       */
      // No outer margin. In production each section is its OWN Duda HTML/Embed
      // element, so Duda's element spacing already positions it — a margin here
      // just adds space that can't be tuned from the Duda editor, on every
      // embed. The widget contributes zero vertical space of its own.
      ".saeh-root{font-family:var(--saeh-body);font-size:16px;color:#1a1a1a;max-width:920px;margin:0;line-height:1.5;box-sizing:border-box}",
      ".saeh-root *{box-sizing:border-box}",
      // The tabbed accordion fills its Duda element instead of honouring the
      // 920px cap above. It is the product page's MAIN widget and usually sits
      // in a full-width row, where a cap leaves dead space on the right that
      // cannot be tuned from the Duda editor — whereas the narrow sections
      // (logo rows, spec tables) are placed in columns that already constrain
      // them. Applied via a class set in renderInto() rather than
      // `:has(.saeh-tabs)`, so support doesn't depend on the visitor's browser.
      ".saeh-root.saeh-wide{max-width:none}",
      // Sections are flush too, but keep separation BETWEEN them for the
      // legacy full embed (`data-section="all"`), where several sections share
      // one mount and would otherwise butt together. Using the adjacent-sibling
      // selector rather than a blanket margin means the first and last section
      // still contribute no outer space.
      ".saeh-section{margin:0}",
      ".saeh-section + .saeh-section{margin-top:22px}",
      ".saeh-h{font-family:var(--saeh-head);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#111;margin:0 0 12px;border-left:4px solid #ffd200;padding-left:10px}",
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
      ".saeh-tab-h{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;margin:0;font-family:var(--saeh-head);text-align:left;background:#fafafa;border:0;border-top:1px solid #ececec;padding:14px 16px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#111;cursor:pointer}",
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
      ".saeh-prose{font-size:15px;font-weight:400;color:#878787}",
      ".saeh-prose p{margin:0}",
      ".saeh-prose p + p{margin-top:12px}",
      ".saeh-prose ul,.saeh-prose ol{margin:12px 0;padding-left:22px}",
      ".saeh-prose h4,.saeh-prose h5,.saeh-prose h6{font-family:var(--saeh-head);margin:14px 0 6px;font-size:16px;font-weight:700}",
      ".saeh-prose a{color:inherit;text-decoration:underline}",
      ".saeh-prose hr{border:0;border-top:1px solid #ececec;margin:16px 0}",
      ".saeh-prose > *:first-child{margin-top:0}",
      ".saeh-prose > *:last-child{margin-bottom:0}",
      ".saeh-table{width:100%;border-collapse:collapse;font-size:15px;font-weight:400;font-style:normal;color:#878787}",
      ".saeh-table td{padding:9px 12px;border-bottom:1px solid #ececec;vertical-align:top}",
      // Group striping, set by specsTable() — see the note there on why this
      // is a class and not `tr:nth-child(even)`.
      ".saeh-table tr.saeh-alt{background:#fafafa}",
      ".saeh-table td.saeh-label{font-weight:600;width:40%;color:#111}",
      // Continuation rows need NO border special-casing: the default per-cell
      // bottom border already draws the full-width rule under every line that
      // the printed spec sheets use, and the empty label cell is what makes
      // the label read once per group. Group membership is carried by the
      // stripe instead, which avoids fighting border-collapse's conflict
      // resolution over transparent-vs-solid edges.
      // A sub-heading row ("SYSTEM INCLUDES") — a label with nothing beside
      // it. Given the full width and a touch more weight so it reads as a
      // divider rather than a spec whose value went missing.
      ".saeh-table tr.saeh-sub td.saeh-label{width:auto;color:#111;font-weight:700;letter-spacing:.02em}",
      ".saeh-list{list-style:none;padding:0;margin:0}",
      ".saeh-list li{position:relative;padding:5px 0 5px 26px;font-size:15px;font-weight:400;font-style:normal;color:#878787}",
            // The tick is a real SVG, not the U+2713 glyph it used to be. That
      // character's shape is whatever the host page's font decides, and most
      // render it as a wavy, hand-drawn stroke — which is not something CSS
      // can correct. A data-URI SVG is font-independent and crisp at any size,
      // and keeps this a pure :before with no markup change.
      ".saeh-check li:before{content:'';position:absolute;left:0;top:6px;width:17px;height:17px;border-radius:50%;background:#ffd200 url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E\") center/11px 11px no-repeat}",
      ".saeh-dl{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ececec}",
      // No divider under the final row. The dashboard's preview copy of this
      // CSS had this rule while the real widget never did, so the live download
      // list carried a trailing border the preview said it should not.
      ".saeh-dl:last-child{border-bottom:0}",
      ".saeh-dl-title{flex:1 1 auto;font-size:16px;font-weight:400;font-style:normal;min-width:140px}",
      // An explicit font-family is required here even though .saeh-root already
      // sets one — browsers never inherit font into <button>/<input> from
      // ancestors by default (a longstanding UA-stylesheet quirk), so every
      // form control and button in this widget must declare it or it falls back
      // to the OS UI font. Buttons take the heading family: they are display
      // type, not prose.
      ".saeh-btn{display:inline-block;font-family:var(--saeh-head);background:#111;color:#fff;border:none;border-radius:5px;padding:9px 18px;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;text-decoration:none;line-height:1.2}",
      ".saeh-btn:hover{background:#333}",
      ".saeh-btn:disabled{opacity:.6;cursor:default}",
      ".saeh-form{flex-basis:100%;display:none;flex-wrap:wrap;gap:8px;margin-top:10px;padding:14px;background:#f7f7f7;border-radius:8px}",
      ".saeh-form.saeh-open{display:flex}",
      ".saeh-in{flex:1 1 180px;font-family:var(--saeh-body);padding:9px;border:1px solid #ccc;border-radius:5px;font-size:16px;font-weight:400;font-style:normal}",
      ".saeh-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}",
      ".saeh-msg{flex-basis:100%;font-size:16px;font-weight:400;font-style:normal;margin-top:2px}",
      ".saeh-ok{color:#137333}",
      ".saeh-err{color:#c5221f}",
      /*
       * 3D call-to-action banner — flat and sharp: no border, no radius, no
       * gradient. `flex-wrap` plus a `flex-basis` on the left block is what
       * makes it responsive without a breakpoint: while the headline and the
       * button both fit, they sit on one row with the button pushed right; when
       * they don't, the button wraps beneath. The one media query below only
       * stretches the wrapped button to full width, which flex alone can't do.
       */
      ".saeh-3d-cta{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px 24px;background:#eceef1;padding:24px 26px}",
      ".saeh-3d-cta-main{display:flex;align-items:center;gap:16px;flex:1 1 260px;min-width:0}",
      ".saeh-3d-icon{width:34px;height:34px;color:#111;display:block;flex:0 0 auto}",
      // 20px flat — small enough to need no fluid scaling, so the clamp() that
      // was here for a 30px headline is gone. `overflow-wrap` stays: it stops a
      // long product word forcing sideways scroll on the narrowest screens.
      ".saeh-3d-cta-title{font-family:var(--saeh-head);font-size:20px;font-weight:500;line-height:1.25;color:#111;margin:0;min-width:0;overflow-wrap:break-word}",
      /*
       * Its own class, not a .saeh-btn modifier — .saeh-btn is the black
       * UPPERCASE pill used by downloads and the 3D modal's own controls, and
       * this one shares none of its colour, radius, case or family. min-height
       * keeps it a 44px tap target, which the padding alone doesn't guarantee
       * once the font falls back. inline-flex + gap is what puts the chevron
       * beside the label and keeps the two vertically centred on each other
       * whatever the label wraps to.
       */
      ".saeh-3d-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-family:var(--saeh-body);background:#fed217;color:#000;border:0;border-radius:0;padding:12px 22px;min-height:44px;font-size:16px;font-weight:500;text-transform:none;letter-spacing:normal;line-height:1.25;cursor:pointer}",
      ".saeh-3d-btn-icon{width:20px;height:20px;flex:0 0 auto;display:block}",
      ".saeh-3d-btn:hover{background:#f0c400}",
      ".saeh-3d-btn:focus-visible{outline:2px solid #111;outline-offset:2px}",
      // Appended straight to <body>, OUTSIDE .saeh-root — an explicit inherit
      // here (rather than relying on the cascade reaching body) is what makes
      // this modal pick up Duda's page font too, not just the in-page sections.
      /*
       * COMPATIBLE PRODUCTS carousel.
       *
       * A CSS scroll-snap track, not a JS-positioned slider. The card width is
       * `calc((100% - gaps) / n)` per breakpoint, so the browser owns the
       * layout and a resize needs no recalculation — the arrows only call
       * scrollBy(). That is also what makes the "fewer than a full row" case
       * work for free: with 2 cards at 4-up the track simply has two
       * items at their natural width, left-aligned, no stretching.
       */
      /*
       * The section owns its own vertical rhythm — 3% desktop / 6% tablet /
       * 8% mobile, top and bottom — so Duda's element padding can be set to
       * zero. That matters for more than tidiness: when a product has no
       * compatible items the widget renders nothing and collapses, and any
       * padding living on the Duda section would survive as a visible empty
       * band. Percentages resolve against the container WIDTH, which is what
       * makes the spacing scale with the layout rather than the text.
       */
      ".saeh-cp-sec{padding:8% 0}",
      "@media(min-width:561px){.saeh-cp-sec{padding:6% 0}}",
      "@media(min-width:881px){.saeh-cp-sec{padding:3% 0}}",
      // h3, sentence case, centred. Deliberately NOT .saeh-h — that is the
      // uppercase, left-aligned, yellow-ruled heading the in-page sections
      // use, and this one sits alone in a full-width band.
      ".saeh-cp-h{font-family:var(--saeh-head);font-size:20px;font-weight:600;color:#111;text-align:center;margin:0 0 20px;line-height:1.25}",
      /*
       * A flex ROW — arrow, track, arrow — rather than arrows absolutely
       * positioned over the track. Structurally they cannot overlap a card,
       * and when they are hidden they occupy no space at all, so the track
       * simply widens. Card width is a percentage OF THE TRACK, so showing or
       * hiding an arrow never changes how many cards fit and the measurement
       * cannot oscillate.
       */
      ".saeh-cp{display:flex;align-items:center;gap:14px}",
      ".saeh-cp-track{flex:1;min-width:0;display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:2px}",
      /*
       * `safe center` centres the cards when they fit and falls back to
       * flex-start the moment they overflow. Plain `center` would centre an
       * overflowing track too, which clips the FIRST card out of reach —
       * unscrollable in most browsers. A browser that does not understand
       * `safe` discards the declaration and keeps the default, which is the
       * same behaviour as the fallback.
       */
      ".saeh-cp-track{justify-content:safe center}",
      ".saeh-cp-track::-webkit-scrollbar{display:none}",
      // flex:0 0 <w> — never grow, never shrink. A card keeps its width when
      // there are too few to fill the row, which is the behaviour asked for.
      // Mobile is ONE card, full width — a phone-sized card at 2-up is too
      // small to read the product name or tap the button comfortably, and the
      // arrows moving below the track is what buys the room for it.
      ".saeh-cp-card{flex:0 0 100%;scroll-snap-align:start;display:flex;flex-direction:column;background:#fff;border:1px solid #ececec;text-decoration:none;color:inherit}",
      ".saeh-cp-shot{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden}",
      ".saeh-cp-shot img{max-width:100%;max-height:100%;width:auto;height:auto;display:block}",
      ".saeh-cp-body{padding:14px;display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;flex:1}",
      ".saeh-cp-name{font-family:var(--saeh-head);font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:#111;line-height:1.3}",
      ".saeh-cp-btn{margin-top:auto;font-family:var(--saeh-body);background:#fed217;color:#000;border:0;padding:10px 18px;min-height:40px;font-size:14px;font-weight:500;line-height:1.2;display:inline-flex;align-items:center;gap:8px}",
      ".saeh-cp-btn img{width:16px;height:16px;display:block;flex:0 0 auto}",
      ".saeh-cp-card:hover .saeh-cp-btn{background:#f0c400}",
      // The arrows sit OUTSIDE the track so they never cover a card.
      ".saeh-cp-nav{flex:0 0 auto;width:40px;height:40px;border-radius:50%;border:1px solid #111;background:#fff;color:#111;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .15s ease,border-color .15s ease,color .15s ease}",
      ".saeh-cp-nav:hover:not([disabled]){background:#fed217;border-color:#fed217;color:#000}",
      ".saeh-cp-nav:focus-visible{outline:2px solid #111;outline-offset:2px}",
      // Disabled means "nothing further this way" — greyed rather than
      // removed, so the control does not jump position as you scroll.
      ".saeh-cp-nav[disabled]{border-color:#d8d8d8;color:#bdbdbd;cursor:default}",
      ".saeh-cp-nav svg{width:15px;height:15px}",
      /*
       * MOBILE: arrows move BELOW the track, centred, so a card gets the full
       * width instead of losing ~108px to two buttons and their gaps — on a
       * 375px screen that is nearly a third of the row. The track is the only
       * flex item on its line (flex-basis 100%), so the two buttons wrap
       * beneath it; `order` puts them there despite the DOM order being
       * prev, track, next, which is kept because it is the correct reading
       * order for assistive tech.
       */
      "@media(max-width:560px){" +
        ".saeh-cp{flex-wrap:wrap;justify-content:center;gap:14px 12px}" +
        ".saeh-cp-track{order:1;flex:0 0 100%}" +
        ".saeh-cp-prev{order:2}" +
        ".saeh-cp-next{order:3}" +
      "}",
      "@media(min-width:561px){.saeh-cp-card{flex-basis:calc((100% - 32px) / 3)}}",
      "@media(min-width:881px){.saeh-cp-card{flex-basis:calc((100% - 48px) / 4)}}",
      ".saeh-3d-overlay{position:fixed;inset:0;z-index:999999;background:rgba(17,17,17,.72);display:flex;font-family:var(--saeh-body)}",
      ".saeh-3d-sheet{position:relative;margin:40px;flex:1;min-width:0;background:#fff;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)}",
      ".saeh-3d-close{position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;border-radius:50%;border:none;background:rgba(17,17,17,.06);color:#111;font-family:var(--saeh-head);font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}",
      ".saeh-3d-close:hover{background:rgba(17,17,17,.12)}",
      ".saeh-3d-stage{flex:1;min-height:0;background:#f4f4f5}",
      ".saeh-3d-mv{width:100%;height:100%;display:block;--poster-color:transparent;outline:none}",
      ".saeh-3d-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:14px;border-top:1px solid #ececec;flex-shrink:0}",
      // Narrow screens: a wrapped CTA button spans the full width (a comfortable
      // thumb target) rather than sitting as a small tab under the headline,
      // and the banner's side padding tightens so the headline gets the space.
      "@media(max-width:520px){" +
        ".saeh-table td.saeh-label{width:auto}" +
        ".saeh-dl{align-items:flex-start}" +
        ".saeh-3d-sheet{margin:16px}" +
        ".saeh-3d-cta{padding:20px 18px;gap:16px}" +
        ".saeh-3d-cta-main{flex-basis:100%}" +
        ".saeh-3d-btn{flex:1 1 100%;width:100%}" +
      "}",
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
  /**
   * Fold the flat SpecRow list into labelled groups.
   *
   * A row with a blank label is another LINE of the row above it, which is how
   * the source catalogue encodes specs like PROTECTION's six entries. A row
   * with a label but no value is a sub-heading inside the table.
   *
   * The `!groups.length` arm matters on a live page: a leading blank-label row
   * has nothing to attach to, and starting its own group shows the value
   * anyway. Dropping it would silently delete content, which is the worse
   * failure for a widget nobody is watching.
   */
  function groupSpecs(specs) {
    var groups = [];
    for (var i = 0; i < specs.length; i++) {
      var label = (specs[i].label || "").trim();
      var value = (specs[i].value || "").trim();
      if (label || !groups.length) {
        groups.push({ label: label, lines: value ? [value] : [] });
      } else if (value) {
        groups[groups.length - 1].lines.push(value);
      }
    }
    return groups;
  }

  /**
   * The spec table: one <tr> per LINE, with the label cell filled only on a
   * group's first line — the shape the printed spec sheets use.
   *
   * ⚠️ Striping is applied per GROUP via an explicit class, not by
   * `tr:nth-child(even)`. Row-parity striping predates multi-line specs and
   * turns a six-line group into alternating bands, which reads as six
   * unrelated specs rather than one. Parity has to follow the data, and CSS
   * cannot see where a group starts.
   */
  function specsTable(specs) {
    var table = el("table", "saeh-table");
    var tbody = el("tbody");
    groupSpecs(specs).forEach(function (g, gi) {
      var alt = gi % 2 === 1 ? " saeh-alt" : "";

      // A sub-heading: a label with no lines under it.
      if (!g.lines.length) {
        var hr = el("tr", "saeh-sub" + alt);
        hr.appendChild(el("td", "saeh-label", g.label));
        hr.appendChild(el("td", null, ""));
        tbody.appendChild(hr);
        return;
      }

      g.lines.forEach(function (line, li) {
        var tr = el("tr", (li === 0 ? "" : "saeh-cont") + alt);
        // Empty on continuation lines, so the label reads once per group.
        tr.appendChild(el("td", "saeh-label", li === 0 ? g.label : ""));
        tr.appendChild(el("td", null, line));
        tbody.appendChild(tr);
      });
    });
    table.appendChild(tbody);
    return table;
  }

  /**
   * Benefits and Applications share ONE design — the yellow tick.
   *
   * There used to be a `checklist` flag selecting a plain dot instead, and the
   * accordion's Applications panel was the only caller anywhere that passed
   * false: the standalone Applications section and both dashboard previews
   * already used ticks. So the flag's only effect was to make the same content
   * look different depending on which widget rendered it. Removed rather than
   * corrected, so the two render paths cannot drift again.
   */
  function itemList(items) {
    var ul = el("ul", "saeh-list saeh-check");
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
      panels.push({ id: "benefits", label: "Key Benefits", build: function () { return itemList(data.benefits); } });
    }
    if (data.applications && data.applications.length) {
      panels.push({ id: "applications", label: "Applications", build: function () { return itemList(data.applications); } });
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

  function listSection(title, items) {
    var sec = el("div", "saeh-section");
    sec.appendChild(el("div", "saeh-h", title));
    sec.appendChild(itemList(items));
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

  /**
   * Cube glyph for the 3D banner — one path, three closed-ish subpaths.
   *
   * ⚠️ Replaced a supplied asset that drew every edge as a separate OPEN
   * subpath with small bezier corners. That geometry is fine at the 800px the
   * file was authored for and muddy at 34px: the curves collapse into blobs
   * and the doubled corners read as thick smudges once the 24-unit viewBox is
   * scaled up ~1.4x. This is the plain isometric cube instead — a closed
   * hexagonal outline plus the three interior edges meeting at the centre —
   * which stays legible because every line is straight and no two strokes
   * overlap.
   *
   * stroke-width 1.6, chosen by rendering 1.4/1.6/1.75/2 at the real 34px:
   * from 1.75 up the interior corners crowd and the three faces start closing
   * into a blob. Don't raise it without looking at it that size.
   *
   * Built via createElementNS rather than innerHTML, matching the
   * "textContent only, never inject HTML" rule the rest of this file follows.
   * currentColor keeps the colour in CSS (`.saeh-3d-icon{color:#111}`).
   */
  var CUBE_ICON_PATH =
    "M12 2.75L20.5 7.375V16.625L12 21.25L3.5 16.625V7.375ZM3.5 7.375L12 12L20.5 7.375M12 12V21.25";

  function cubeIcon() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "saeh-3d-icon");
    var path = document.createElementNS(NS, "path");
    path.setAttribute("d", CUBE_ICON_PATH);
    svg.appendChild(path);
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
  /**
   * The 3D call-to-action banner: icon + headline on the left, button right.
   *
   * The icon and headline are wrapped in their own flex row rather than being
   * three siblings of the outer container. With three siblings and
   * `justify-content:space-between`, the headline would be pushed to the
   * middle of the banner and the gap either side of it would change with the
   * text length; grouping them means the pair stays left-aligned as one block
   * however long the headline is, and wraps as one block on narrow screens.
   */
  function model3dSection(url) {
    var sec = el("div", "saeh-section saeh-3d-cta");

    var main = el("div", "saeh-3d-cta-main");
    main.appendChild(cubeIcon());
    main.appendChild(el("div", "saeh-3d-cta-title", "View the product in 3D Mode!"));
    sec.appendChild(main);

    var btn = el("button", "saeh-3d-btn");
    btn.type = "button";
    btn.appendChild(el("span", null, "View 3D Mode"));

    // Decorative: alt="" plus aria-hidden keeps it out of the accessible name,
    // which the label alone should carry. The width/height ATTRIBUTES (not
    // just CSS) reserve the box before the file arrives, so the button doesn't
    // reflow as it loads — and it hides itself if the URL ever dies, leaving a
    // text-only button rather than a broken-image glyph on a live page.
    var icon = document.createElement("img");
    icon.className = "saeh-3d-btn-icon";
    icon.src = CHEVRON_ICON_SRC;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    icon.width = 20;
    icon.height = 20;
    icon.addEventListener("error", function () {
      icon.style.display = "none";
    });
    btn.appendChild(icon);

    btn.addEventListener("click", function () {
      openModel3dModal(url);
    });
    sec.appendChild(btn);
    return sec;
  }

  function chevron(dir) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", dir === "prev" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7");
    svg.appendChild(p);
    return svg;
  }

  /**
   * "Compatible Products & Accessories" — a scroll-snap carousel.
   *
   * Card count per row is pure CSS (2 / 3 / 4 by breakpoint), so this only has
   * to decide whether ARROWS are needed — and that question cannot be answered
   * from the item count alone, because 3 items need arrows at 2-up and none at
   * 3-up. It is measured instead: arrows show only while the track actually
   * overflows, checked on load, on resize and on scroll. That gets the case
   * asked for (3 items: no arrows on desktop, arrows on mobile) without
   * hard-coding a single breakpoint assumption.
   */
  function compatibleSection(items) {
    var sec = el("div", "saeh-section saeh-cp-sec");
    sec.appendChild(el("h3", "saeh-cp-h", "Compatible Products & Accessories"));

    var wrap = el("div", "saeh-cp");
    var track = el("div", "saeh-cp-track");

    items.forEach(function (it) {
      // The whole card is the link, so the button is decoration rather than a
      // second tab stop for the same destination.
      var card = document.createElement("a");
      card.className = "saeh-cp-card";
      card.href = it.url || "#";

      var shot = el("div", "saeh-cp-shot");
      if (it.imageUrl) {
        var img = document.createElement("img");
        img.src = it.imageUrl;
        img.alt = it.name || "";
        // setAttribute, not `img.loading =` — the property is not reflected
        // to the attribute in every DOM implementation, so the property form
        // silently produces no `loading` attribute at all in some engines.
        img.setAttribute("loading", "lazy");
        shot.appendChild(img);
      }
      card.appendChild(shot);

      var body = el("div", "saeh-cp-body");
      body.appendChild(el("div", "saeh-cp-name", it.name || ""));
      var btn = el("span", "saeh-cp-btn");
      btn.appendChild(el("span", null, "VIEW PRODUCT"));
      var ico = document.createElement("img");
      ico.className = "saeh-cp-btn-icon";
      ico.src = CHEVRON_ICON_SRC;
      ico.alt = "";
      ico.setAttribute("aria-hidden", "true");
      ico.width = 16;
      ico.height = 16;
      ico.addEventListener("error", function () {
        ico.style.display = "none";
      });
      btn.appendChild(ico);
      body.appendChild(btn);
      card.appendChild(body);

      track.appendChild(card);
    });

    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "saeh-cp-nav saeh-cp-prev";
    // Start hidden and let the measurement reveal them. Defaulting to visible
    // flashes two arrows on every load for the many products whose cards fit.
    prev.hidden = true;
    prev.setAttribute("aria-label", "Previous products");
    prev.appendChild(chevron("prev"));

    var next = document.createElement("button");
    next.type = "button";
    next.className = "saeh-cp-nav saeh-cp-next";
    next.hidden = true;
    next.setAttribute("aria-label", "Next products");
    next.appendChild(chevron("next"));

    wrap.appendChild(prev);
    wrap.appendChild(track);
    wrap.appendChild(next);
    sec.appendChild(wrap);

    function page() {
      // One card plus its gap, so a click advances by whole cards at whatever
      // the current breakpoint shows.
      var first = track.firstElementChild;
      return first ? first.getBoundingClientRect().width + 16 : track.clientWidth;
    }

    function sync() {
      /*
       * Overflow is the whole test, and it answers the item-count question for
       * free: 3 cards where 4 fit do not overflow, so no arrows; the same 3 at
       * 2-up on a phone do, so arrows appear. Counting items instead would
       * need the breakpoint hard-coded here and would then disagree with the
       * CSS the moment either changed.
       *
       * It cannot oscillate. Card width is a percentage OF THE TRACK, so
       * hiding an arrow widens the track and widens the cards by the same
       * proportion — the number that fits is identical either way.
       */
      var overflow = track.scrollWidth - track.clientWidth > 2;
      // `hidden` rather than a class: it also takes the buttons out of the tab
      // order, which display:none via a class would too but less explicitly.
      prev.hidden = !overflow;
      next.hidden = !overflow;
      if (!overflow) return;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    }

    prev.addEventListener("click", function () {
      track.scrollBy({ left: -page(), behavior: "smooth" });
    });
    next.addEventListener("click", function () {
      track.scrollBy({ left: page(), behavior: "smooth" });
    });
    track.addEventListener("scroll", sync);

    // Measured after layout, and again on resize — the arrow decision depends
    // on the rendered width, which is not known at build time.
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(sync);
    else setTimeout(sync, 0);
    if (typeof ResizeObserver === "function") {
      try {
        new ResizeObserver(sync).observe(track);
      } catch (e) {
        window.addEventListener("resize", sync);
      }
    } else {
      window.addEventListener("resize", sync);
    }

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
    if (name === "benefits") return data.benefits && data.benefits.length ? listSection("Key Benefits", data.benefits) : null;
    if (name === "applications") return data.applications && data.applications.length ? listSection("Applications", data.applications) : null;
    if (name === "downloads") return data.downloads && data.downloads.length ? downloadsSection(data.downloads) : null;
    if (name === "compatible") return data.compatible && data.compatible.length ? compatibleSection(data.compatible) : null;
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
   *
   * ⚠️ Always resolves, NEVER hangs. pageData() is Duda's promise, not ours,
   * and a promise that simply never settles is the one failure a try/catch
   * cannot see: the caller waits forever and the widget renders nothing, which
   * on a fail-quiet widget is indistinguishable from "this product has no
   * content". So it is raced against a timer and degrades to the URL slug —
   * which is exactly what the live /product/<slug> page can supply anyway.
   */
  var PAGE_DATA_TIMEOUT_MS = 1500;

  function resolveWithin(promise, ms) {
    return new Promise(function (resolve) {
      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
      var timer = setTimeout(function () {
        hub.pageDataTimedOut = true;
        finish(null);
      }, ms);
      promise.then(finish, function () {
        finish(null);
      });
    });
  }

  function dudaPageProduct() {
    try {
      if (typeof dmAPI === "undefined" || !dmAPI || typeof dmAPI.dynamicPageApi !== "function") {
        return Promise.resolve(null);
      }
      var dynPage = dmAPI.dynamicPageApi();
      if (!dynPage || typeof dynPage.isDynamicPage !== "function" || !dynPage.isDynamicPage()) {
        return Promise.resolve(null);
      }
      return resolveWithin(
        Promise.resolve(dynPage.pageData()).then(function (pd) {
          return pd || null;
        }),
        PAGE_DATA_TIMEOUT_MS,
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
    // Stamp the requested section onto the container, so the wiring between
    // Duda's four widgets and the sections they render is visible in the DOM
    // itself — `$$('[data-saeh-section]')` in the console reads back the
    // mapping in document order. Set before the early return, so a section
    // that renders nothing is still identifiable.
    try {
      container.setAttribute("data-saeh-section", sections.join(",") || "(none)");
    } catch (e) {
      /* never break the host page */
    }
    if (!hub.api || !ref || !sections.length) return onEmpty();
    return fetchContent(ref)
      .then(function (data) {
        try {
          if (!data) return onEmpty(); // unknown product / fetch error
          var root = el("div", "saeh-root");
          for (var i = 0; i < sections.length; i++) {
            var node = buildSection(sections[i], data);
            if (!node) continue;
            // The accordion and the compatible carousel both opt out of the
            // 920px cap — see .saeh-wide. The carousel especially: capped, its
            // four cards filled only ~60% of a full-width Duda section.
            if (node.querySelector(".saeh-tabs") || node.querySelector(".saeh-cp")) {
              root.className = "saeh-root saeh-wide";
            }
            root.appendChild(node);
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
  /**
   * Normalise whatever renderExternalApp hands us.
   *
   * The documented shape is `init({ container, props, ...additionalData })`,
   * but this is called by Duda's runtime rather than by us, so it is not worth
   * betting the whole widget on one shape. Accepts, in order:
   *   init({ container, props })      documented
   *   init({ element, props })        element rather than container
   *   init(element, props)            positional
   *   init({ container, ...props })   props spread at the top level
   *
   * Getting this wrong fails SILENTLY — an unrecognised section renders
   * nothing, fail-closed — which is indistinguishable from "no data". Hence
   * the tolerance, and hence `hub.lastInit` below.
   */
  function normaliseInitArgs(a, b) {
    var container = null;
    var props = {};
    if (a && a.nodeType === 1) {
      container = a;
      props = b || {};
    } else if (a && typeof a === "object") {
      container = a.container || a.element || a.el || null;
      props = a.props || a.data || {};
      // Props spread onto the top-level object rather than nested.
      if (!props.section && a.section) props = a;
    }
    return { container: container, props: props || {} };
  }

  function init(a, b) {
    var norm = normaliseInitArgs(a, b);
    var container = norm.container;
    var props = norm.props;

    /*
     * ⚠️ The CONTAINER'S OWN ATTRIBUTE WINS over the props.
     *
     * Symptom this exists for: on the live page the compatible widget rendered
     * the 3d-viewer's content, while the Duda editor looked correct. The
     * editor initialises widgets one at a time; live initialises all of them
     * in the same tick, which is exactly when crossed props show up — every
     * shim's callback runs after every shim's code has been evaluated, so any
     * shared binding holds the LAST widget's values by then.
     *
     * `data-saeh-section` is written onto the element synchronously by the
     * shim, before any async work, so it cannot be overwritten by another
     * widget: there is one attribute per element, and each shim only ever
     * touches its own. Props remain the fallback for callers that do not set
     * it.
     *
     * Mismatches are recorded rather than hidden — if the attribute and the
     * props disagree, that IS the bug, and `__saequipHub.inits` will say so.
     */
    var attrSection = "";
    try {
      if (container && container.getAttribute) {
        attrSection = (container.getAttribute("data-saeh-section") || "").trim();
      }
    } catch (e) {
      /* never break the host page */
    }
    var propSection = (props.section || "").trim();
    var sectionName = attrSection || propSection;

    // Inspect from the browser console with __saequipHub.lastInit — the only
    // way to see what Duda passed, since a wrong shape is otherwise silent.
    //
    // Recorded as a LIST as well, because a product page runs four widgets and
    // a single `lastInit` slot is overwritten by whichever initialised last.
    // That hid a real wiring question — "is each Duda widget actually asking
    // for the section it is named after?" — which the console could not answer
    // for anything but the final widget.
    var record = {
      at: new Date().toISOString(),
      argKeys: a && typeof a === "object" && a.nodeType !== 1 ? Object.keys(a) : typeof a,
      resolvedSection: sectionName || null,
      sectionFrom: attrSection ? "container attribute" : propSection ? "props" : "none",
      // Populated only when the two disagree — a non-null value here is the
      // crossed-props bug, caught rather than rendered.
      sectionMismatch:
        attrSection && propSection && attrSection !== propSection
          ? { attribute: attrSection, props: propSection }
          : null,
      resolvedId: props.dudaId || props.slug || props.sku || null,
      gotContainer: !!container,
    };
    hub.lastInit = record;
    if (!hub.inits) hub.inits = [];
    hub.inits.push(record);
    if (hub.inits.length > 20) hub.inits.shift(); // bounded: Duda re-inits on edit

    if (!container) return;

    try {
      if (props.apiBase) hub.api = String(props.apiBase);
      var sections = sectionsForName(sectionName);
      var inEditor = props.inEditor === true || props.inEditor === "true";

      var onEmpty = function () {
        if (inEditor) return; // keep the editor placeholder and the element's box
        collapseMount(container);
      };

      var direct = refFrom(props);
      if (direct) {
        hub.lastInit.ref = direct;
        hub.lastInit.refFrom = "props";
        renderInto(container, sections, direct, onEmpty);
        return;
      }

      dudaPageProduct().then(function (pd) {
        var fromDuda = refFrom({ dudaId: pd && pd.identifier, slug: pd && pd.seo_url });
        var ref = fromDuda || refFrom({ slug: pathSlug() });
        hub.lastInit.ref = ref;
        hub.lastInit.refFrom = fromDuda ? "dmAPI" : ref ? "url" : "none";
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
  var iface = { init: init, clean: clean, version: "2026-09-11-section-attr" };
  window.SAEquipHubWidget = iface;

  /**
   * Also expose the interface as an AMD module.
   *
   * Duda's renderExternalApp was observed loading this script and then never
   * calling init(), with no error — the signature of a loader that uses the
   * script's MODULE VALUE rather than reading window[name]. A plain IIFE
   * evaluates to undefined, so `undefined.init(...)` is never reached and
   * nothing is logged. Two lines make the script work under either contract,
   * which is cheaper than depending on which one Duda actually applies.
   */
  if (typeof define === "function" && define.amd) {
    define(function () {
      return iface;
    });
  }

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

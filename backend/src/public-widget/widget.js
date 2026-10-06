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
 *   applications | downloads | all — plus the page-level widgets
 *   product-list (category pages) and resources (the Datasheets / User
 *   Manuals / Certificates pages), which have no product.
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
  // Not in ALL_SECTIONS: "product-list" belongs to a CATEGORY page and has no
  // product, so the legacy `data-section="all"` embed must never build it.
  // "resources" is in neither list: it is a page-level widget reached only
  // through init(), which branches out before any product work.
  var VALID = { "sa-logos": 1, "cert-logos": 1, "3d-viewer": 1, "tabs": 1, "specs": 1, "benefits": 1, "applications": 1, "downloads": 1, "compatible": 1, "product-list": 1 };
  var MODEL_VIEWER_SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js";
  /*
   * ⚠️ Subresource integrity for the one third-party script this widget puts
   * on the live site. The version pin stops an UPGRADE reaching visitors; this
   * stops a compromised CDN serving different bytes under the same URL. If the
   * hash does not match, the browser refuses the script, onerror fires and the
   * viewer simply does not appear — the same silent failure as a network error.
   * ⚠️ Change the version and this hash TOGETHER:
   *   curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A
   */
  var MODEL_VIEWER_SRI = "sha384-cprcVQt7wbUl0xngF3PGP6yBB7n4/t+4AoAMG9biiMCGFiWOdzUH10Ie2COTqFNW";

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

  // ---------------------------------------------------------------------------
  // Languages (multi-language Duda sites, 2026-10-06)
  // ---------------------------------------------------------------------------
  /*
   * Duda serves each extra language under its own path (`/ar/…`) and says
   * which language a page is in on the page itself. Measured on the live
   * Arabic site: `<html lang="ar">`, `window.Parameters.currentLocale === "ar"`.
   * Every widget on a page shares that one language.
   *
   * ⚠️ LOCALES and normaliseLocale() mirror backend/src/services/i18n/locales.ts
   * — this file cannot import it, so widget:test compares the two.
   */
  var LOCALES = ["en", "ar", "zh", "fr", "de", "pt-br", "es"];
  // The lang attribute each one is announced with.
  var LANG_TAG = { en: "en", ar: "ar", zh: "zh-Hans", fr: "fr", de: "de", "pt-br": "pt-BR", es: "es" };

  function normaliseLocale(raw) {
    if (typeof raw !== "string") return null;
    var t = raw.trim().toLowerCase().replace(/_/g, "-");
    if (!t) return null;
    // Traditional Chinese is NOT folded into Simplified.
    if (t === "zh-tw" || t === "zh-hk" || t === "zh-mo" || t.indexOf("zh-hant") === 0) return null;
    var base = t.split("-")[0];
    if (base === "en") return "en";
    if (base === "zh") return "zh";
    if (base === "pt") return "pt-br";
    return LOCALES.indexOf(base) !== -1 ? base : null;
  }

  /** What the page says its language is, and where that came from. */
  function pageLanguage() {
    try {
      var h = document.documentElement.getAttribute("lang");
      if (h) return { raw: h, from: "html" };
    } catch (e) {
      /* fall through */
    }
    try {
      if (window.Parameters && window.Parameters.currentLocale) {
        return { raw: String(window.Parameters.currentLocale), from: "Parameters" };
      }
    } catch (e) {
      /* fall through */
    }
    try {
      var d = window.__saehData || {};
      for (var k in d) {
        if (d[k] && d[k].locale) return { raw: String(d[k].locale), from: "data.locale" };
      }
    } catch (e) {
      /* fall through */
    }
    return { raw: "", from: "none" };
  }

  /*
   * The page's language, decided once. An unsupported language (a site that
   * adds Japanese before we have a table for it) renders English and says so
   * with lang="en", but its links still keep the page's own prefix.
   */
  var LANG = null;
  function currentLocale() {
    if (!LANG) {
      var p = pageLanguage();
      var loc = normaliseLocale(p.raw);
      LANG = { locale: loc && I18N[loc] ? loc : "en", raw: p.raw, from: p.from };
    }
    return LANG.locale;
  }
  /** The lang attribute for text in the current language. */
  function langTag() {
    return LANG_TAG[currentLocale()] || "en";
  }
  /** `&lang=xx` for a data request — nothing at all for English. */
  function langParam() {
    var l = currentLocale();
    return l === "en" ? "" : "&lang=" + encodeURIComponent(l);
  }

  /*
   * The page's language prefix ("/ar"), copied from the URL as it is — never
   * built — so whatever segment Duda uses is the one we keep. ⚠️ Only a FIRST
   * segment shaped like a language tag AND matching the page's language
   * counts, or a page such as /aviation would be taken for a prefix.
   */
  function sitePrefix() {
    var raw = (pageLanguage().raw || "").toLowerCase().split(/[-_]/)[0];
    if (!raw) return "";
    var m = /^\/([a-z]{2,3}(?:-[a-z0-9]{2,8})?)(?=\/|$)/i.exec(window.location.pathname || "");
    if (!m) return "";
    return m[1].toLowerCase().split("-")[0] === raw ? "/" + m[1] : "";
  }
  /**
   * A link on the SITE, kept in the page's language: "/product/x" → "/ar/product/x".
   * Absolute URLs, "#" and anything already prefixed pass through untouched.
   * Never use it for API or file URLs — those live on hub.api.
   */
  function localHref(u) {
    if (typeof u !== "string" || u.charAt(0) !== "/" || u.charAt(1) === "/") return u;
    var p = sitePrefix();
    if (!p || u === p || u.indexOf(p + "/") === 0) return u;
    return p + u;
  }

  /** A string in the page's language, English when that language lacks it. */
  function T(key, vars) {
    var d = I18N[currentLocale()] || I18N.en;
    var s = typeof d[key] === "string" ? d[key] : I18N.en[key];
    if (typeof s !== "string") return key;
    return vars ? fillText(s, vars) : s;
  }
  function fillText(s, vars) {
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] != null ? String(vars[k]) : m;
    });
  }
  /**
   * A count, with the language's own plural rules. Arabic has six forms
   * (zero, one, two, few, many, other), which `n === 1 ? "" : "s"` cannot say.
   * Numbers are written with Latin digits, matching the spec values.
   */
  function TP(key, n, vars) {
    var all = { n: String(n) };
    for (var k in vars || {}) all[k] = vars[k];
    return fillText(pluralForm(key, n), all);
  }
  /** The plural form for `n`, placeholders left in — for TP() and fillNodes(). */
  function pluralForm(key, n) {
    var loc = currentLocale();
    var forms = (I18N[loc] && I18N[loc][key]) || I18N.en[key];
    if (!forms || typeof forms !== "object") return key;
    var cat = "other";
    try {
      cat = new Intl.PluralRules(LANG_TAG[loc] || "en").select(n);
    } catch (e) {
      /* very old browser: "other" */
    }
    return forms[cat] || forms.other;
  }
  /**
   * A template with ELEMENTS in it — "… {link}" — as DOM, so word order can
   * differ by language without splitting a sentence around the element.
   */
  function fillNodes(s, nodes) {
    var frag = document.createDocumentFragment();
    s.split(/(\{\w+\})/).forEach(function (part) {
      var m = /^\{(\w+)\}$/.exec(part);
      if (m && nodes[m[1]]) frag.appendChild(nodes[m[1]]);
      else if (part) frag.appendChild(document.createTextNode(part));
    });
    return frag;
  }
  /** Give a root element its language, so screen readers use the right voice. */
  function stampLang(node) {
    try {
      node.setAttribute("lang", langTag());
    } catch (e) {
      /* never break the host page */
    }
    return node;
  }

  /*
   * ⚠️ The visible text, per language. Non-English is machine-drafted
   * (2026-10-06) and needs a native-speaker review. Certification marks
   * (INMETRO, UKEX, IECEX, EX) are names, not words, and stay as they are.
   *
   * ⚠️ rq.privacy + rq.privacyLink, and rq.marketing, must equal CONSENT_TEXT
   * in backend/src/services/downloadKinds.ts for EVERY language: the server
   * records its own copy as what the visitor agreed to. widget:test checks.
   */
  var I18N = {
    en: {
      "tab.overview": "Overview",
      "tab.specs": "Technical Specs",
      "tab.benefits": "Key Benefits",
      "tab.applications": "Applications",
      "specs.heading": "Technical Specifications",
      "3d.close": "Close 3D viewer",
      "3d.pause": "Pause spin",
      "3d.resume": "Resume spin",
      "3d.reset": "Reset view",
      "3d.cta": "View the product in 3D Mode!",
      "3d.button": "View 3D Mode",
      "cp.heading": "Compatible Products & Accessories",
      "cp.prev": "Previous products",
      "cp.next": "Next products",
      "card.view": "View Product",
      "card.viewAria": "View Product - {name}",
      "pl.loadMore": "Load more products",
      "pl.count": { one: "{n} product of {total}", other: "{n} products of {total}" },
      "pl.empty": "No products match those filters. Try removing one.",
      "pl.filter": "Filter Products",
      "pl.searchLabel": "Search within category",
      "pl.searchPh": "Search products...",
      "pl.clear": "Clear filters",
      "common.clearSearch": "Clear search",
      "rs.search.datasheet": "Search Datasheets",
      "rs.search.manual": "Search User Manuals",
      "rs.search.certificate": "Search Certificates",
      "rs.search.default": "Search products",
      "rs.ariaGated": "{label} - {name} (opens a request form)",
      "rs.ariaFile": "{label} - {name} (PDF, opens in a new tab)",
      "rs.noMatch": "No products match “{q}”.",
      "rs.found": { one: "{n} product found", other: "{n} products found" },
      "rs.notFound": "No products found",
      "dl.DATASHEET": "Download Datasheet",
      "dl.MANUAL": "Download User Manual",
      "dl.COMPLIANCE": "Compliance",
      "dl.fallback": "Download",
      "rq.heading": "File Requests",
      "rq.intro":
        "Due to increasing amounts of spam requests, we ask that you enter your details below to download your requested file. We will not share your information with third parties for marketing purposes, nor do we ever pass on or sell your details to a third party.",
      "rq.privacy": "I agree to my data being stored in line with our {link}",
      "rq.privacyLink": "Privacy Policy",
      "rq.marketing": "I'm happy to receive the latest news and promotions by email.",
      "rq.close": "Close",
      "rq.f.firstName": "First Name",
      "rq.f.lastName": "Last Name",
      "rq.f.company": "Company Name",
      "rq.f.email": "Email",
      "rq.f.phone": "Tel Number",
      "rq.f.mobile": "Mobile Number",
      "rq.optional": "(optional)",
      "rq.req.firstName": "Please enter your first name.",
      "rq.req.lastName": "Please enter your last name.",
      "rq.req.company": "Please enter your company name.",
      "rq.req.email": "Please enter your email address.",
      "rq.req.phone": "Please enter your telephone number.",
      "rq.badEmail": "Please enter a valid email address.",
      "rq.badPhone": "Please enter a valid phone number.",
      "rq.needPrivacy": "Please agree to the Privacy Policy to download the file.",
      "rq.submit": "Submit & Download",
      "rq.sending": "Sending…",
      "rq.doneOpening": "Thank you - your file is opening in a new tab.",
      "rq.doneReady": "Thank you - your file is ready.",
      "rq.openAgain": "Open it again",
      "rq.openFile": "Open your file",
      "rq.linkValid": "The link works for five minutes.",
      "rq.preparing": "Preparing your file…",
      "rq.checkField": "Please check this field.",
      "rq.err.400": "Please check the highlighted fields.",
      "rq.err.404": "Sorry, this file is no longer available.",
      "rq.err.429": "Too many requests. Please try again in a few minutes.",
      "rq.err.502": "Your details were received, but the file could not be opened. Please try again.",
      "rq.err.generic": "Sorry, something went wrong. Please try again.",
      "rq.err.network": "Sorry, we couldn't reach the server. Please check your connection and try again.",
    },
    ar: {
      "tab.overview": "نظرة عامة",
      "tab.specs": "المواصفات الفنية",
      "tab.benefits": "المزايا الرئيسية",
      "tab.applications": "التطبيقات",
      "specs.heading": "المواصفات الفنية",
      "3d.close": "إغلاق العارض ثلاثي الأبعاد",
      "3d.pause": "إيقاف الدوران",
      "3d.resume": "استئناف الدوران",
      "3d.reset": "إعادة ضبط العرض",
      "3d.cta": "اعرض المنتج بوضع ثلاثي الأبعاد!",
      "3d.button": "عرض بوضع ثلاثي الأبعاد",
      "cp.heading": "منتجات وملحقات متوافقة",
      "cp.prev": "المنتجات السابقة",
      "cp.next": "المنتجات التالية",
      "card.view": "عرض المنتج",
      "card.viewAria": "عرض المنتج - {name}",
      "pl.loadMore": "عرض المزيد من المنتجات",
      "pl.count": { other: "المنتجات: {n} من أصل {total}" },
      "pl.empty": "لا توجد منتجات تطابق عوامل التصفية هذه. جرّب إزالة أحدها.",
      "pl.filter": "تصفية المنتجات",
      "pl.searchLabel": "البحث ضمن الفئة",
      "pl.searchPh": "ابحث عن المنتجات...",
      "pl.clear": "مسح عوامل التصفية",
      "common.clearSearch": "مسح البحث",
      "rs.search.datasheet": "ابحث في نشرات البيانات",
      "rs.search.manual": "ابحث في أدلة المستخدم",
      "rs.search.certificate": "ابحث في الشهادات",
      "rs.search.default": "ابحث عن المنتجات",
      "rs.ariaGated": "{label} - {name} (يفتح نموذج طلب)",
      "rs.ariaFile": "{label} - {name} (ملف PDF، يفتح في علامة تبويب جديدة)",
      "rs.noMatch": "لا توجد منتجات تطابق “{q}”.",
      "rs.found": {
        zero: "لم يتم العثور على أي منتج",
        one: "تم العثور على منتج واحد",
        two: "تم العثور على منتجين",
        few: "تم العثور على {n} منتجات",
        many: "تم العثور على {n} منتجًا",
        other: "تم العثور على {n} منتج",
      },
      "rs.notFound": "لم يتم العثور على أي منتجات",
      "dl.DATASHEET": "تنزيل نشرة البيانات",
      "dl.MANUAL": "تنزيل دليل المستخدم",
      "dl.COMPLIANCE": "الامتثال",
      "dl.fallback": "تنزيل",
      "rq.heading": "طلبات الملفات",
      "rq.intro":
        "نظرًا لتزايد طلبات البريد العشوائي، نطلب منك إدخال بياناتك أدناه لتنزيل الملف المطلوب. لن نشارك معلوماتك مع أطراف ثالثة لأغراض تسويقية، ولا نقوم أبدًا بنقل بياناتك أو بيعها لأي طرف ثالث.",
      "rq.privacy": "أوافق على تخزين بياناتي بما يتوافق مع {link}",
      "rq.privacyLink": "سياسة الخصوصية",
      "rq.marketing": "يسعدني تلقي آخر الأخبار والعروض الترويجية عبر البريد الإلكتروني.",
      "rq.close": "إغلاق",
      "rq.f.firstName": "الاسم الأول",
      "rq.f.lastName": "اسم العائلة",
      "rq.f.company": "اسم الشركة",
      "rq.f.email": "البريد الإلكتروني",
      "rq.f.phone": "رقم الهاتف",
      "rq.f.mobile": "رقم الجوال",
      "rq.optional": "(اختياري)",
      "rq.req.firstName": "يرجى إدخال اسمك الأول.",
      "rq.req.lastName": "يرجى إدخال اسم العائلة.",
      "rq.req.company": "يرجى إدخال اسم الشركة.",
      "rq.req.email": "يرجى إدخال بريدك الإلكتروني.",
      "rq.req.phone": "يرجى إدخال رقم هاتفك.",
      "rq.badEmail": "يرجى إدخال بريد إلكتروني صالح.",
      "rq.badPhone": "يرجى إدخال رقم هاتف صالح.",
      "rq.needPrivacy": "يرجى الموافقة على سياسة الخصوصية لتنزيل الملف.",
      "rq.submit": "إرسال وتنزيل",
      "rq.sending": "جارٍ الإرسال…",
      "rq.doneOpening": "شكرًا لك - يتم فتح ملفك في علامة تبويب جديدة.",
      "rq.doneReady": "شكرًا لك - ملفك جاهز.",
      "rq.openAgain": "افتحه مرة أخرى",
      "rq.openFile": "افتح ملفك",
      "rq.linkValid": "يعمل الرابط لمدة خمس دقائق.",
      "rq.preparing": "جارٍ تجهيز ملفك…",
      "rq.checkField": "يرجى التحقق من هذا الحقل.",
      "rq.err.400": "يرجى التحقق من الحقول المميزة.",
      "rq.err.404": "عذرًا، هذا الملف لم يعد متاحًا.",
      "rq.err.429": "طلبات كثيرة جدًا. يرجى المحاولة مرة أخرى بعد بضع دقائق.",
      "rq.err.502": "تم استلام بياناتك، لكن تعذّر فتح الملف. يرجى المحاولة مرة أخرى.",
      "rq.err.generic": "عذرًا، حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      "rq.err.network": "عذرًا، تعذّر الوصول إلى الخادم. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
    },
    zh: {
      "tab.overview": "概述",
      "tab.specs": "技术规格",
      "tab.benefits": "主要优势",
      "tab.applications": "应用领域",
      "specs.heading": "技术规格",
      "3d.close": "关闭 3D 查看器",
      "3d.pause": "暂停旋转",
      "3d.resume": "继续旋转",
      "3d.reset": "重置视图",
      "3d.cta": "以 3D 模式查看产品！",
      "3d.button": "查看 3D 模式",
      "cp.heading": "兼容产品及配件",
      "cp.prev": "上一组产品",
      "cp.next": "下一组产品",
      "card.view": "查看产品",
      "card.viewAria": "查看产品 - {name}",
      "pl.loadMore": "加载更多产品",
      "pl.count": { other: "{n} / {total} 个产品" },
      "pl.empty": "没有符合这些筛选条件的产品。请尝试移除一个筛选条件。",
      "pl.filter": "筛选产品",
      "pl.searchLabel": "在此类别中搜索",
      "pl.searchPh": "搜索产品...",
      "pl.clear": "清除筛选",
      "common.clearSearch": "清除搜索",
      "rs.search.datasheet": "搜索数据表",
      "rs.search.manual": "搜索用户手册",
      "rs.search.certificate": "搜索证书",
      "rs.search.default": "搜索产品",
      "rs.ariaGated": "{label} - {name}（打开申请表）",
      "rs.ariaFile": "{label} - {name}（PDF，在新标签页中打开）",
      "rs.noMatch": "没有与“{q}”匹配的产品。",
      "rs.found": { other: "找到 {n} 个产品" },
      "rs.notFound": "未找到产品",
      "dl.DATASHEET": "下载数据表",
      "dl.MANUAL": "下载用户手册",
      "dl.COMPLIANCE": "合规声明",
      "dl.fallback": "下载",
      "rq.heading": "文件申请",
      "rq.intro":
        "由于垃圾请求日益增多，请在下方填写您的信息以下载所需文件。我们不会出于营销目的与第三方共享您的信息，也绝不会将您的信息转交或出售给任何第三方。",
      "rq.privacy": "我同意按照我们的{link}存储我的数据",
      "rq.privacyLink": "隐私政策",
      "rq.marketing": "我愿意通过电子邮件接收最新消息和促销信息。",
      "rq.close": "关闭",
      "rq.f.firstName": "名字",
      "rq.f.lastName": "姓氏",
      "rq.f.company": "公司名称",
      "rq.f.email": "电子邮箱",
      "rq.f.phone": "电话号码",
      "rq.f.mobile": "手机号码",
      "rq.optional": "（选填）",
      "rq.req.firstName": "请输入您的名字。",
      "rq.req.lastName": "请输入您的姓氏。",
      "rq.req.company": "请输入您的公司名称。",
      "rq.req.email": "请输入您的电子邮箱地址。",
      "rq.req.phone": "请输入您的电话号码。",
      "rq.badEmail": "请输入有效的电子邮箱地址。",
      "rq.badPhone": "请输入有效的电话号码。",
      "rq.needPrivacy": "请同意隐私政策以下载文件。",
      "rq.submit": "提交并下载",
      "rq.sending": "正在发送…",
      "rq.doneOpening": "谢谢 - 您的文件正在新标签页中打开。",
      "rq.doneReady": "谢谢 - 您的文件已准备就绪。",
      "rq.openAgain": "再次打开",
      "rq.openFile": "打开您的文件",
      "rq.linkValid": "该链接在五分钟内有效。",
      "rq.preparing": "正在准备您的文件…",
      "rq.checkField": "请检查此字段。",
      "rq.err.400": "请检查突出显示的字段。",
      "rq.err.404": "抱歉，此文件已不再提供。",
      "rq.err.429": "请求过多，请几分钟后再试。",
      "rq.err.502": "已收到您的信息，但无法打开文件。请重试。",
      "rq.err.generic": "抱歉，出现了问题。请重试。",
      "rq.err.network": "抱歉，无法连接服务器。请检查网络连接后重试。",
    },
    fr: {
      "tab.overview": "Présentation",
      "tab.specs": "Caractéristiques techniques",
      "tab.benefits": "Principaux avantages",
      "tab.applications": "Applications",
      "specs.heading": "Caractéristiques techniques",
      "3d.close": "Fermer la visionneuse 3D",
      "3d.pause": "Arrêter la rotation",
      "3d.resume": "Reprendre la rotation",
      "3d.reset": "Réinitialiser la vue",
      "3d.cta": "Découvrez le produit en mode 3D !",
      "3d.button": "Voir en 3D",
      "cp.heading": "Produits et accessoires compatibles",
      "cp.prev": "Produits précédents",
      "cp.next": "Produits suivants",
      "card.view": "Voir le produit",
      "card.viewAria": "Voir le produit - {name}",
      "pl.loadMore": "Afficher plus de produits",
      "pl.count": { one: "{n} produit sur {total}", other: "{n} produits sur {total}" },
      "pl.empty": "Aucun produit ne correspond à ces filtres. Essayez d'en retirer un.",
      "pl.filter": "Filtrer les produits",
      "pl.searchLabel": "Rechercher dans la catégorie",
      "pl.searchPh": "Rechercher des produits...",
      "pl.clear": "Effacer les filtres",
      "common.clearSearch": "Effacer la recherche",
      "rs.search.datasheet": "Rechercher des fiches techniques",
      "rs.search.manual": "Rechercher des manuels d'utilisation",
      "rs.search.certificate": "Rechercher des certificats",
      "rs.search.default": "Rechercher des produits",
      "rs.ariaGated": "{label} - {name} (ouvre un formulaire de demande)",
      "rs.ariaFile": "{label} - {name} (PDF, s'ouvre dans un nouvel onglet)",
      "rs.noMatch": "Aucun produit ne correspond à « {q} ».",
      "rs.found": { one: "{n} produit trouvé", other: "{n} produits trouvés" },
      "rs.notFound": "Aucun produit trouvé",
      "dl.DATASHEET": "Télécharger la fiche technique",
      "dl.MANUAL": "Télécharger le manuel d'utilisation",
      "dl.COMPLIANCE": "Conformité",
      "dl.fallback": "Télécharger",
      "rq.heading": "Demandes de fichiers",
      "rq.intro":
        "En raison du nombre croissant de demandes indésirables, nous vous demandons de saisir vos coordonnées ci-dessous pour télécharger le fichier demandé. Nous ne partageons pas vos informations avec des tiers à des fins marketing et nous ne transmettons ni ne vendons jamais vos données à des tiers.",
      "rq.privacy": "J'accepte que mes données soient conservées conformément à notre {link}",
      "rq.privacyLink": "Politique de confidentialité",
      "rq.marketing": "J'accepte de recevoir les dernières actualités et promotions par e-mail.",
      "rq.close": "Fermer",
      "rq.f.firstName": "Prénom",
      "rq.f.lastName": "Nom",
      "rq.f.company": "Nom de l'entreprise",
      "rq.f.email": "E-mail",
      "rq.f.phone": "Téléphone",
      "rq.f.mobile": "Mobile",
      "rq.optional": "(facultatif)",
      "rq.req.firstName": "Veuillez saisir votre prénom.",
      "rq.req.lastName": "Veuillez saisir votre nom.",
      "rq.req.company": "Veuillez saisir le nom de votre entreprise.",
      "rq.req.email": "Veuillez saisir votre adresse e-mail.",
      "rq.req.phone": "Veuillez saisir votre numéro de téléphone.",
      "rq.badEmail": "Veuillez saisir une adresse e-mail valide.",
      "rq.badPhone": "Veuillez saisir un numéro de téléphone valide.",
      "rq.needPrivacy": "Veuillez accepter la Politique de confidentialité pour télécharger le fichier.",
      "rq.submit": "Envoyer et télécharger",
      "rq.sending": "Envoi…",
      "rq.doneOpening": "Merci - votre fichier s'ouvre dans un nouvel onglet.",
      "rq.doneReady": "Merci - votre fichier est prêt.",
      "rq.openAgain": "L'ouvrir à nouveau",
      "rq.openFile": "Ouvrir votre fichier",
      "rq.linkValid": "Le lien est valable cinq minutes.",
      "rq.preparing": "Préparation de votre fichier…",
      "rq.checkField": "Veuillez vérifier ce champ.",
      "rq.err.400": "Veuillez vérifier les champs signalés.",
      "rq.err.404": "Désolé, ce fichier n'est plus disponible.",
      "rq.err.429": "Trop de demandes. Veuillez réessayer dans quelques minutes.",
      "rq.err.502": "Vos informations ont bien été reçues, mais le fichier n'a pas pu être ouvert. Veuillez réessayer.",
      "rq.err.generic": "Désolé, une erreur s'est produite. Veuillez réessayer.",
      "rq.err.network": "Désolé, impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
    },
    de: {
      "tab.overview": "Übersicht",
      "tab.specs": "Technische Daten",
      "tab.benefits": "Hauptvorteile",
      "tab.applications": "Anwendungen",
      "specs.heading": "Technische Daten",
      "3d.close": "3D-Ansicht schließen",
      "3d.pause": "Drehung anhalten",
      "3d.resume": "Drehung fortsetzen",
      "3d.reset": "Ansicht zurücksetzen",
      "3d.cta": "Produkt im 3D-Modus ansehen!",
      "3d.button": "3D-Modus ansehen",
      "cp.heading": "Kompatible Produkte & Zubehör",
      "cp.prev": "Vorherige Produkte",
      "cp.next": "Nächste Produkte",
      "card.view": "Produkt ansehen",
      "card.viewAria": "Produkt ansehen - {name}",
      "pl.loadMore": "Weitere Produkte laden",
      "pl.count": { one: "{n} Produkt von {total}", other: "{n} Produkte von {total}" },
      "pl.empty": "Keine Produkte entsprechen diesen Filtern. Entfernen Sie einen Filter.",
      "pl.filter": "Produkte filtern",
      "pl.searchLabel": "In dieser Kategorie suchen",
      "pl.searchPh": "Produkte suchen...",
      "pl.clear": "Filter zurücksetzen",
      "common.clearSearch": "Suche löschen",
      "rs.search.datasheet": "Datenblätter durchsuchen",
      "rs.search.manual": "Bedienungsanleitungen durchsuchen",
      "rs.search.certificate": "Zertifikate durchsuchen",
      "rs.search.default": "Produkte suchen",
      "rs.ariaGated": "{label} - {name} (öffnet ein Anfrageformular)",
      "rs.ariaFile": "{label} - {name} (PDF, öffnet in einem neuen Tab)",
      "rs.noMatch": "Keine Produkte passen zu „{q}“.",
      "rs.found": { one: "{n} Produkt gefunden", other: "{n} Produkte gefunden" },
      "rs.notFound": "Keine Produkte gefunden",
      "dl.DATASHEET": "Datenblatt herunterladen",
      "dl.MANUAL": "Bedienungsanleitung herunterladen",
      "dl.COMPLIANCE": "Konformität",
      "dl.fallback": "Herunterladen",
      "rq.heading": "Dateianfragen",
      "rq.intro":
        "Aufgrund zunehmender Spam-Anfragen bitten wir Sie, unten Ihre Daten einzugeben, um die angeforderte Datei herunterzuladen. Wir geben Ihre Informationen nicht zu Marketingzwecken an Dritte weiter und geben Ihre Daten niemals an Dritte weiter oder verkaufen sie.",
      "rq.privacy": "Ich bin mit der Speicherung meiner Daten gemäß unserer {link} einverstanden",
      "rq.privacyLink": "Datenschutzerklärung",
      "rq.marketing": "Ich möchte die neuesten Nachrichten und Angebote per E-Mail erhalten.",
      "rq.close": "Schließen",
      "rq.f.firstName": "Vorname",
      "rq.f.lastName": "Nachname",
      "rq.f.company": "Firmenname",
      "rq.f.email": "E-Mail",
      "rq.f.phone": "Telefonnummer",
      "rq.f.mobile": "Mobilnummer",
      "rq.optional": "(optional)",
      "rq.req.firstName": "Bitte geben Sie Ihren Vornamen ein.",
      "rq.req.lastName": "Bitte geben Sie Ihren Nachnamen ein.",
      "rq.req.company": "Bitte geben Sie Ihren Firmennamen ein.",
      "rq.req.email": "Bitte geben Sie Ihre E-Mail-Adresse ein.",
      "rq.req.phone": "Bitte geben Sie Ihre Telefonnummer ein.",
      "rq.badEmail": "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      "rq.badPhone": "Bitte geben Sie eine gültige Telefonnummer ein.",
      "rq.needPrivacy": "Bitte stimmen Sie der Datenschutzerklärung zu, um die Datei herunterzuladen.",
      "rq.submit": "Absenden & herunterladen",
      "rq.sending": "Wird gesendet…",
      "rq.doneOpening": "Vielen Dank - Ihre Datei wird in einem neuen Tab geöffnet.",
      "rq.doneReady": "Vielen Dank - Ihre Datei ist bereit.",
      "rq.openAgain": "Erneut öffnen",
      "rq.openFile": "Datei öffnen",
      "rq.linkValid": "Der Link ist fünf Minuten lang gültig.",
      "rq.preparing": "Ihre Datei wird vorbereitet…",
      "rq.checkField": "Bitte überprüfen Sie dieses Feld.",
      "rq.err.400": "Bitte überprüfen Sie die markierten Felder.",
      "rq.err.404": "Diese Datei ist leider nicht mehr verfügbar.",
      "rq.err.429": "Zu viele Anfragen. Bitte versuchen Sie es in ein paar Minuten erneut.",
      "rq.err.502": "Ihre Daten wurden empfangen, aber die Datei konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.",
      "rq.err.generic": "Leider ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
      "rq.err.network": "Der Server ist leider nicht erreichbar. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
    },
    "pt-br": {
      "tab.overview": "Visão geral",
      "tab.specs": "Especificações técnicas",
      "tab.benefits": "Principais benefícios",
      "tab.applications": "Aplicações",
      "specs.heading": "Especificações técnicas",
      "3d.close": "Fechar visualizador 3D",
      "3d.pause": "Pausar rotação",
      "3d.resume": "Retomar rotação",
      "3d.reset": "Redefinir visualização",
      "3d.cta": "Veja o produto no modo 3D!",
      "3d.button": "Ver em 3D",
      "cp.heading": "Produtos e acessórios compatíveis",
      "cp.prev": "Produtos anteriores",
      "cp.next": "Próximos produtos",
      "card.view": "Ver produto",
      "card.viewAria": "Ver produto - {name}",
      "pl.loadMore": "Carregar mais produtos",
      "pl.count": { one: "{n} produto de {total}", other: "{n} produtos de {total}" },
      "pl.empty": "Nenhum produto corresponde a esses filtros. Tente remover um.",
      "pl.filter": "Filtrar produtos",
      "pl.searchLabel": "Pesquisar na categoria",
      "pl.searchPh": "Pesquisar produtos...",
      "pl.clear": "Limpar filtros",
      "common.clearSearch": "Limpar pesquisa",
      "rs.search.datasheet": "Pesquisar fichas técnicas",
      "rs.search.manual": "Pesquisar manuais do usuário",
      "rs.search.certificate": "Pesquisar certificados",
      "rs.search.default": "Pesquisar produtos",
      "rs.ariaGated": "{label} - {name} (abre um formulário de solicitação)",
      "rs.ariaFile": "{label} - {name} (PDF, abre em uma nova aba)",
      "rs.noMatch": "Nenhum produto corresponde a “{q}”.",
      "rs.found": { one: "{n} produto encontrado", other: "{n} produtos encontrados" },
      "rs.notFound": "Nenhum produto encontrado",
      "dl.DATASHEET": "Baixar ficha técnica",
      "dl.MANUAL": "Baixar manual do usuário",
      "dl.COMPLIANCE": "Conformidade",
      "dl.fallback": "Baixar",
      "rq.heading": "Solicitações de arquivos",
      "rq.intro":
        "Devido ao número crescente de solicitações de spam, pedimos que você informe seus dados abaixo para baixar o arquivo solicitado. Não compartilhamos suas informações com terceiros para fins de marketing, nem repassamos ou vendemos seus dados a terceiros.",
      "rq.privacy": "Concordo que meus dados sejam armazenados de acordo com nossa {link}",
      "rq.privacyLink": "Política de Privacidade",
      "rq.marketing": "Aceito receber as últimas novidades e promoções por e-mail.",
      "rq.close": "Fechar",
      "rq.f.firstName": "Nome",
      "rq.f.lastName": "Sobrenome",
      "rq.f.company": "Nome da empresa",
      "rq.f.email": "E-mail",
      "rq.f.phone": "Telefone",
      "rq.f.mobile": "Celular",
      "rq.optional": "(opcional)",
      "rq.req.firstName": "Informe seu nome.",
      "rq.req.lastName": "Informe seu sobrenome.",
      "rq.req.company": "Informe o nome da sua empresa.",
      "rq.req.email": "Informe seu endereço de e-mail.",
      "rq.req.phone": "Informe seu número de telefone.",
      "rq.badEmail": "Informe um endereço de e-mail válido.",
      "rq.badPhone": "Informe um número de telefone válido.",
      "rq.needPrivacy": "Aceite a Política de Privacidade para baixar o arquivo.",
      "rq.submit": "Enviar e baixar",
      "rq.sending": "Enviando…",
      "rq.doneOpening": "Obrigado - seu arquivo está sendo aberto em uma nova aba.",
      "rq.doneReady": "Obrigado - seu arquivo está pronto.",
      "rq.openAgain": "Abrir novamente",
      "rq.openFile": "Abrir seu arquivo",
      "rq.linkValid": "O link funciona por cinco minutos.",
      "rq.preparing": "Preparando seu arquivo…",
      "rq.checkField": "Verifique este campo.",
      "rq.err.400": "Verifique os campos destacados.",
      "rq.err.404": "Desculpe, este arquivo não está mais disponível.",
      "rq.err.429": "Muitas solicitações. Tente novamente em alguns minutos.",
      "rq.err.502": "Seus dados foram recebidos, mas não foi possível abrir o arquivo. Tente novamente.",
      "rq.err.generic": "Desculpe, algo deu errado. Tente novamente.",
      "rq.err.network": "Desculpe, não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
    },
    es: {
      "tab.overview": "Descripción general",
      "tab.specs": "Especificaciones técnicas",
      "tab.benefits": "Ventajas principales",
      "tab.applications": "Aplicaciones",
      "specs.heading": "Especificaciones técnicas",
      "3d.close": "Cerrar visor 3D",
      "3d.pause": "Pausar giro",
      "3d.resume": "Reanudar giro",
      "3d.reset": "Restablecer vista",
      "3d.cta": "¡Vea el producto en modo 3D!",
      "3d.button": "Ver en 3D",
      "cp.heading": "Productos y accesorios compatibles",
      "cp.prev": "Productos anteriores",
      "cp.next": "Productos siguientes",
      "card.view": "Ver producto",
      "card.viewAria": "Ver producto - {name}",
      "pl.loadMore": "Cargar más productos",
      "pl.count": { one: "{n} producto de {total}", other: "{n} productos de {total}" },
      "pl.empty": "Ningún producto coincide con esos filtros. Pruebe a quitar uno.",
      "pl.filter": "Filtrar productos",
      "pl.searchLabel": "Buscar en la categoría",
      "pl.searchPh": "Buscar productos...",
      "pl.clear": "Borrar filtros",
      "common.clearSearch": "Borrar búsqueda",
      "rs.search.datasheet": "Buscar fichas técnicas",
      "rs.search.manual": "Buscar manuales de usuario",
      "rs.search.certificate": "Buscar certificados",
      "rs.search.default": "Buscar productos",
      "rs.ariaGated": "{label} - {name} (abre un formulario de solicitud)",
      "rs.ariaFile": "{label} - {name} (PDF, se abre en una pestaña nueva)",
      "rs.noMatch": "Ningún producto coincide con «{q}».",
      "rs.found": { one: "{n} producto encontrado", other: "{n} productos encontrados" },
      "rs.notFound": "No se encontraron productos",
      "dl.DATASHEET": "Descargar ficha técnica",
      "dl.MANUAL": "Descargar manual de usuario",
      "dl.COMPLIANCE": "Conformidad",
      "dl.fallback": "Descargar",
      "rq.heading": "Solicitudes de archivos",
      "rq.intro":
        "Debido al creciente número de solicitudes de spam, le pedimos que introduzca sus datos a continuación para descargar el archivo solicitado. No compartimos su información con terceros con fines de marketing, ni cedemos ni vendemos nunca sus datos a terceros.",
      "rq.privacy": "Acepto que mis datos se almacenen de acuerdo con nuestra {link}",
      "rq.privacyLink": "Política de privacidad",
      "rq.marketing": "Acepto recibir las últimas noticias y promociones por correo electrónico.",
      "rq.close": "Cerrar",
      "rq.f.firstName": "Nombre",
      "rq.f.lastName": "Apellidos",
      "rq.f.company": "Nombre de la empresa",
      "rq.f.email": "Correo electrónico",
      "rq.f.phone": "Teléfono",
      "rq.f.mobile": "Móvil",
      "rq.optional": "(opcional)",
      "rq.req.firstName": "Introduzca su nombre.",
      "rq.req.lastName": "Introduzca sus apellidos.",
      "rq.req.company": "Introduzca el nombre de su empresa.",
      "rq.req.email": "Introduzca su dirección de correo electrónico.",
      "rq.req.phone": "Introduzca su número de teléfono.",
      "rq.badEmail": "Introduzca una dirección de correo electrónico válida.",
      "rq.badPhone": "Introduzca un número de teléfono válido.",
      "rq.needPrivacy": "Acepte la Política de privacidad para descargar el archivo.",
      "rq.submit": "Enviar y descargar",
      "rq.sending": "Enviando…",
      "rq.doneOpening": "Gracias - su archivo se está abriendo en una pestaña nueva.",
      "rq.doneReady": "Gracias - su archivo está listo.",
      "rq.openAgain": "Abrirlo de nuevo",
      "rq.openFile": "Abrir su archivo",
      "rq.linkValid": "El enlace funciona durante cinco minutos.",
      "rq.preparing": "Preparando su archivo…",
      "rq.checkField": "Revise este campo.",
      "rq.err.400": "Revise los campos resaltados.",
      "rq.err.404": "Lo sentimos, este archivo ya no está disponible.",
      "rq.err.429": "Demasiadas solicitudes. Vuelva a intentarlo en unos minutos.",
      "rq.err.502": "Hemos recibido sus datos, pero no se pudo abrir el archivo. Vuelva a intentarlo.",
      "rq.err.generic": "Lo sentimos, algo ha fallado. Vuelva a intentarlo.",
      "rq.err.network": "Lo sentimos, no hemos podido conectar con el servidor. Compruebe su conexión y vuelva a intentarlo.",
    },
  };

  // ---- tiny DOM helpers (textContent only — never inject HTML) ----
  /**
   * Coerce a content-panel value to a boolean.
   *
   * Accepts what a CMS checkbox plausibly hands over — a real boolean, the
   * strings "true"/"1"/"on"/"yes", or the number 1 — rather than trusting one
   * representation. Anything unrecognised is false, so the default stays "off".
   */
  function truthyProp(v) {
    if (v === true || v === 1) return true;
    if (typeof v !== "string") return false;
    var t = v.trim().toLowerCase();
    return t === "true" || t === "1" || t === "on" || t === "yes";
  }

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
      /*
       * ⚠️ Letter-spacing pulls Arabic letters apart and breaks their joining,
       * so every tracked heading/label is reset on an Arabic page.
       */
      ".saeh-root:lang(ar),.saeh-root:lang(ar) *,.saeh-3d-overlay:lang(ar) *,.saeh-rq-overlay:lang(ar) *{letter-spacing:normal}",
      ".saeh-root,.saeh-3d-overlay,.saeh-rq-overlay{--saeh-head:'Barlow','Barlow Fallback',system-ui,sans-serif;--saeh-body:'Inter','Inter Fallback',system-ui,sans-serif}",
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
      /*
       * Smaller on a phone, where a row of 35px marks wraps onto three or four
       * lines and the logo strip starts competing with the product for the
       * fold. 560px is this widget's established mobile boundary — the same
       * one the compatible carousel switches to one-up at — rather than a new
       * number; the 520px block below is a narrower "things are getting tight"
       * tier, not a device class.
       *
       * Height only: `width:auto` above is what keeps every mark the same
       * height regardless of aspect ratio, so there is nothing else to scale.
       */
      "@media(max-width:560px){.saeh-logos img{height:28px}}",
      // --- tabbed accordion ---
      // Mobile-first: the DOM is header,panel,header,panel… so with no layout
      // rules at all it already reads and behaves as an accordion.
      ".saeh-tabs{border:1px solid #ececec;overflow:hidden}",
      ".saeh-tab-h{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;margin:0;font-family:var(--saeh-head);text-align:left;background:#fafafa;border:0;border-top:1px solid #ececec;padding:14px 16px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#111;cursor:pointer}",
      ".saeh-tab-h:first-child{border-top:0}",
      ".saeh-tab-h:hover{background:#f2f2f2}",
      ".saeh-tab-h[aria-expanded='true']{background:#fff}",
      // Chevron drawn from two borders — no glyph, so it can't be reshaped by
      // the host page's font (the same trap the U+2713 tick fell into).
      ".saeh-tab-h:after{content:'';flex:0 0 auto;width:8px;height:8px;border-right:2px solid #111;border-bottom:2px solid #111;transform:rotate(45deg);margin-top:-4px;transition:transform .15s ease}",
      ".saeh-tab-h[aria-expanded='true']:after{transform:rotate(225deg);margin-top:2px}",
      ".saeh-tab-h:focus-visible{outline:2px solid #111;outline-offset:-2px}",
      /*
       * The accordion panel slides open by animating a GRID ROW from 0fr to
       * 1fr — the one technique that transitions to a content-determined
       * height without measuring it in JS and writing a pixel value back.
       * `height:auto` is not animatable, and a measured max-height either
       * clips long panels or eases against a value the content never reaches
       * (the tell-tale pause at the end of a too-large max-height).
       *
       * Three elements, and each one is load-bearing:
       *   .saeh-tab-p — the grid, and the only thing that animates
       *   .saeh-tab-c — overflow:hidden, and NOTHING else. Padding or a border
       *                 here would survive the collapse, because box-sizing
       *                 cannot shrink them to nothing: a 0fr row would still
       *                 stand 36px tall.
       *   .saeh-tab-b — the padding and the divider, clipped by .saeh-tab-c
       *                 when closed and revealed with the content as it opens.
       *
       * ⚠️ `visibility`, not the `hidden` attribute this used to set.
       * display:none cannot be transitioned from, so the panel would jump;
       * visibility keeps the collapsed panel out of the accessibility tree and
       * out of in-page find exactly as `hidden` did, and its 0s transition is
       * DELAYED by the animation's length so it only hides once the panel has
       * finished closing. Without that delay the content vanishes on frame one
       * and the slide plays against empty space.
       */
      ".saeh-tab-p{display:grid;grid-template-rows:0fr;visibility:hidden;background:#fff;transition:grid-template-rows .34s cubic-bezier(.4,0,.2,1),visibility 0s linear .34s}",
      ".saeh-tab-p.saeh-open{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .34s cubic-bezier(.4,0,.2,1),visibility 0s}",
      ".saeh-tab-c{overflow:hidden;min-height:0}",
      ".saeh-tab-b{padding:18px 16px;border-top:1px solid #ececec}",
      // Prose inside the Overview panel. Paragraphs are flush to match how
      // Duda renders the description natively (see CLAUDE.md).
      ".saeh-prose{font-size:15px;font-weight:400;color:#878787}",
      ".saeh-prose p{margin:0}",
      ".saeh-prose p + p{margin-top:12px}",
      /*
       * ⚠️ `!important` on the indent, deliberately.
       *
       * Markers sit OUTSIDE the content box by default, so a list needs left
       * padding or its bullets render past the container's left edge — which
       * is what was happening. The padding is set here, but Duda's own reset
       * targets lists through `#dm`, and an ID beats any number of classes, so
       * `.saeh-prose ul` loses and the padding never applies. This is the one
       * place the widget cannot win on specificity, and a bullet hanging
       * outside the card is a visible break rather than a nicety.
       *
       * Scoped to `.saeh-prose` lists only — it does not leak to the host page.
       */
      ".saeh-prose ul,.saeh-prose ol{margin:12px 0;padding-left:22px!important;list-style-position:outside}",
      ".saeh-prose li{margin:0}",
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
      ".saeh-cp-sec{padding:12% 0}",
      "@media(min-width:561px){.saeh-cp-sec{padding:9% 0}}",
      "@media(min-width:881px){.saeh-cp-sec{padding:5% 0}}",
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
      // ⚠️ LAYOUT ONLY. The card's appearance is `.saeh-pl-card` and the rules
      // beside it — one design, shared with the listing grid. Anything visual
      // added here is a second copy waiting to drift out of step.
      ".saeh-cp-card{flex:0 0 100%;scroll-snap-align:start}",
      /*
       * The card shows the product's name AS STORED, because that casing is
       * now deliberate: 20 all-caps names were converted to sentence case in
       * Duda (the source of truth for `name`), so uppercasing here would throw
       * that away and re-shout every title on the one surface that displays
       * another product's name.
       *
       * `text-transform:none` is stated rather than merely omitted — it is the
       * rule that has to win if the host page ever uppercases a descendant,
       * and it records that the value is a decision, not a default.
       */
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
      /*
       * ⚠️ ARROW VISIBILITY IS CSS, NOT MEASUREMENT.
       *
       * `data-count` on .saeh-cp is the number of cards; the rules below hide
       * the arrows whenever that count fits the row at this breakpoint — 1 up
       * to 1 on mobile, up to 3 on tablet, up to 4 on desktop. Deterministic:
       * it is decided by the same media queries that set the card width, at
       * parse time, with no dependency on when anything is laid out.
       *
       * This replaced a scrollWidth-vs-clientWidth measurement, which was
       * correct in principle and kept failing in practice: it has to run after
       * layout, and when it did not run at all the arrows stayed in their
       * default state — two live arrows next to two cards with nothing to
       * scroll. A rule that cannot run at the wrong time cannot be wrong.
       *
       * The cost is that the breakpoints are stated twice, here and in the
       * card widths. They sit adjacent for exactly that reason: change one,
       * change the other.
       */
      "@media(max-width:560px){.saeh-cp[data-count='1'] .saeh-cp-nav{display:none}}",
      "@media(min-width:561px) and (max-width:880px){" +
        ".saeh-cp[data-count='1'] .saeh-cp-nav," +
        ".saeh-cp[data-count='2'] .saeh-cp-nav," +
        ".saeh-cp[data-count='3'] .saeh-cp-nav{display:none}" +
      "}",
      "@media(min-width:881px){" +
        ".saeh-cp[data-count='1'] .saeh-cp-nav," +
        ".saeh-cp[data-count='2'] .saeh-cp-nav," +
        ".saeh-cp[data-count='3'] .saeh-cp-nav," +
        ".saeh-cp[data-count='4'] .saeh-cp-nav{display:none}" +
      "}",
      ".saeh-3d-overlay{position:fixed;inset:0;z-index:999999;background:rgba(17,17,17,.72);display:flex;font-family:var(--saeh-body)}",
      ".saeh-3d-sheet{position:relative;margin:40px;flex:1;min-width:0;background:#fff;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)}",
      ".saeh-3d-close{position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;border-radius:50%;border:none;background:rgba(17,17,17,.06);color:#111;font-family:var(--saeh-head);font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}",
      ".saeh-3d-close:hover{background:rgba(17,17,17,.12)}",
      ".saeh-3d-stage{flex:1;min-height:0;background:#f4f4f5}",
      ".saeh-3d-mv{width:100%;height:100%;display:block;--poster-color:transparent;outline:none}",
      ".saeh-3d-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:14px;border-top:1px solid #ececec;flex-shrink:0}",
      /*
       * The sliding tab indicator. Hidden by default and shown only once
       * placeBar() has successfully measured the active header — see the note
       * there. Kept out of the desktop media query so that fallback holds at
       * every width.
       */
      ".saeh-tab-bar{display:none}",
      /*
       * Accordion-width type. 15px/13px is a comfortable desktop spec table
       * but a phone is showing the same rows in a third of the width, where
       * the smaller step keeps a two-column row from wrapping into a stack.
       *
       * 720px is the complement of the 721px tab breakpoint below, not a
       * separate judgement about screen size: these sizes apply exactly when
       * the widget is in accordion layout.
       */
      "@media(max-width:720px){" +
        ".saeh-prose,.saeh-list li{font-size:14px}" +
        ".saeh-table{font-size:13px}" +
      "}",
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
        // position:relative makes .saeh-tabs the offsetParent every
        // measurement in placeBar() is expressed against.
        ".saeh-tabs{display:flex;flex-wrap:wrap;border:0;border-radius:0;overflow:visible;position:relative}" +
        ".saeh-tab-h{order:1;width:auto;flex:0 0 auto;border:0;border-bottom:3px solid transparent;background:none;padding:12px 20px 10px;font-size:13px}" +
        ".saeh-tab-h:hover{background:none;color:#000}" +
        ".saeh-tab-h[aria-expanded='true']{background:none;border-bottom-color:#ffd200}" +
        // The chevron only means something in accordion mode.
        ".saeh-tab-h:after{display:none}" +
        ".saeh-tab-h:first-child{padding-left:0}" +
        /*
         * Tabs do not slide open — only the indicator moves — so the panel
         * reverts to a plain block that is either displayed or not. The grid
         * and its transition must BOTH be unset: a `display:block` element
         * ignores grid-template-rows, so a closed panel would otherwise show
         * at full height with nothing collapsing it.
         */
        ".saeh-tab-p{order:2;flex-basis:100%;display:none;grid-template-rows:none;visibility:visible;transition:none;background:none}" +
        /*
         * The grid and transition are unset on BOTH states, not just the
         * closed one: `.saeh-tab-p.saeh-open` outranks a bare `.saeh-tab-p`
         * whatever the source order or media query, so the reset above never
         * reaches an open panel. Inert today (display:block ignores
         * grid-template-rows) but the kind of leftover that becomes real the
         * moment someone gives the desktop panel a display that honours it.
         */
        ".saeh-tab-p.saeh-open{display:block;grid-template-rows:none;transition:none}" +
        // overflow:visible so a focused control inside a panel isn't clipped;
        // there is nothing to hide once the panel is simply shown or not.
        ".saeh-tab-c{overflow:visible}" +
        // The divider rides along on .saeh-tab-b, where it still spans the
        // full width and still doubles as the tab strip's baseline.
        ".saeh-tab-b{padding:22px 0 0}" +
        /*
         * The yellow bar slides between tabs instead of jumping. It is ONE
         * absolutely-positioned element moved with transform + width, because
         * a per-header border cannot animate from one element to another.
         *
         * ⚠️ `.saeh-slide` is added by placeBar() only after a successful
         * measurement, and it is what switches the per-header border off. So a
         * measurement that never runs — the exact failure that once left the
         * carousel showing two live arrows with nothing to scroll — degrades
         * to the previous instant-switch underline rather than to NO underline
         * at all. The fallback is the default state, not the recovery path.
         */
        ".saeh-tabs.saeh-slide .saeh-tab-bar{display:block;position:absolute;left:0;height:3px;background:#ffd200;pointer-events:none;transition:transform .32s cubic-bezier(.4,0,.2,1),width .32s cubic-bezier(.4,0,.2,1)}" +
        ".saeh-tabs.saeh-slide .saeh-tab-h[aria-expanded='true']{border-bottom-color:transparent}" +
      "}",
      /* --- product listing (category pages) --- */
      /*
       * Mobile-first and STACKED: the filter panel sits above the grid and only
       * becomes a sidebar at 881px. A sidebar that merely squeezes is what makes
       * filtered listings unusable on a phone, and browsing on site is this
       * widget's whole job.
       */
      ".saeh-pl{display:flex;flex-direction:column;gap:20px;font-family:var(--saeh-body)}",
      ".saeh-pl-main{min-width:0;flex:1}",
      ".saeh-pl-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:16px}",
      ".saeh-pl-count{font-size:15px;color:#878787}",
      ".saeh-pl-count b{color:#111;font-weight:600}",
      ".saeh-pl-filter{border:1px solid #e6e6e6;background:#fff}",
      /*
       * The search sits OUTSIDE the collapsible panel deliberately. On a phone
       * the filter list is behind a toggle, and an instant search hidden behind
       * a click is the one control people reach for first — so it stays visible
       * above the toggle there, and reads as the top of the sidebar on desktop.
       */
      // Hidden by default: on mobile the toggle button is the heading. The
      // desktop block below swaps which of the two shows, so the label is
      // never rendered twice.
      ".saeh-pl-title,.saeh-pl-rule{display:none}",
      ".saeh-pl-title{margin:0;padding:16px 16px 13px;font-family:var(--saeh-head);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111}",
      // Inset, so it lines up with the input rather than running edge to edge.
      ".saeh-pl-rule{height:1px;margin:0 16px;background:#e6e6e6}",
      ".saeh-pl-search{padding:14px 16px;border-bottom:1px solid #ececec}",
      ".saeh-pl-slabel{display:block;margin-bottom:8px;font-family:var(--saeh-body);font-size:14px;font-weight:600;color:#111}",
      ".saeh-pl-sbox{position:relative}",
      // ⚠️ Shared with the resources list's search (.saeh-rs-search) — one
      // treatment for the site's two search boxes, so they cannot drift.
      ".saeh-pl-search input,.saeh-rs-search input,.saeh-rq-in{width:100%;box-sizing:border-box;font-family:var(--saeh-body);font-size:15px;color:#111;background:#fff;border:1px solid #d8d8d8;padding:10px 38px 10px 12px;transition:border-color .15s cubic-bezier(.4,0,.2,1),box-shadow .15s cubic-bezier(.4,0,.2,1)}",
      // The native search X cannot be styled to match the site, so it is
      // suppressed and replaced with an inline SVG that inherits currentColor.
      ".saeh-pl-search input::-webkit-search-cancel-button,.saeh-rs-search input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}",
      ".saeh-pl-clearq{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;display:none;align-items:center;justify-content:center;padding:0;background:none;border:0;cursor:pointer;color:#111}",
      ".saeh-pl-clearq.on{display:flex}",
      ".saeh-pl-clearq:hover{color:#666}",
      ".saeh-pl-clearq svg{display:block}",
      ".saeh-pl-search input::placeholder,.saeh-rs-search input::placeholder,.saeh-rq-in::placeholder{color:#9a9a9a}",
      /*
       * Matches the dashboard's field treatment (see `fieldBase` in
       * components/ui/Input.tsx): the border takes the ring colour and a 3px
       * ring is drawn at HALF opacity, both eased over 150ms. A ring rather
       * than a thicker border because box-shadow takes no layout space, so the
       * field cannot shift by a pixel as it gains focus.
       */
      ".saeh-pl-search input:focus,.saeh-rs-search input:focus,.saeh-rq-in:focus{outline:none;border-color:var(--color_7,#fed217);box-shadow:0 0 0 3px rgba(254,210,23,.5)}",
      /*
       * ⚠️ Second rule, not a merged one. `color-mix` is what applies the half
       * opacity to the THEME colour rather than to a hardcoded yellow, but a
       * browser that does not know it drops the whole declaration — so the
       * literal rgba above has to stand alone as the fallback, and this
       * overrides it where supported.
       */
      ".saeh-pl-search input:focus,.saeh-rs-search input:focus,.saeh-rq-in:focus{box-shadow:0 0 0 3px color-mix(in srgb,var(--color_7,#fed217) 50%,transparent)}",
      ".saeh-pl-more{margin-top:24px;width:100%;font-family:var(--saeh-head);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:transparent;color:#111;border:1px solid #111;padding:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}",
      ".saeh-pl-more:hover{background:#111;color:#fff}",
      ".saeh-pl-more span{color:#9a9a9a;font-weight:600}",
      ".saeh-pl-more:hover span{color:#bbb}",
      ".saeh-pl-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;margin:0;font-family:var(--saeh-head);font-size:15px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-align:left;color:#111;background:#f7f7f7;border:0;padding:15px 16px;cursor:pointer}",
      ".saeh-pl-toggle:hover{background:#f1f1f1}",
      ".saeh-pl-toggle:focus-visible{outline:2px solid #111;outline-offset:-2px}",
      ".saeh-pl-chev{flex:0 0 auto;width:9px;height:9px;border-right:2px solid #111;border-bottom:2px solid #111;transform:rotate(45deg);margin-top:-5px;transition:transform .3s cubic-bezier(.4,0,.2,1)}",
      ".saeh-pl-toggle[aria-expanded='true'] .saeh-pl-chev{transform:rotate(225deg);margin-top:3px}",
      ".saeh-pl-panel{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .32s cubic-bezier(.4,0,.2,1),visibility 0s linear .32s}",
      ".saeh-pl-panel.saeh-open{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .32s cubic-bezier(.4,0,.2,1),visibility 0s}",
      ".saeh-pl-clip{overflow:hidden;min-height:0}",
      ".saeh-pl-inner{padding:4px 16px 16px}",
      ".saeh-pl-group{margin-top:16px}",
      ".saeh-pl-group:first-child{margin-top:4px}",
      ".saeh-pl-glabel{font-family:var(--saeh-body);font-size:14px;font-weight:600;color:#111;padding-bottom:6px;border-bottom:1px solid #ececec;margin-bottom:6px}",
      ".saeh-pl-opt{display:flex;align-items:flex-start;gap:10px;padding:6px 0;cursor:pointer;font-size:14px;color:#555;line-height:1.35}",
      ".saeh-pl-opt:hover{color:#111}",
      // min-width:0 lets a long challenge name wrap instead of pushing its count
      // off the edge of a 268px sidebar.
      ".saeh-pl-t{min-width:0}",
      ".saeh-pl-opt input{position:absolute;opacity:0;width:1px;height:1px;margin:0}",
      ".saeh-pl-box{position:relative;flex:0 0 auto;width:18px;height:18px;margin-top:1px;background:#fff;border:2px solid #d8d8d8;border-radius:3px;transition:background .15s ease,border-color .15s ease}",
      ".saeh-pl-opt:hover .saeh-pl-box{border-color:#bdbdbd}",
      ".saeh-pl-opt input:checked + .saeh-pl-box{background:#fed217;border-color:#fed217}",
      ".saeh-pl-box:after{content:\'\';position:absolute;left:4.5px;top:1px;width:5px;height:9px;border:solid #111;border-width:0 2.5px 2.5px 0;transform:rotate(45deg) scale(0);transition:transform .15s ease}",
      ".saeh-pl-opt input:checked + .saeh-pl-box:after{transform:rotate(45deg) scale(1)}",
      ".saeh-pl-opt input:focus-visible + .saeh-pl-box{outline:2px solid #111;outline-offset:2px}",
      ".saeh-pl-n{margin-left:auto;flex:0 0 auto;font-size:13px;color:#9a9a9a}",
      ".saeh-pl-clear{margin-top:14px;width:100%;font-family:var(--saeh-head);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:#fff;color:#111;border:1px solid #111;padding:10px;cursor:pointer}",
      ".saeh-pl-clear:hover{background:#111;color:#fff}",
      ".saeh-pl-grid{display:grid;gap:20px;grid-template-columns:1fr}",
      ".saeh-pl-card{display:flex;flex-direction:column;background:#fff;border:1px solid #e6e6e6;text-decoration:none;color:inherit;transition:box-shadow .2s ease}",
      ".saeh-pl-card:hover{box-shadow:0 10px 26px rgba(0,0,0,.08)}",
      ".saeh-pl-card:focus-visible{outline:2px solid #111;outline-offset:2px}",
      /*
       * Square, and `contain` rather than `cover`. These are industrial products
       * photographed at every aspect ratio; cropping a duct run or a tower light
       * to fill a square cuts the thing being sold out of frame.
       */
      // overflow:hidden is what clips the hover zoom; without it the scaled image
      // spills over the card border.
      ".saeh-pl-shot{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:#fff;box-sizing:border-box;overflow:hidden}",
      ".saeh-pl-shot img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;transition:transform .45s cubic-bezier(.4,0,.2,1)}",
      ".saeh-pl-card:hover .saeh-pl-shot img{transform:scale(1.045)}",
      ".saeh-pl-body{display:flex;flex-direction:column;flex:1;gap:8px;padding:14px 16px 16px;background:#f4f4f4}",
      ".saeh-pl-chips{display:flex;flex-wrap:wrap;gap:6px}",
      // ⚠️ WHITE, not a light grey. #f1f1f1 on the body's #f4f4f4 is three
      // values apart — the chip was effectively invisible against it.
      ".saeh-pl-chip{font-family:var(--saeh-head);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;background:#fff;color:#444;padding:4px 8px}",
      ".saeh-pl-name{font-family:var(--saeh-head);font-size:15px;font-weight:600;line-height:1.3;color:#111;margin:0}",
      ".saeh-pl-certs{font-size:13px;color:#878787;line-height:1.4}",
      // ⚠️ Each certification is one unbreakable unit. See the markup.
      ".saeh-pl-certs span{white-space:nowrap}",
      ".saeh-pl-btn{margin-top:auto;display:flex;align-items:center;justify-content:center;background:#fed217;color:#000;font-family:var(--saeh-body);font-size:16px;font-weight:400;text-transform:none;letter-spacing:normal;padding:13px}",
      /*
       * The chevron grows from zero width rather than just fading, so the
       * centred flex row shifts the label left by half the space it takes —
       * the pair stays centred instead of the label jumping.
       */
      /*
       * ⚠️ The WRAPPER is what animates; the svg keeps a FIXED size inside it.
       * Animating the svg's own width scales its viewBox content — the chevron
       * zoomed up from a dot instead of sliding out from behind the label,
       * because the default preserveAspectRatio fits the content to whichever
       * axis is smaller.
       */
      ".saeh-pl-chevwrap{display:inline-flex;align-items:center;flex:0 0 auto;width:0;overflow:hidden;opacity:0;transition:width .18s cubic-bezier(.4,0,.2,1),opacity .12s ease,margin-left .18s cubic-bezier(.4,0,.2,1)}",
      ".saeh-pl-btn svg{width:19px;height:19px;flex:0 0 auto;display:block}",
      ".saeh-pl-card:hover .saeh-pl-chevwrap,.saeh-pl-card:focus-visible .saeh-pl-chevwrap{width:19px;opacity:1;margin-left:8px}",
      ".saeh-pl-card:hover .saeh-pl-btn{background:#f0c400}",
      /*
       * ⚠️ grid-column:1/-1 is what centres this. The message is a child of the
       * GRID, so without it the message is an ordinary grid item sitting in
       * column 1 of 3 — `margin:0 auto` then centres it within that first third,
       * which looks centred until you notice it is a third of the way across.
       * Spanning every column is what makes it centre where the products sit.
       */
      ".saeh-pl-empty{grid-column:1/-1;padding:56px 20px;margin:0 auto;max-width:50ch;text-align:center;font-size:16px;color:#878787}",
      /*
       * Cards fade up as they arrive — on first paint, on every filter change,
       * and for each newly loaded page. The stagger is capped at a few hundred
       * ms via nth-child so a 40-card page does not turn into a slow cascade.
       */
      "@keyframes saeh-pl-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
      ".saeh-pl-card{animation:saeh-pl-in .32s cubic-bezier(.4,0,.2,1) both}",
      ".saeh-pl-card:nth-child(3n+2){animation-delay:.05s}",
      ".saeh-pl-card:nth-child(3n+3){animation-delay:.1s}",
      "@media(min-width:561px){.saeh-pl-grid{grid-template-columns:repeat(2,1fr)}}",
      "@media(min-width:881px){" +
        ".saeh-pl{flex-direction:row;align-items:flex-start;gap:28px}" +
        // min-width:0 on the main column is load-bearing: a grid inside a flex
        // item otherwise refuses to shrink below its content and shoves the
        // sidebar off the row.
        // max-height + overflow is what makes sticky useful rather than nominal: a
        // filter list taller than the viewport would scroll the page past it.
        ".saeh-pl-side{flex:0 0 300px;max-width:300px;position:sticky;top:20px;max-height:calc(100vh - 40px);overflow-y:auto}" +
        // Duda's theme colour 7, with the brand yellow as the fallback for
        // when the widget renders outside a themed page (the editor preview).
        ".saeh-pl-filter{border-top:5px solid var(--color_7,#fed217)}" +
        ".saeh-pl-grid{grid-template-columns:repeat(3,1fr)}" +
        // Desktop shows the filters outright: no toggle, no collapse, no slide.
        ".saeh-pl-toggle{display:none}" +
        ".saeh-pl-title{display:block}" +
        ".saeh-pl-rule{display:block}" +
        ".saeh-pl-panel,.saeh-pl-panel.saeh-open{display:block;grid-template-rows:none;visibility:visible;transition:none}" +
        ".saeh-pl-clip{overflow:visible}" +
        ".saeh-pl-inner{padding:16px}" +
      "}",
      /* --- resources list (Datasheets / User Manuals / Certificates pages) --- */
      /*
       * One row per product: picture, range logo, name, View Product, then its
       * download buttons. Mobile-first and STACKED — the buttons take a row of
       * their own under the product, two to a line, so four certificate
       * buttons stay finger-sized on a phone. At 721px (the accordion's own
       * breakpoint) the buttons move to the right of the row.
       */
      ".saeh-rs{font-family:var(--saeh-body)}",
      // Heading on the left, search on the right; stacked on a phone. Bottom-
      // aligned, so the heading sits on the same line as the search field.
      ".saeh-rs-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px 24px;margin-bottom:20px}",
      /*
       * ⚠️ A real h6 over a real h2, and on the live page THE SITE'S THEME
       * styles them, not these rules: Duda's theme targets every h2/h6 in the
       * page content (`#dmRoot #dm div.dmContent h2`), which outranks any class
       * here. So the widget's headings match the site's own — h2 Barlow 400
       * #000 at 42/34/30px, h6 Inter 700 14px with .2em tracking (measured
       * 2026-10-05). The type below is only the fallback for anywhere the
       * theme does not reach. What the theme does NOT set, and these rules
       * therefore own: margins (the 15px between the two) and line-height,
       * which would otherwise inherit .saeh-root's 1.5 and open a tall gap.
       */
      ".saeh-rs-heads{min-width:0}",
      ".saeh-rs-sub{margin:0 0 15px;font-family:var(--saeh-body);font-size:14px;font-weight:700;letter-spacing:.2em;color:#2d2e32;line-height:1.4}",
      ".saeh-rs-h{margin:0;font-family:var(--saeh-head);font-size:30px;font-weight:400;color:#000;line-height:1.2}",
      "@media(min-width:768px){.saeh-rs-h{font-size:34px}}",
      "@media(min-width:1025px){.saeh-rs-h{font-size:42px}}",
      ".saeh-rs-search{flex:1 1 100%;min-width:0}",
      // For screen readers only: the search's label and its result count.
      ".saeh-rs-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}",
      // A class, not the `hidden` attribute: `.saeh-rs-row{display:grid}` would
      // beat the browser's own [hidden] rule and the row would stay visible.
      ".saeh-rs-row.saeh-rs-off,.saeh-rs-none.saeh-rs-off{display:none}",
      ".saeh-rs-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}",
      ".saeh-rs-row{display:grid;grid-template-columns:84px minmax(0,1fr);align-items:center;gap:14px 16px;margin:0;padding:14px;background:#fff;border:1px solid #e6e6e6;animation:saeh-pl-in .32s cubic-bezier(.4,0,.2,1) both}",
      ".saeh-rs-shot{width:84px;height:84px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}",
      // `contain`, as on the product cards: cropping industrial kit to a square cuts it out of frame.
      ".saeh-rs-shot img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;transition:transform .45s cubic-bezier(.4,0,.2,1)}",
      ".saeh-rs-row:hover .saeh-rs-shot img{transform:scale(1.045)}",
      ".saeh-rs-info{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px}",
      ".saeh-rs-range{display:block;height:24px;width:auto;max-width:150px;object-fit:contain}",
      ".saeh-rs-name{font-family:var(--saeh-head);font-size:16px;font-weight:600;line-height:1.3;color:#111;margin:0;overflow-wrap:break-word}",
      ".saeh-rs-view{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:#111;text-decoration:underline;text-decoration-color:#cfcfcf;text-underline-offset:3px;transition:text-decoration-color .15s ease}",
      ".saeh-rs-view:hover{text-decoration-color:#111}",
      ".saeh-rs-view svg{width:14px;height:14px;flex:0 0 auto;display:block}",
      ".saeh-rs-dls{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px}",
      // Same yellow, type and hover as the product cards' View Product button.
      ".saeh-rs-dl,.saeh-rq-submit{flex:1 1 calc(50% - 4px);box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 16px;background:#fed217;color:#000;font-family:var(--saeh-body);font-size:16px;font-weight:400;line-height:1.25;text-align:center;text-decoration:none;transition:background .15s ease}",
      ".saeh-rs-dl:hover,.saeh-rq-submit:hover{background:#f0c400}",
      ".saeh-rs-dl svg{width:18px;height:18px;flex:0 0 auto;display:block}",
      ".saeh-rs-dl:focus-visible,.saeh-rs-view:focus-visible,.saeh-rq-submit:focus-visible,.saeh-rq-close:focus-visible,.saeh-rq-link:focus-visible{outline:2px solid #111;outline-offset:2px}",
      // A gated download is a <button> (it opens the form), so it needs the
      // button resets an <a> never did.
      "button.saeh-rs-dl{border:0;cursor:pointer;margin:0}",
      ".saeh-rs-ph{border:1px dashed #cfcfcf;padding:28px 20px;text-align:center;color:#878787;font-size:15px;font-family:var(--saeh-body)}",
      "@media(min-width:721px){" +
        ".saeh-rs-row{grid-template-columns:96px minmax(0,1fr) auto;gap:20px;padding:16px 20px}" +
        // Top right; margin-left:auto keeps it there when there is no heading.
        ".saeh-rs-search{flex:0 1 340px;margin-left:auto}" +
        ".saeh-rs-shot{width:96px;height:96px}" +
        ".saeh-rs-name{font-size:17px}" +
        ".saeh-rs-dls{grid-column:auto;justify-content:flex-end;max-width:440px}" +
        ".saeh-rs-dl{flex:0 0 auto;min-width:100px}" +
      "}",
      // Room for a full row of certificates (INMETRO, UKEX, IECEX, EX) on one
      // line; between 721 and 1023px the name keeps the space and they wrap.
      "@media(min-width:1024px){.saeh-rs-dls{max-width:560px}}",
      /* --- resource request form (gated downloads) --- */
      /*
       * Appended to <body>, like the 3D viewer, so it sits above everything
       * whatever the Duda layout. ⚠️ That puts it OUTSIDE the theme's
       * `div.dmContent`, so the site's heading rules do not reach its h2 —
       * which is why the heading below restates the theme's h2 (Barlow 400,
       * black) rather than relying on it, as the in-page widgets do.
       */
      ".saeh-rq-overlay{position:fixed;inset:0;z-index:999999;background:rgba(17,17,17,.72);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 16px;box-sizing:border-box;font-family:var(--saeh-body)}",
      ".saeh-rq-sheet{position:relative;width:100%;max-width:640px;margin:auto;background:#fff;color:#1a1a1a;padding:32px 20px 28px;box-sizing:border-box;font-size:16px;line-height:1.5;animation:saeh-pl-in .25s cubic-bezier(.4,0,.2,1) both}",
      ".saeh-rq-close{position:absolute;top:10px;inset-inline-end:10px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;padding:0;background:none;border:0;cursor:pointer;color:#111}",
      ".saeh-rq-close:hover{color:#666}",
      ".saeh-rq-h{margin:0;margin-block-end:6px;margin-inline-end:40px;font-family:var(--saeh-head);font-size:30px;font-weight:400;line-height:1.2;color:#000}",
      ".saeh-rq-file{margin:0 0 14px;font-size:14px;font-weight:600;color:#111}",
      ".saeh-rq-p{margin:0 0 22px;font-size:15px;line-height:1.55;color:#555}",
      ".saeh-rq-grid{display:grid;grid-template-columns:1fr;gap:14px 16px}",
      ".saeh-rq-field{min-width:0}",
      ".saeh-rq-label{display:block;margin-bottom:6px;font-size:14px;font-weight:600;color:#111}",
      ".saeh-rq-label .saeh-rq-opt{font-weight:400;color:#878787}",
      // Shares the search field's look (see the shared rule); only the
      // padding differs, as there is no X to make room for.
      ".saeh-rq-in{padding:10px 12px;border-radius:0}",
      ".saeh-rq-in[aria-invalid='true']{border-color:#c62828}",
      ".saeh-rq-err{margin:6px 0 0;font-size:13px;color:#c62828}",
      ".saeh-rq-checks{margin:20px 0 4px}",
      ".saeh-rq-checks .saeh-pl-opt{color:#333;font-size:14px}",
      ".saeh-rq-checks a{color:inherit;text-decoration:underline;text-underline-offset:2px}",
      ".saeh-rq-submit{width:100%;margin-top:18px;border:0;cursor:pointer;font-weight:600}",
      ".saeh-rq-submit:disabled{opacity:.6;cursor:default}",
      ".saeh-rq-msg{margin:14px 0 0;font-size:14px;color:#c62828}",
      ".saeh-rq-msg:empty{display:none}",
      ".saeh-rq-done{font-size:16px;color:#111;margin:4px 0 18px}",
      ".saeh-rq-link{display:inline-flex}",
      ".saeh-rq-again{margin:16px 0 0;font-size:14px;color:#555}",
      ".saeh-rq-again button{padding:0;background:none;border:0;font:inherit;color:#111;text-decoration:underline;cursor:pointer}",
      "@media(min-width:561px){" +
        ".saeh-rq-sheet{padding:40px 40px 36px}" +
        ".saeh-rq-h{font-size:34px}" +
        ".saeh-rq-grid{grid-template-columns:1fr 1fr}" +
        ".saeh-rq-submit{width:auto;min-width:220px}" +
      "}",
      "@media(prefers-reduced-motion:reduce){.saeh-rq-sheet{animation:none}}",
      /*
       * ⚠️ The request form reads right-to-left in Arabic, whatever the page
       * does. It is our own overlay, not part of the Duda layout, and in a
       * left-to-right box Arabic sentences put their full stop beside the
       * first word. The close button and heading use logical properties, so
       * they mirror; email and phone fields are set dir="ltr" in the markup.
       */
      ".saeh-rq-overlay:lang(ar){direction:rtl}",
      "@media(prefers-reduced-motion:reduce){" +
        ".saeh-rs-row{animation:none}" +
        ".saeh-rs-shot img,.saeh-rs-dl,.saeh-rs-view{transition:none}" +
      "}",
      "@media(prefers-reduced-motion:reduce){" +
        ".saeh-pl-panel,.saeh-pl-panel.saeh-open,.saeh-pl-chev,.saeh-pl-card,.saeh-pl-chevwrap,.saeh-pl-shot img,.saeh-pl-search input,.saeh-rs-search input,.saeh-rq-in{transition:none}" +
        ".saeh-pl-card{animation:none}" +
      "}",
      /*
       * Honour a reduced-motion preference: the slide and the indicator both
       * become instant. The layout is identical either way, so nothing is lost
       * beyond the movement itself.
       */
      "@media(prefers-reduced-motion:reduce){" +
        ".saeh-tab-p,.saeh-tab-p.saeh-open,.saeh-tabs.saeh-slide .saeh-tab-bar{transition:none}" +
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
  /*
   * The description's HTML, rebuilt from an allowlist — the ONLY markup this
   * widget injects (see tabsSection).
   *
   * ⚠️ THIS is the security boundary, and it runs in the visitor's browser on
   * purpose. The description is staff-authored (the dashboard has a raw-HTML
   * tab) and stored as written, and the public endpoint cannot sanitise it:
   * `sanitize-html` crashes the whole serverless function at load on Vercel.
   * Each side's comment used to say the OTHER side was protecting it, so for a
   * while nothing was. Whatever reaches this function, only the tags below
   * survive, with no attributes except a link's href.
   *
   * Parsed into an inert <template>: its contents belong to a document that
   * never renders, so `<img onerror>` does not fire and scripts do not run
   * while we read it. Nothing from it is ever adopted directly — every
   * surviving element is a fresh createElement, so no attribute can ride along.
   */
  var PROSE_TAGS = {
    P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    UL: 1, OL: 1, LI: 1, A: 1, HR: 1, SUP: 1, SUB: 1, BLOCKQUOTE: 1, CODE: 1, PRE: 1
  };
  // Dropped WITH their content: their text is code or controls, not prose.
  var PROSE_DROP = {
    SCRIPT: 1, STYLE: 1, IFRAME: 1, FRAME: 1, OBJECT: 1, EMBED: 1, TEMPLATE: 1, NOSCRIPT: 1,
    SVG: 1, MATH: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, LINK: 1, META: 1,
    BASE: 1, TITLE: 1, VIDEO: 1, AUDIO: 1, CANVAS: 1
  };

  function safeHref(href) {
    // Browsers ignore whitespace and control characters inside a scheme, so
    // "java\tscript:" is javascript: — strip them before deciding.
    var h = String(href).replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
    if (/^(https?:|mailto:|tel:)/i.test(h)) return true;
    // Any other scheme (javascript:, data:, vbscript:…) is refused.
    if (/^[a-z][a-z0-9+.\-]*:/i.test(h)) return false;
    return true; // relative: /product/x, #section, ?q=
  }

  function copyProse(src, dst) {
    for (var n = src.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        dst.appendChild(document.createTextNode(n.nodeValue));
        continue;
      }
      if (n.nodeType !== 1) continue; // comments, processing instructions
      var tag = String(n.nodeName).toUpperCase();
      if (PROSE_DROP[tag]) continue;
      if (!PROSE_TAGS[tag]) {
        copyProse(n, dst); // unknown wrapper (div, span…): keep its text
        continue;
      }
      var clean = document.createElement(tag.toLowerCase());
      if (tag === "A") {
        var href = n.getAttribute("href");
        if (href && safeHref(href)) clean.setAttribute("href", localHref(href));
        if (n.getAttribute("target") === "_blank") {
          clean.setAttribute("target", "_blank");
          clean.setAttribute("rel", "noopener noreferrer");
        }
      }
      copyProse(n, clean);
      dst.appendChild(clean);
    }
  }

  function safeProse(html) {
    var out = document.createDocumentFragment();
    var tpl = document.createElement("template");
    if (!("content" in tpl)) {
      // No inert parser: fall back to text. Never innerHTML a live element —
      // even detached, an <img> there loads and fires its handlers.
      out.appendChild(document.createTextNode(String(html).replace(/<[^>]*>/g, " ")));
      return out;
    }
    tpl.innerHTML = String(html);
    copyProse(tpl.content, out);
    return out;
  }

  function tabsSection(data) {
    var panels = [];

    if (data.descriptionHtml && String(data.descriptionHtml).trim()) {
      panels.push({ id: "overview", label: T("tab.overview"), build: function () {
        var body = el("div", "saeh-prose");
        // The ONLY place this widget renders HTML rather than textContent, and
        // it goes through safeProse()'s allowlist — never innerHTML. Do not
        // point this at any other field.
        body.appendChild(safeProse(data.descriptionHtml));
        return body;
      } });
    }
    if (data.specs && data.specs.length) {
      panels.push({ id: "specs", label: T("tab.specs"), build: function () { return specsTable(data.specs); } });
    }
    if (data.benefits && data.benefits.length) {
      panels.push({ id: "benefits", label: T("tab.benefits"), build: function () { return itemList(data.benefits); } });
    }
    if (data.applications && data.applications.length) {
      panels.push({ id: "applications", label: T("tab.applications"), build: function () { return itemList(data.applications); } });
    }

    if (!panels.length) return null;

    var sec = el("div", "saeh-section");
    var wrap = el("div", "saeh-tabs");
    // Unique per instance, so several accordions on one page cannot collide on
    // the aria-controls / id pairing.
    var uid = "saeh-t" + Math.random().toString(36).slice(2, 9);
    var headers = [];
    // Held explicitly rather than reached via wrap.children[i * 2 + 1]: the
    // indicator is a child too, and index arithmetic over a mixed child list
    // is one appended element away from selecting the wrong panel.
    var panelEls = [];

    panels.forEach(function (p, i) {
      var panelId = uid + "-" + p.id;

      var h = document.createElement("button");
      h.type = "button"; // never submit a surrounding Duda form
      h.className = "saeh-tab-h";
      h.id = panelId + "-h";
      h.setAttribute("aria-expanded", "false");
      h.setAttribute("aria-controls", panelId);
      h.appendChild(el("span", null, p.label));

      // Three nested elements so the panel can slide — see the CSS note on
      // .saeh-tab-p for why the padding cannot live on the clipping element.
      var panel = el("div", "saeh-tab-p");
      panel.id = panelId;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", h.id);
      var clip = el("div", "saeh-tab-c");
      var body = el("div", "saeh-tab-b");
      body.appendChild(p.build());
      clip.appendChild(body);
      panel.appendChild(clip);

      headers.push(h);
      panelEls.push(panel);
      wrap.appendChild(h);
      wrap.appendChild(panel);
    });

    // Appended last, and deliberately AFTER the loop: it is absolutely
    // positioned, so it takes part in no layout and sits in no flex line.
    var bar = el("div", "saeh-tab-bar");
    bar.setAttribute("aria-hidden", "true");
    wrap.appendChild(bar);

    /*
     * Which layout the same DOM is currently in. Matches the media query in
     * injectStyles() — above it the headers become a tab strip, below it an
     * accordion. Falls back to TABS on any error, because that layout is
     * never empty: a tab row with no open panel looks broken, whereas a fully
     * closed accordion is a normal resting state.
     */
    function isTabs() {
      try {
        return !window.matchMedia || window.matchMedia("(min-width:721px)").matches;
      } catch (e) {
        return true;
      }
    }

    var current = -1; // -1 = everything closed

    /*
     * Move the yellow bar under the active tab.
     *
     * ⚠️ This measures, and a measurement can run before layout exists — the
     * widget is built detached and only mounted by renderInto(), so the very
     * first call reads every offset as 0. That is why a failed measurement
     * REMOVES .saeh-slide instead of writing zeroes: without the class the CSS
     * falls back to the per-header border, which is the behaviour that shipped
     * before this animation existed. The bar can be late, but it cannot be
     * wrong, and the tab is never left with no underline at all.
     */
    function placeBar() {
      try {
        if (!isTabs() || current < 0) {
          wrap.classList.remove("saeh-slide");
          return;
        }
        var h = headers[current];
        var w = h.offsetWidth;
        if (!w) {
          wrap.classList.remove("saeh-slide");
          return;
        }
        var first = !wrap.classList.contains("saeh-slide");
        // The first placement must not animate in from the left edge, so the
        // transition is suppressed until the bar has a real starting position.
        if (first) bar.style.transition = "none";
        // Sits ON the header's 3px bottom border rather than at the bottom of
        // .saeh-tabs, which is below the open panel.
        bar.style.top = h.offsetTop + h.offsetHeight - 3 + "px";
        bar.style.width = w + "px";
        bar.style.transform = "translateX(" + h.offsetLeft + "px)";
        wrap.classList.add("saeh-slide");
        if (first) {
          // Read back to flush the layout, so clearing the override cannot be
          // batched into the same frame as the placement above.
          void bar.offsetWidth;
          bar.style.transition = "";
        }
      } catch (e) {
        wrap.classList.remove("saeh-slide");
      }
    }

    function select(index) {
      current = index;
      panels.forEach(function (_p, i) {
        var open = i === index;
        headers[i].setAttribute("aria-expanded", open ? "true" : "false");
        /*
         * A class, not the `hidden` attribute this used to set. `hidden` is
         * display:none, which cannot be transitioned from — the panel would
         * jump open rather than slide. The CSS keeps both of the properties
         * `hidden` was there for: display:none in tab layout, and an
         * animation-delayed visibility:hidden in accordion layout, each of
         * which removes the panel from the accessibility tree and from
         * in-page find exactly as the attribute did.
         */
        if (open) panelEls[i].classList.add("saeh-open");
        else panelEls[i].classList.remove("saeh-open");
      });
      placeBar();
    }

    headers.forEach(function (h, i) {
      h.addEventListener("click", function () {
        /*
         * Accordion mode TOGGLES; tab mode always selects.
         *
         * On mobile everything starts closed, so a header that could only
         * open would leave no way back to that state. In the tab layout the
         * same toggle would empty the panel area under a still-visible tab
         * strip, which reads as broken rather than closed.
         */
        if (!isTabs() && current === i) select(-1);
        else select(i);
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

    /*
     * Initial state: first panel open as TABS, nothing open as an ACCORDION.
     * On a phone an auto-opened Overview pushes the other three headings off
     * screen, so the widget reads as one long article rather than a list of
     * what is available.
     */
    select(isTabs() ? 0 : -1);

    // Crossing up into the tab layout with nothing open would show a tab strip
    // above empty space, so open the first panel on the way up. The other
    // direction is left alone — an open accordion panel is perfectly valid.
    try {
      if (window.matchMedia) {
        var mq = window.matchMedia("(min-width:721px)");
        var onLayoutChange = function () {
          if (mq.matches && current === -1) select(0);
          // Crossing the breakpoint changes the header widths and whether the
          // bar applies at all, so it always needs re-placing.
          else placeBar();
        };
        if (mq.addEventListener) mq.addEventListener("change", onLayoutChange);
        else if (mq.addListener) mq.addListener(onLayoutChange); // older Safari
      }
    } catch (e) {
      /* never break the host page */
    }

    /*
     * Everything that can make the first measurement succeed, or invalidate a
     * later one.
     *
     * The rAF is the one that matters: select() above runs while the widget is
     * still detached, so its placeBar() reads zeroes and leaves the fallback
     * underline in place. By the next frame renderInto() has mounted it.
     * document.fonts.ready matters nearly as much — tab labels are Barlow, and
     * a web font landing after the bar is placed changes every header's width
     * underneath it.
     */
    try {
      if (window.requestAnimationFrame) window.requestAnimationFrame(placeBar);
      else setTimeout(placeBar, 0);

      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(placeBar).catch(function () {});
      }

      // Self-removing, because clean() only empties the container and keeps no
      // listener registry — without this the handler would outlive the widget
      // and hold its whole DOM alive.
      var onResize = function () {
        if (!wrap.isConnected) {
          window.removeEventListener("resize", onResize);
          return;
        }
        placeBar();
      };
      window.addEventListener("resize", onResize);
    } catch (e) {
      /* never break the host page */
    }

    sec.appendChild(wrap);
    return sec;
  }

  function specsSection(specs) {
    var sec = el("div", "saeh-section");
    sec.appendChild(el("div", "saeh-h", T("specs.heading")));
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
        s.integrity = MODEL_VIEWER_SRI;
        s.crossOrigin = "anonymous";
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
    var overlay = stampLang(el("div", "saeh-3d-overlay"));
    var sheet = el("div", "saeh-3d-sheet");
    overlay.appendChild(sheet);

    // Click on the backdrop (outside the sheet) closes; clicks inside the
    // sheet never reach this listener because they never bubble past it.
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModel3dModal(overlay);
    });

    var closeBtn = el("button", "saeh-3d-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", T("3d.close"));
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

        var spin = el("button", "saeh-btn", T("3d.pause"));
        spin.type = "button";
        spin.addEventListener("click", function () {
          if (mv.hasAttribute("auto-rotate")) {
            mv.removeAttribute("auto-rotate");
            spin.textContent = T("3d.resume");
          } else {
            mv.setAttribute("auto-rotate", "");
            spin.textContent = T("3d.pause");
          }
        });
        var reset = el("button", "saeh-btn", T("3d.reset"));
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
    main.appendChild(el("div", "saeh-3d-cta-title", T("3d.cta")));
    sec.appendChild(main);

    var btn = el("button", "saeh-3d-btn");
    btn.type = "button";
    btn.appendChild(el("span", null, T("3d.button")));

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

  /**
   * The product carousel, used by BOTH sources: a product's own compatible
   * list, and a tag's product list on a static Industries page. One renderer
   * fed one item shape is what makes "the exact same layout" true by
   * construction rather than by two designs being kept in step.
   *
   * `heading` is overridable because the text is the one thing that genuinely
   * differs — "Compatible Products & Accessories" is wrong above a list of
   * aviation products.
   */
  function compatibleSection(items, heading) {
    var sec = el("div", "saeh-section saeh-cp-sec");
    sec.appendChild(el("h3", "saeh-cp-h", heading || T("cp.heading")));

    var wrap = el("div", "saeh-cp");
    // Drives the arrow-visibility rules above. Capped at 5 because every rule
    // is "this many or fewer fit"; beyond 5 the arrows always show at every
    // breakpoint, so the exact number stops mattering.
    wrap.setAttribute("data-count", String(Math.min(items.length, 5)));
    var track = el("div", "saeh-cp-track");

    items.forEach(function (it) {
      /*
       * ⚠️ The SAME productCard() the listing grid uses, so the two designs
       * cannot drift — this carousel and the grid previously had parallel
       * markup and CSS for the same object, which is how the button ended up
       * uppercase in one and sentence case in the other.
       *
       * `.saeh-cp-card` now carries ONLY the carousel's layout (flex basis and
       * scroll snap); every visual rule comes from `.saeh-pl-card`. The
       * compatible payload has no categoryIds or certs, and productCard()
       * already omits both sections when they are empty.
       */
      var card = productCard(it, []);
      card.className += " saeh-cp-card";
      track.appendChild(card);
    });

    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "saeh-cp-nav saeh-cp-prev";
    prev.setAttribute("aria-label", T("cp.prev"));
    prev.appendChild(chevron("prev"));

    var next = document.createElement("button");
    next.type = "button";
    next.className = "saeh-cp-nav saeh-cp-next";
    next.setAttribute("aria-label", T("cp.next"));
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

    /*
     * Only the END-OF-TRAVEL state. Whether the arrows EXIST is CSS's job now
     * (see the data-count rules); this just greys the one you cannot use.
     * Measurement is fine for that: if it runs late the buttons are briefly
     * both active, which is harmless, whereas a late visibility decision left
     * arrows on a carousel with nothing to scroll.
     */
    function sync() {
      var scrollable = track.scrollWidth - track.clientWidth > 2;
      prev.disabled = !scrollable || track.scrollLeft <= 2;
      next.disabled = !scrollable || track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
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
    if (name === "benefits") return data.benefits && data.benefits.length ? listSection(T("tab.benefits"), data.benefits) : null;
    if (name === "applications") return data.applications && data.applications.length ? listSection(T("tab.applications"), data.applications) : null;
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
    var cacheKey = ref.key + ":" + ref.value + ":" + currentLocale();
    if (!hub.fetches[cacheKey]) {
      hub.fetches[cacheKey] = fetch(
        hub.api + "/public/products/content?" + ref.key + "=" + encodeURIComponent(ref.value) + langParam(),
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
          var root = stampLang(el("div", "saeh-root"));
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

  /**
   * Fetch a category's products, memoized per category across every mount and
   * every copy of this script — the same contract as fetchContent, so two
   * carousels on one page share one request.
   */
  function fetchByCategory(category) {
    if (!hub.categoryFetches) hub.categoryFetches = {};
    var cat = String(category).toLowerCase();
    var key = cat + ":" + currentLocale();
    if (!hub.categoryFetches[key]) {
      hub.categoryFetches[key] = fetch(
        hub.api + "/public/products/by-category?category=" + encodeURIComponent(cat) + langParam(),
        { credentials: "omit", headers: { Accept: "application/json" } },
      )
        .then(function (r) {
          // 404 is "no such category", a content problem rather than an error —
          // the editor may hold one since renamed or deleted.
          if (!r.ok) return null;
          return r.json();
        })
        .catch(function () {
          return null;
        });
    }
    return hub.categoryFetches[key];
  }

  /**
   * Render the carousel for a CATEGORY rather than for the page's product.
   *
   * Deliberately its own path rather than a branch inside renderInto: that
   * function is built around a product `ref` and a list of sections, and a
   * static Industries page has neither. Threading "sometimes there is no
   * product" through it would put the product pages — the ones that actually
   * matter — at risk for the benefit of a second use case.
   */
  function renderCategoryInto(container, category, heading, onEmpty) {
    try {
      container.setAttribute("data-saeh-section", "compatible:category=" + category);
    } catch (e) {
      /* never break the host page */
    }
    if (!hub.api || !category) return onEmpty();
    return fetchByCategory(category).then(function (data) {
      try {
        var items = data && data.items;
        if (!items || !items.length) return onEmpty();
        var node = compatibleSection(items, heading);
        if (!node) return onEmpty();
        injectStyles();
        var root = stampLang(el("div", "saeh-root saeh-wide"));
        root.appendChild(node);
        container.innerHTML = "";
        container.appendChild(root);
      } catch (e) {
        /* never break the host page */
      }
    });
  }

  /* ------------------------------------------------- product listing -- */

  /**
   * The whole catalogue, memoised per page. One fetch however many listing
   * widgets are placed, and filtering happens in the browser — 96 products is
   * ~29KB, so a round trip per checkbox would be slower than the work it saves.
   */
  function fetchCatalogue() {
    // Keyed by language, like the other fetches. The query string starts
    // with "?" here — English sends no parameter at all.
    if (!hub.cataloguePromises) hub.cataloguePromises = {};
    var lk = currentLocale();
    if (!hub.cataloguePromises[lk]) {
      hub.cataloguePromises[lk] = fetch(hub.api + "/public/catalogue" + langParam().replace(/^&/, "?"), {
        credentials: "omit",
        headers: { Accept: "application/json" },
      })
        .then(function (r) {
          if (!r.ok) throw new Error("catalogue " + r.status);
          return r.json();
        })
        .catch(function () {
          return null;
        });
    }
    return hub.cataloguePromises[lk];
  }

  /**
   * Which category this page is for.
   *
   * ⚠️ Matched on SLUG, taken from the mirror, never derived from a title —
   * Duda renders "Oil & Gas" as `oil---gas`, so a derived slug would miss
   * exactly the categories with an ampersand and fail silently.
   *
   * Sources in order, the same shape as dudaPageProduct(): Duda's own page
   * data, then the /category/<slug> URL, then an explicit prop. Each is a
   * guess about a mechanism we cannot fully see, so the chain is what makes a
   * wrong guess cost a fallback rather than a redesign.
   */
  function resolveCategory(cats, props) {
    var bySlug = {};
    var byId = {};
    for (var i = 0; i < cats.length; i++) {
      bySlug[String(cats[i].slug).toLowerCase()] = cats[i];
      byId[cats[i].id] = cats[i];
    }

    var explicit = (props.category || "").trim().toLowerCase();
    if (explicit && bySlug[explicit]) return { cat: bySlug[explicit], from: "props" };

    try {
      var pd = hub.lastPageData;
      if (pd) {
        if (pd.identifier && byId[pd.identifier]) return { cat: byId[pd.identifier], from: "dmAPI" };
        var s = String(pd.seo_url || pd.page_item_url || "").toLowerCase();
        if (s && bySlug[s]) return { cat: bySlug[s], from: "dmAPI" };
      }
    } catch (e) {
      /* fall through to the URL */
    }

    try {
      var m = /\/category\/([^/?#]+)/.exec(window.location.pathname);
      if (m) {
        var fromUrl = decodeURIComponent(m[1]).toLowerCase();
        if (bySlug[fromUrl]) return { cat: bySlug[fromUrl], from: "url" };
      }
      var q = /[?&]category=([^&]+)/.exec(window.location.search);
      if (q) {
        var fromQuery = decodeURIComponent(q[1]).toLowerCase();
        if (bySlug[fromQuery]) return { cat: bySlug[fromQuery], from: "query" };
      }
    } catch (e) {
      /* never break the host page */
    }

    return { cat: null, from: "none" };
  }

  function productCard(p, chipTitles) {
    var a = document.createElement("a");
    a.className = "saeh-pl-card";
    a.href = localHref(p.url || "#");

    var shot = el("div", "saeh-pl-shot");
    if (p.imageUrl) {
      var img = document.createElement("img");
      img.src = p.imageUrl;
      // The card's own title is the accessible name, so a descriptive alt here
      // would have a screen reader announce the product twice.
      img.alt = "";
      img.setAttribute("loading", "lazy");
      shot.appendChild(img);
    }
    a.appendChild(shot);

    var body = el("div", "saeh-pl-body");
    if (chipTitles.length) {
      var chips = el("div", "saeh-pl-chips");
      chipTitles.forEach(function (t) {
        chips.appendChild(el("span", "saeh-pl-chip", t));
      });
      body.appendChild(chips);
    }
    body.appendChild(el("h4", "saeh-pl-name", p.name || ""));
    if (p.certs && p.certs.length) {
      /*
       * ⚠️ One span per certification, each `white-space:nowrap`, rather than
       * one joined string. A single text node lets the browser break wherever
       * it likes: "Zone 1-2" wrapped as "Zone" / "1-2", which reads as two
       * separate marks. Nowrap also covers the hyphen, which is its own break
       * opportunity — a non-breaking space would not have.
       *
       * The separator is its own text node, so the only break opportunity is
       * the space BETWEEN items and a comma never starts a line.
       */
      var certs = el("div", "saeh-pl-certs");
      p.certs.forEach(function (c, i) {
        if (i) certs.appendChild(document.createTextNode(", "));
        certs.appendChild(el("span", null, c));
      });
      body.appendChild(certs);
    }
    a.appendChild(body);
    var cta = el("span", "saeh-pl-btn");
    cta.appendChild(document.createTextNode(T("card.view")));
    var chev = el("span", "saeh-pl-chevwrap");
    chev.appendChild(doubleChevron());
    cta.appendChild(chev);
    a.appendChild(cta);
    return a;
  }

  /** A double chevron, drawn inline so it is present the instant hover starts. */
  function doubleChevron() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "19");
    svg.setAttribute("height", "19");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    ["M5 5l7 7-7 7", "M13 5l7 7-7 7"].forEach(function (d) {
      var path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2.5");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    });
    return svg;
  }

  /** The X in the search box — a plain stroked cross, not a glyph. */
  function closeIcon() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    ["M5 5l14 14", "M19 5L5 19"].forEach(function (d) {
      var path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    });
    return svg;
  }

  /**
   * Build the listing: a Site Challenges filter on the left, product grid right.
   *
   * ⚠️ The page's own category is a fixed BASE FILTER, not a checkbox. On
   * /category/lighting-and-power the grid only ever shows that category's
   * products, and the challenge options are derived from THAT set — so an
   * option is never offered that would return nothing. Industries and the
   * product taxonomy are deliberately absent from the sidebar: they are how you
   * arrived, not how you refine.
   */
  function productListSection(data, props) {
    var cats = (data && data.categories) || [];
    var products = (data && data.products) || [];
    if (!cats.length) return null;

    var byId = {};
    cats.forEach(function (c) {
      byId[c.id] = c;
    });

    var resolved = resolveCategory(cats, props);
    hub.lastInit.categoryFrom = resolved.from;
    hub.lastInit.category = resolved.cat ? resolved.cat.slug : null;

    /*
     * Everything under the page's category. A PARENT page (…/industries) scopes
     * to all of its children, since a product sits on the leaves; a leaf page
     * scopes to itself; no category at all means the whole catalogue.
     */
    var scopeIds = null;
    if (resolved.cat) {
      scopeIds = {};
      scopeIds[resolved.cat.id] = true;
      cats.forEach(function (c) {
        if (c.parentId === resolved.cat.id) scopeIds[c.id] = true;
      });
    }
    var base = scopeIds
      ? products.filter(function (p) {
          return (p.categoryIds || []).some(function (id) {
            return scopeIds[id];
          });
        })
      : products;

    // Which branch supplies the filter options. Configurable, because the tree
    // is expected to be reworked and a rename should not need a code change.
    // ⚠️ Matched on the SLUG first, then the ENGLISH title: on a translated
    // page `title` is in that language and would never equal "Site Challenges".
    var filterTitle = (props.filterGroup || "Site Challenges").toLowerCase();
    var filterParent = null;
    cats.forEach(function (c) {
      if (c.parentId !== "ROOT" || filterParent) return;
      if (String(c.slug || "").toLowerCase() === filterTitle) filterParent = c;
    });
    if (!filterParent) {
      cats.forEach(function (c) {
        if (c.parentId === "ROOT" && !filterParent && String(c.titleEn || c.title).toLowerCase() === filterTitle) filterParent = c;
      });
    }

    // Only options that actually appear in the base set — an option that could
    // only ever return nothing is noise, and a count of 0 invites a dead click.
    var options = [];
    if (filterParent) {
      var present = {};
      base.forEach(function (p) {
        (p.categoryIds || []).forEach(function (id) {
          present[id] = true;
        });
      });
      options = cats.filter(function (c) {
        return c.parentId === filterParent.id && present[c.id];
      });
    }

    var PAGE = 18;
    var shownCount = PAGE;
    /** How many cards are actually in the DOM — where an append resumes from. */
    var rendered = 0;
    var query = "";
    var chosen = {};

    var root = el("div", "saeh-pl");
    var side = el("div", "saeh-pl-side");
    var main = el("div", "saeh-pl-main");
    var head = el("div", "saeh-pl-head");
    var count = el("div", "saeh-pl-count");
    var grid = el("div", "saeh-pl-grid");
    var more = el("div", "saeh-pl-morewrap");

    /*
     * ⚠️ Created ONCE and reused, never rebuilt per paint.
     *
     * A re-created button loses focus, and refocusing the new one scrolled the
     * viewport down to it — a click focuses a button, so this fired on every
     * mouse click, not just keyboard use, and `.focus()` scrolls into view
     * unless told not to. Keeping the same node means there is no focus to
     * restore and nothing that can scroll. Only its count changes.
     */
    var moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "saeh-pl-more";
    // The label is a TEXT NODE and only the count a span, because
    // `.saeh-pl-more span` is what greys the count.
    moreBtn.appendChild(document.createTextNode(T("pl.loadMore")));
    var moreN = el("span", null, "");
    moreBtn.appendChild(moreN);
    moreBtn.addEventListener("click", function () {
      shownCount += PAGE;
      paint(true);
    });

    function showMore(remaining) {
      if (remaining > 0) {
        moreN.textContent = "+" + remaining;
        if (moreBtn.parentNode !== more) more.appendChild(moreBtn);
      } else if (moreBtn.parentNode) {
        moreBtn.parentNode.removeChild(moreBtn);
      }
    }
    head.appendChild(count);
    main.appendChild(head);
    main.appendChild(grid);
    main.appendChild(more);

    /** Searchable text: the name plus its category titles ("welding" finds it). */
    function haystack(p) {
      if (!p.__hay) {
        var titles = (p.categoryIds || [])
          .map(function (id) {
            return byId[id] ? byId[id].title : "";
          })
          .join(" ");
        // English too (`nameEn`/`titleEn`, once translated names arrive), so a
        // visitor on an Arabic page who types "heater" still finds it.
        var titlesEn = (p.categoryIds || [])
          .map(function (id) {
            return byId[id] && byId[id].titleEn ? byId[id].titleEn : "";
          })
          .join(" ");
        p.__hay = ((p.name || "") + " " + (p.nameEn || "") + " " + titles + " " + titlesEn).toLowerCase();
      }
      return p.__hay;
    }

    function matches(p) {
      if (query && haystack(p).indexOf(query) === -1) return false;
      var picked = options.filter(function (c) {
        return chosen[c.id];
      });
      if (!picked.length) return true;
      // OR within the group: ticking a second challenge widens.
      var ids = p.categoryIds || [];
      return picked.some(function (c) {
        return ids.indexOf(c.id) !== -1;
      });
    }

    /**
     * Render the grid.
     *
     * ⚠️ `append` is not an optimisation — it is what stops "load more"
     * throwing the visitor back to the top of the page. Emptying the grid
     * shrinks the document to almost nothing, the browser clamps scrollY to
     * the new maximum, and the cards appended a moment later cannot put the
     * scroll position back. Appending never shrinks the page, so there is
     * nothing to clamp. It also means the already-visible cards are not
     * re-created, so they do not replay their entry animation.
     *
     * Nothing here may move the viewport: loading more is not navigation.
     */
    function paint(append) {
      var shown = base.filter(matches);
      count.innerHTML = "";
      // The number stays bold wherever the language puts it.
      count.appendChild(
        fillNodes(fillText(pluralForm("pl.count", shown.length), { total: base.length }), {
          n: el("b", null, String(shown.length)),
        }),
      );

      if (!append) {
        grid.textContent = "";
        rendered = 0;
      }

      if (!shown.length) {
        showMore(0);
        grid.appendChild(el("p", "saeh-pl-empty", T("pl.empty")));
        return;
      }

      shown.slice(rendered, shownCount).forEach(function (p) {
        var chipTitles = filterParent
          ? (p.categoryIds || [])
              .map(function (id) {
                return byId[id];
              })
              .filter(function (c) {
                return c && c.parentId === filterParent.id;
              })
              .map(function (c) {
                return c.title;
              })
          : [];
        grid.appendChild(productCard(p, chipTitles));
      });
      rendered = Math.min(shownCount, shown.length);

      showMore(shown.length - rendered);
    }

    // --- the filter panel ---
    var filter = el("div", "saeh-pl-filter");

    /*
     * The panel heading. Hidden on mobile, where the toggle button carries the
     * same label — exactly one of the two is visible at any width, so the
     * label is never announced twice.
     */
    filter.appendChild(el("h6", "saeh-pl-title", T("pl.filter")));
    filter.appendChild(el("div", "saeh-pl-rule"));

    var search = el("div", "saeh-pl-search");
    var sid = "saeh-q" + Math.random().toString(36).slice(2, 9);
    // A real <label for>, so the accessible name is the visible one rather
    // than an aria-label nobody can see.
    var slabel = el("label", "saeh-pl-slabel", T("pl.searchLabel"));
    slabel.setAttribute("for", sid);
    // ⚠️ The input and its X get their OWN relative box. Positioning the X
    // against `.saeh-pl-search` would centre it on the label + input together,
    // so it would sit low.
    var sbox = el("div", "saeh-pl-sbox");
    var input = document.createElement("input");
    input.id = sid;
    input.type = "search";
    input.placeholder = T("pl.searchPh");
    var clearQ = document.createElement("button");
    clearQ.type = "button";
    clearQ.className = "saeh-pl-clearq";
    clearQ.setAttribute("aria-label", T("common.clearSearch"));
    clearQ.appendChild(closeIcon());

    /*
     * Runs on ENTER, not on every keystroke. Filtering as you type re-renders
     * the whole grid mid-word, which on a phone means the list jumping under
     * your thumb while the keyboard is open.
     */
    function runSearch() {
      query = input.value.trim().toLowerCase();
      shownCount = PAGE;
      clearQ.className = "saeh-pl-clearq" + (input.value ? " on" : "");
      paint();
      updateCounts();
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        runSearch();
      }
    });
    // The toggle only tracks whether the X should show; the search itself waits.
    input.addEventListener("input", function () {
      clearQ.className = "saeh-pl-clearq" + (input.value ? " on" : "");
    });
    clearQ.addEventListener("click", function () {
      input.value = "";
      runSearch();
      input.focus();
    });
    sbox.appendChild(input);
    sbox.appendChild(clearQ);
    search.appendChild(slabel);
    search.appendChild(sbox);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "saeh-pl-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.appendChild(el("span", null, T("pl.filter")));
    btn.appendChild(el("span", "saeh-pl-chev"));

    var panel = el("div", "saeh-pl-panel");
    var uid = "saeh-pl" + Math.random().toString(36).slice(2, 9);
    panel.id = uid;
    btn.setAttribute("aria-controls", uid);
    var clip = el("div", "saeh-pl-clip");
    var inner = el("div", "saeh-pl-inner");

    if (options.length) {
      var group = el("div", "saeh-pl-group");
      group.appendChild(el("div", "saeh-pl-glabel", filterParent.title));
      options.forEach(function (c) {
        var label = el("label", "saeh-pl-opt");
        var box = document.createElement("input");
        box.type = "checkbox";
        box.value = c.id;
        box.addEventListener("change", function () {
          if (box.checked) chosen[c.id] = true;
          else delete chosen[c.id];
          shownCount = PAGE;
          paint();
          updateCounts();
        });
        label.appendChild(box);
        label.appendChild(el("span", "saeh-pl-box"));
        label.appendChild(el("span", "saeh-pl-t", c.title));
        var n = el("span", "saeh-pl-n", "");
        n.setAttribute("data-for", c.id);
        label.appendChild(n);
        group.appendChild(label);
      });
      inner.appendChild(group);
    }

    /** How many would show if this option were added — never a static total. */
    function updateCounts() {
      var nodes = inner.querySelectorAll(".saeh-pl-n");
      for (var i = 0; i < nodes.length; i++) {
        var id = nodes[i].getAttribute("data-for");
        var was = !!chosen[id];
        chosen[id] = true;
        var n = base.filter(matches).length;
        if (!was) delete chosen[id];
        nodes[i].textContent = String(n);
      }
    }

    // Only when there is something to clear. A category with no challenges in
    // scope renders no options, and the button then sat alone in an empty panel
    // offering to undo nothing.
    if (options.length) {
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "saeh-pl-clear";
      clear.textContent = T("pl.clear");
      clear.addEventListener("click", function () {
        chosen = {};
        var boxes = inner.querySelectorAll("input[type=checkbox]");
        for (var i = 0; i < boxes.length; i++) boxes[i].checked = false;
        shownCount = PAGE;
        paint();
        updateCounts();
      });
      inner.appendChild(clear);
    }

    clip.appendChild(inner);
    panel.appendChild(clip);
    filter.appendChild(search);
    filter.appendChild(btn);
    filter.appendChild(panel);
    side.appendChild(filter);

    btn.addEventListener("click", function () {
      var open = panel.classList.toggle("saeh-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    paint();
    updateCounts();
    root.appendChild(side);
    root.appendChild(main);

    var sec = el("div", "saeh-section");
    sec.appendChild(root);
    return sec;
  }

  /** Render the listing. Its own path — there is no product to resolve here. */
  function renderListInto(container, props, onEmpty) {
    try {
      container.setAttribute("data-saeh-section", "product-list");
    } catch (e) {
      /* never break the host page */
    }
    if (!hub.api) return onEmpty();
    return fetchCatalogue().then(function (data) {
      try {
        var node = productListSection(data, props);
        if (!node) return onEmpty();
        injectStyles();
        var root = stampLang(el("div", "saeh-root saeh-wide"));
        root.appendChild(node);
        container.innerHTML = "";
        container.appendChild(root);
      } catch (e) {
        /* never break the host page */
      }
    });
  }

  /* ------------------------------------------------------- resources -- */

  /*
   * The content panel's `resourceType` → the API's type. A static dropdown
   * sends its value as a bare string; the plurals and labels are accepted too,
   * so a value typed into a text field still works. Anything else is "" —
   * unrecognised, so nothing is fetched.
   */
  var RESOURCE_TYPE_ALIASES = {
    datasheet: "datasheet", datasheets: "datasheet",
    manual: "manual", manuals: "manual", "user manual": "manual", "user manuals": "manual",
    certificate: "certificate", certificates: "certificate",
  };
  function resourceTypeOf(v) {
    if (v && typeof v === "object") v = v.value || v.id || "";
    var t = typeof v === "string" ? v.trim().toLowerCase() : "";
    return Object.prototype.hasOwnProperty.call(RESOURCE_TYPE_ALIASES, t) ? RESOURCE_TYPE_ALIASES[t] : "";
  }

  /**
   * A download button's label in the page's language. The server sends
   * `labelKey` (DATASHEET, MANUAL or the certificate scheme); certification
   * marks are names and stay as they are. A title fallback (two files sharing
   * a label) and a payload from before labelKey are shown as sent.
   */
  function resourceLabel(d) {
    if (d.labelKey && !d.labelFromTitle) {
      var k = "dl." + d.labelKey;
      if (I18N.en[k]) return T(k);
    }
    return d.label || d.title || T("dl.fallback");
  }

  /** What the search box says on each page — the placeholder and its hidden label. */
  var RESOURCE_SEARCH_KEY = {
    datasheet: "rs.search.datasheet",
    manual: "rs.search.manual",
    certificate: "rs.search.certificate",
  };

  /** One fetch per type per page, however many copies of the widget there are. */
  function fetchResources(type) {
    if (!hub.resourceFetches) hub.resourceFetches = {};
    var rk = type + ":" + currentLocale();
    if (!hub.resourceFetches[rk]) {
      hub.resourceFetches[rk] = fetch(hub.api + "/public/resources?type=" + encodeURIComponent(type) + langParam(), {
        credentials: "omit",
        headers: { Accept: "application/json" },
      })
        .then(function (r) {
          if (!r.ok) throw new Error("resources " + r.status);
          return r.json();
        })
        .catch(function () {
          return null;
        });
    }
    return hub.resourceFetches[rk];
  }

  /** A site-relative path from our own API, or "#" — never a scheme. */
  function sitePath(u) {
    return typeof u === "string" && u.charAt(0) === "/" && u.charAt(1) !== "/" ? u : "#";
  }

  /** Arrow into a tray, drawn inline like the chevrons. */
  function downloadIcon() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"].forEach(function (d) {
      var path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    });
    return svg;
  }

  /**
   * The rows. Built with textContent and attributes only — nothing from the
   * payload is ever parsed as HTML.
   *
   * ⚠️ Each download button opens `/public/downloads/<id>/file` in a NEW TAB,
   * which signs that one file when it is clicked. The list carries no file
   * URLs at all, so a page of 59 products signs nothing until someone asks.
   */
  function resourcesSection(data, heading, subheading, type) {
    var products = (data && data.products) || [];
    var sec = el("div", "saeh-section saeh-rs");
    var text = function (v) {
      return typeof v === "string" ? v.trim().slice(0, 120) : "";
    };
    var h = text(heading);
    var sub = text(subheading);
    var list = el("ul", "saeh-rs-list");
    // What each row's search matches against, by row.
    var haystacks = [];

    products.forEach(function (p) {
      var downloads = (p && p.downloads ? p.downloads : []).filter(function (d) {
        return d && typeof d.id === "string" && d.id;
      });
      if (!downloads.length) return;
      var url = localHref(sitePath(p.url));
      var name = p.name || "";

      var row = el("li", "saeh-rs-row");
      // The name, the range ("cyclone") and the buttons ("ukex"), so a
      // visitor can find a product by any of the words on its row.
      haystacks.push(
        [name, p.range && p.range.label ? p.range.label : ""]
          // Both the shown label and the English one, so "datasheet" or "ukex"
          // finds a row on any language's page.
          .concat(downloads.map(function (d) { return resourceLabel(d) + " " + (d.label || d.title || ""); }))
          .join(" ")
          .toLowerCase()
      );

      // The picture repeats the View Product link, so it is hidden from
      // assistive tech and the keyboard: one link per product, not two.
      var shot = document.createElement("a");
      shot.className = "saeh-rs-shot";
      shot.href = url;
      shot.tabIndex = -1;
      shot.setAttribute("aria-hidden", "true");
      if (p.imageUrl) {
        var img = document.createElement("img");
        img.src = p.imageUrl;
        img.alt = "";
        img.setAttribute("loading", "lazy");
        shot.appendChild(img);
      }
      row.appendChild(shot);

      var info = el("div", "saeh-rs-info");
      if (p.range && p.range.logoUrl) {
        var logo = document.createElement("img");
        logo.className = "saeh-rs-range";
        logo.src = p.range.logoUrl;
        logo.alt = p.range.label || "";
        logo.setAttribute("loading", "lazy");
        info.appendChild(logo);
      }
      info.appendChild(el("h4", "saeh-rs-name", name));
      var view = document.createElement("a");
      view.className = "saeh-rs-view";
      view.href = url;
      view.appendChild(document.createTextNode(T("card.view")));
      // Contains the visible label, so speech input still matches it.
      view.setAttribute("aria-label", T("card.viewAria", { name: name }));
      view.appendChild(doubleChevron());
      info.appendChild(view);
      row.appendChild(info);

      var dls = el("div", "saeh-rs-dls");
      downloads.forEach(function (d) {
        var label = resourceLabel(d);
        var a;
        if (d.gated) {
          // Gated: a button that opens the request form. The file is only
          // ever signed after the visitor's details are stored.
          a = document.createElement("button");
          a.type = "button";
          a.className = "saeh-rs-dl";
          a.setAttribute("aria-haspopup", "dialog");
          // Starts with the visible label, so speech input still matches it.
          a.setAttribute("aria-label", T("rs.ariaGated", { label: label, name: name }));
          (function (btn, id) {
            btn.addEventListener("click", function () {
              openRequestForm({ id: id, product: name, label: label, opener: btn });
            });
          })(a, d.id);
        } else {
          a = document.createElement("a");
          a.className = "saeh-rs-dl";
          a.href = hub.api + "/public/downloads/" + encodeURIComponent(d.id) + "/file";
          a.target = "_blank";
          a.rel = "noopener";
          a.setAttribute("aria-label", T("rs.ariaFile", { label: label, name: name }));
        }
        a.appendChild(downloadIcon());
        a.appendChild(document.createTextNode(label));
        dls.appendChild(a);
      });
      row.appendChild(dls);
      list.appendChild(row);
    });

    if (!list.children.length) return null;

    // Shown in place of the list when a search matches nothing.
    var none = el("p", "saeh-pl-empty saeh-rs-none saeh-rs-off");
    var top = el("div", "saeh-rs-top");
    // The subheading (h6) sits above the heading (h2), the pair on the left.
    if (h || sub) {
      var heads = el("div", "saeh-rs-heads");
      if (sub) heads.appendChild(el("h6", "saeh-rs-sub", sub));
      if (h) heads.appendChild(el("h2", "saeh-rs-h", h));
      top.appendChild(heads);
    }
    top.appendChild(resourcesSearch(list, haystacks, none, type));
    sec.appendChild(top);
    sec.appendChild(list);
    sec.appendChild(none);
    return sec;
  }

  /**
   * The search box above the list, built like the listing widget's: the same
   * field and X, and the same ENTER-to-search rule —
   * filtering on every keystroke makes the list jump under your thumb on a
   * phone while the keyboard is open.
   *
   * Rows are hidden, not rebuilt, so their images are not fetched again.
   */
  function resourcesSearch(list, haystacks, none, type) {
    var says = T(Object.prototype.hasOwnProperty.call(RESOURCE_SEARCH_KEY, type) ? RESOURCE_SEARCH_KEY[type] : "rs.search.default");
    var rows = list.children;
    var wrap = el("div", "saeh-rs-search");
    var sid = "saeh-rq" + Math.random().toString(36).slice(2, 9);
    // Not shown, but still a real <label for>: the field keeps an accessible
    // name without a visible caption above it.
    var label = el("label", "saeh-rs-sr", says);
    label.setAttribute("for", sid);
    var sbox = el("div", "saeh-pl-sbox");
    var input = document.createElement("input");
    input.id = sid;
    input.type = "search";
    input.placeholder = says + "...";
    var clearQ = document.createElement("button");
    clearQ.type = "button";
    clearQ.className = "saeh-pl-clearq";
    clearQ.setAttribute("aria-label", T("common.clearSearch"));
    clearQ.appendChild(closeIcon());
    var status = el("div", "saeh-rs-sr");
    status.setAttribute("role", "status");

    function run() {
      var q = input.value.trim().toLowerCase().replace(/\s+/g, " ");
      var shown = 0;
      for (var i = 0; i < rows.length; i++) {
        var hit = !q || haystacks[i].indexOf(q) !== -1;
        rows[i].className = "saeh-rs-row" + (hit ? "" : " saeh-rs-off");
        if (hit) shown++;
      }
      clearQ.className = "saeh-pl-clearq" + (input.value ? " on" : "");
      none.textContent = shown ? "" : T("rs.noMatch", { q: input.value.trim() });
      none.className = "saeh-pl-empty saeh-rs-none" + (shown ? " saeh-rs-off" : "");
      status.textContent = !q ? "" : shown ? TP("rs.found", shown) : T("rs.notFound");
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        run();
      }
    });
    // Only the X tracks typing; the search itself waits for Enter.
    input.addEventListener("input", function () {
      clearQ.className = "saeh-pl-clearq" + (input.value ? " on" : "");
    });
    clearQ.addEventListener("click", function () {
      input.value = "";
      run();
      input.focus();
    });

    sbox.appendChild(input);
    sbox.appendChild(clearQ);
    wrap.appendChild(label);
    wrap.appendChild(sbox);
    wrap.appendChild(status);
    return wrap;
  }

  /* ------------------------------------------- resource request form -- */

  /*
   * ⚠️ The two checkbox sentences must match CONSENT_TEXT in the backend's
   * services/downloadKinds.ts WORD FOR WORD — the server records its own copy
   * as what the visitor agreed to. `widget:test` compares the two.
   */
  // The wording itself lives in I18N (rq.*), per language.
  var RQ_PRIVACY_URL = "/privacy-policy";
  // The server's own rule, so a number it would refuse is caught here first.
  var RQ_PHONE = /^[0-9+()\-.\s]+$/;
  // A plain shape check on the FOLDED value (see asciiForm); the server's own
  // validator has the final say.
  var EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  /**
   * Arabic and Chinese keyboards type Arabic-Indic (٠-٩, ۰-۹) and full-width
   * (０-９, ＋, ＠) characters. Folded to ASCII here exactly as the server folds
   * them, so what is checked is what is sent.
   */
  function asciiForm(v) {
    var s = String(v || "");
    try {
      s = s.normalize("NFKC");
    } catch (e) {
      /* very old browser */
    }
    return s
      .replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
      .replace(/[\u06f0-\u06f9]/g, function (c) { return String(c.charCodeAt(0) - 0x06f0); });
  }
  function phoneOk(v) {
    return RQ_PHONE.test(v) && (v.match(/[0-9]/g) || []).length >= 6;
  }

  function closeIcon20() {
    var svg = closeIcon();
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    return svg;
  }

  /**
   * The "File Requests" form for one gated download, as a modal.
   *
   * Asked for EVERY download (decided 2026-10-05) — nothing is remembered
   * between requests, and every field starts empty.
   *
   * ⚠️ "Submit & Download" opens the new tab SYNCHRONOUSLY, inside the click,
   * and points it at the file once the server answers. Opening it after the
   * request returns would be a window.open outside a user gesture, which
   * every popup blocker stops. If the browser blocks it anyway, the success
   * message carries an "open your file" link, which is a real click.
   *
   * No close on a backdrop click, deliberately: a stray click must not throw
   * away six typed fields. Escape and the X close it; focus is held inside
   * while open and handed back to the button afterwards.
   */
  function openRequestForm(opts) {
    injectStyles();
    var openedAt = Date.now();
    var uid = "saeh-rq" + Math.random().toString(36).slice(2, 9);

    var overlay = stampLang(el("div", "saeh-rq-overlay"));
    var sheet = el("div", "saeh-rq-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", uid + "-h");
    overlay.appendChild(sheet);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "saeh-rq-close";
    closeBtn.setAttribute("aria-label", T("rq.close"));
    closeBtn.appendChild(closeIcon20());
    sheet.appendChild(closeBtn);

    var h = el("h2", "saeh-rq-h", T("rq.heading"));
    h.id = uid + "-h";
    sheet.appendChild(h);
    // The product name is isolated (<bdi>), so an English name inside Arabic
    // text keeps its own order.
    var fileLine = el("p", "saeh-rq-file");
    fileLine.appendChild(el("bdi", null, opts.product));
    if (opts.label) fileLine.appendChild(document.createTextNode(" - " + opts.label));
    sheet.appendChild(fileLine);
    var body = el("div", "saeh-rq-body");
    sheet.appendChild(body);

    var form = document.createElement("form");
    form.noValidate = true; // our own messages, on the field they belong to
    form.appendChild(el("p", "saeh-rq-p", T("rq.intro")));

    var grid = el("div", "saeh-rq-grid");
    var fields = {};
    // name, label, type, autocomplete, required, the "missing" message
    [
      ["firstName", T("rq.f.firstName"), "text", "given-name", true, T("rq.req.firstName")],
      ["lastName", T("rq.f.lastName"), "text", "family-name", true, T("rq.req.lastName")],
      ["company", T("rq.f.company"), "text", "organization", true, T("rq.req.company")],
      ["email", T("rq.f.email"), "email", "email", true, T("rq.req.email")],
      ["phone", T("rq.f.phone"), "tel", "tel", true, T("rq.req.phone")],
      ["mobile", T("rq.f.mobile"), "tel", "mobile tel", false, ""],
    ].forEach(function (f) {
      var wrap = el("div", "saeh-rq-field");
      var id = uid + "-" + f[0];
      var lab = el("label", "saeh-rq-label", f[1]);
      lab.setAttribute("for", id);
      if (!f[4]) lab.appendChild(el("span", "saeh-rq-opt", " " + T("rq.optional")));
      var inp = document.createElement("input");
      inp.className = "saeh-rq-in";
      inp.id = id;
      inp.name = f[0];
      inp.type = f[2];
      inp.setAttribute("autocomplete", f[3]);
      inp.maxLength = f[0] === "email" ? 254 : f[0] === "company" ? 200 : f[2] === "tel" ? 50 : 100;
      if (f[4]) inp.required = true;
      // Addresses and numbers read left-to-right in every language.
      if (f[2] === "email" || f[2] === "tel") inp.setAttribute("dir", "ltr");
      var err = el("p", "saeh-rq-err");
      err.id = id + "-err";
      err.hidden = true;
      wrap.appendChild(lab);
      wrap.appendChild(inp);
      wrap.appendChild(err);
      grid.appendChild(wrap);
      fields[f[0]] = { input: inp, err: err, missing: f[5] };
    });
    form.appendChild(grid);

    // Honeypot: off-screen, out of the tab order, ignored by assistive tech.
    var hp = el("div", "saeh-hp");
    hp.setAttribute("aria-hidden", "true");
    var hpIn = document.createElement("input");
    hpIn.type = "text";
    hpIn.name = "website";
    hpIn.tabIndex = -1;
    hpIn.setAttribute("autocomplete", "off");
    hp.appendChild(hpIn);
    form.appendChild(hp);

    // The checkboxes reuse the listing's filter checkbox, so the site has one.
    function checkbox(name, build) {
      var lab = el("label", "saeh-pl-opt");
      var inp = document.createElement("input");
      inp.type = "checkbox";
      inp.name = name;
      lab.appendChild(inp);
      lab.appendChild(el("span", "saeh-pl-box"));
      var t = el("span", "saeh-pl-t");
      build(t);
      lab.appendChild(t);
      return { label: lab, input: inp };
    }
    var checks = el("div", "saeh-rq-checks");
    var privacy = checkbox("privacyConsent", function (t) {
      // A template, so the link can sit wherever the language puts it.
      var a = document.createElement("a");
      a.href = localHref(RQ_PRIVACY_URL);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = T("rq.privacyLink");
      t.appendChild(fillNodes(T("rq.privacy"), { link: a }));
    });
    privacy.input.required = true;
    var privacyErr = el("p", "saeh-rq-err");
    privacyErr.id = uid + "-privacy-err";
    privacyErr.hidden = true;
    var marketing = checkbox("marketingConsent", function (t) {
      t.appendChild(document.createTextNode(T("rq.marketing")));
    });
    checks.appendChild(privacy.label);
    checks.appendChild(privacyErr);
    checks.appendChild(marketing.label);
    form.appendChild(checks);

    var submit = el("button", "saeh-rq-submit", T("rq.submit"));
    submit.type = "submit";
    form.appendChild(submit);
    var msg = el("p", "saeh-rq-msg");
    msg.setAttribute("role", "alert");
    form.appendChild(msg);
    body.appendChild(form);

    function setErr(f, text) {
      f.err.textContent = text || "";
      f.err.hidden = !text;
      if (text) {
        f.input.setAttribute("aria-invalid", "true");
        f.input.setAttribute("aria-describedby", f.err.id);
      } else {
        f.input.removeAttribute("aria-invalid");
        f.input.removeAttribute("aria-describedby");
      }
    }
    function setPrivacyErr(text) {
      privacyErr.textContent = text || "";
      privacyErr.hidden = !text;
      if (text) privacy.input.setAttribute("aria-describedby", privacyErr.id);
      else privacy.input.removeAttribute("aria-describedby");
    }

    /** Returns the first field in error, or null. */
    function validate() {
      var first = null;
      Object.keys(fields).forEach(function (k) {
        var f = fields[k];
        var v = f.input.value.trim();
        if (k === "email" || k === "phone" || k === "mobile") v = asciiForm(v);
        var text = "";
        if (f.input.required && !v) text = f.missing;
        else if (v && k === "email" && !EMAIL_OK.test(v)) text = T("rq.badEmail");
        else if (v && (k === "phone" || k === "mobile") && !phoneOk(v)) text = T("rq.badPhone");
        setErr(f, text);
        if (text && !first) first = f.input;
      });
      if (!privacy.input.checked) {
        setPrivacyErr(T("rq.needPrivacy"));
        if (!first) first = privacy.input;
      } else setPrivacyErr("");
      return first;
    }

    function showDone(fileUrl, opened) {
      body.innerHTML = "";
      body.appendChild(el("p", "saeh-rq-done", opened ? T("rq.doneOpening") : T("rq.doneReady")));
      var link = document.createElement("a");
      link.className = "saeh-rs-dl saeh-rq-link";
      link.href = fileUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.appendChild(downloadIcon());
      link.appendChild(document.createTextNode(opened ? T("rq.openAgain") : T("rq.openFile")));
      body.appendChild(link);
      var again = el("p", "saeh-rq-again");
      again.appendChild(document.createTextNode(T("rq.linkValid") + " "));
      var done = document.createElement("button");
      done.type = "button";
      done.textContent = T("rq.close");
      done.addEventListener("click", close);
      again.appendChild(done);
      body.appendChild(again);
      link.focus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.textContent = "";
      var bad = validate();
      if (bad) {
        bad.focus();
        return;
      }
      // Inside the click: see the note above about popup blockers.
      var tab = null;
      try {
        tab = window.open("", "_blank");
        if (tab) {
          tab.opener = null;
          try {
            tab.document.title = T("rq.preparing");
            tab.document.body.textContent = T("rq.preparing");
          } catch (err) {
            /* a cross-origin blank tab is fine — it is only a placeholder */
          }
        }
      } catch (err) {
        tab = null;
      }
      var closeTab = function () {
        try {
          if (tab) tab.close();
        } catch (err) {
          /* already gone */
        }
      };

      submit.disabled = true;
      submit.textContent = T("rq.sending");
      var payload = {
        firstName: fields.firstName.input.value.trim(),
        lastName: fields.lastName.input.value.trim(),
        company: fields.company.input.value.trim(),
        email: asciiForm(fields.email.input.value.trim()),
        phone: asciiForm(fields.phone.input.value.trim()),
        mobile: asciiForm(fields.mobile.input.value.trim()),
        privacyConsent: privacy.input.checked,
        marketingConsent: marketing.input.checked,
        website: hpIn.value,
        elapsedMs: Date.now() - openedAt,
        // The language the form was shown in: the server records the consent
        // wording in this language, as what the visitor agreed to.
        locale: currentLocale(),
      };
      fetch(hub.api + "/public/downloads/" + encodeURIComponent(opts.id) + "/lead", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          hub.lastRequestStatus = r.status; // console diagnostics; no personal data
          return r.json().then(
            function (j) { return { status: r.status, body: j || {} }; },
            function () { return { status: r.status, body: {} }; }
          );
        })
        .then(function (res) {
          var b = res.body;
          if (res.status === 201 && b.ok && typeof b.fileUrl === "string" && /^https:\/\//.test(b.fileUrl)) {
            var opened = false;
            if (tab) {
              try {
                tab.location.replace(b.fileUrl);
                opened = true;
              } catch (err) {
                closeTab();
              }
            }
            showDone(b.fileUrl, opened);
            return;
          }
          closeTab();
          if (res.status === 400 && b.fields) {
            Object.keys(b.fields).forEach(function (k) {
              if (fields[k]) setErr(fields[k], T("rq.checkField"));
              if (k === "privacyConsent") setPrivacyErr(T("rq.needPrivacy"));
            });
          }
          // ⚠️ By STATUS, never the server's own text: that is English, and a
          // limiter answers with a code ("rate_limited") no visitor should see.
          msg.textContent =
            res.status === 400 ? T("rq.err.400")
            : res.status === 404 ? T("rq.err.404")
            : res.status === 429 ? T("rq.err.429")
            : res.status === 502 ? T("rq.err.502")
            : T("rq.err.generic");
        })
        .catch(function () {
          closeTab();
          msg.textContent = T("rq.err.network");
        })
        .then(function () {
          submit.disabled = false;
          submit.textContent = T("rq.submit");
        });
    });

    // ---- open / close, focus, scroll lock
    var prevOverflow = document.documentElement.style.overflow;
    function focusables() {
      return [].slice.call(sheet.querySelectorAll("a[href],button:not([disabled]),input:not([tabindex='-1'])"));
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    function close() {
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.overflow = prevOverflow;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      try {
        if (opts.opener && opts.opener.focus) opts.opener.focus();
      } catch (e) {
        /* the button may have been re-rendered away */
      }
    }
    closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", onKey, true);
    document.documentElement.style.overflow = "hidden";
    document.body.appendChild(overlay);
    fields.firstName.input.focus();
    return overlay;
  }

  /**
   * Render a resources page. Its own path: like the listing, it belongs to a
   * page rather than a product, so there is nothing to resolve.
   *
   * In the editor an empty or unconfigured widget shows a placeholder saying
   * what to do, rather than nothing — an empty box cannot be found to select.
   * Live, it collapses like every other empty section.
   */
  function renderResourcesInto(container, type, heading, subheading, inEditor, onEmpty) {
    try {
      // ⚠️ The type goes in its OWN attribute. `data-saeh-section` is what
      // init() reads first on a re-init, so it must stay exactly "resources".
      container.setAttribute("data-saeh-resource-type", type || "");
    } catch (e) {
      /* never break the host page */
    }
    var show = function (node) {
      injectStyles();
      var root = stampLang(el("div", "saeh-root saeh-wide"));
      root.appendChild(node);
      container.innerHTML = "";
      container.appendChild(root);
    };
    var placeholder = function (msg) {
      if (!inEditor) return onEmpty();
      show(el("div", "saeh-rs-ph", msg));
    };
    if (!hub.api) return onEmpty();
    if (!type) {
      return placeholder("Resources list - choose Datasheets, User Manuals or Certificates in this widget's content panel.");
    }
    return fetchResources(type).then(function (data) {
      try {
        var node = resourcesSection(data, heading, subheading, type);
        if (!node) {
          return placeholder(data ? "No products have a file of this type yet." : "The resources list could not be loaded.");
        }
        show(node);
      } catch (e) {
        /* never break the host page */
      }
    });
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
      /*
       * Recorded UNCONDITIONALLY, not just inside the tag-mode branch.
       *
       * When tag mode did not engage, the interesting question is always "did
       * the shim actually send singlePage?" — and recording it only after the
       * branch is taken answers that exactly when it no longer needs asking.
       * A stale script and a shim that never passed the value produced
       * identical console output, which cost a round trip to tell apart.
       *
       * `propKeys` is the giveaway: a shim that was never updated has no
       * singlePage/productCategory keys at all, whereas an updated one that simply
       * has nothing selected shows the keys holding empty values.
       */
      propKeys: (function () {
        try {
          return Object.keys(props);
        } catch (e) {
          return null;
        }
      })(),
      singlePage: props.singlePage,
      productCategory: props.productCategory,
    };
    /*
     * The page's language. `props.locale` is an override for tests and odd
     * embeds; a valid one wins. Recorded with every signal the page gave, so
     * "why is this widget in English?" is one console read:
     * __saequipHub.lastInit.localeFrom / .localeSignals.
     */
    try {
      var forced = normaliseLocale(props.locale);
      if (forced && I18N[forced]) LANG = { locale: forced, raw: String(props.locale), from: "props" };
      currentLocale();
      record.locale = LANG.locale;
      record.localeFrom = LANG.from;
      record.localeSignals = {
        html: document.documentElement.getAttribute("lang"),
        parameters: window.Parameters ? window.Parameters.currentLocale : undefined,
        prop: props.locale,
        prefix: sitePrefix(),
      };
    } catch (e) {
      /* never break the host page */
    }
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

      /*
       * Static-page mode: the Industries pages are not dynamic pages, so there
       * is no product to resolve and the carousel is driven by a tag chosen in
       * the content panel instead.
       *
       * `singlePage` gates this rather than "productCategory is set", so one left
       * selected from earlier experimentation cannot quietly take over a
       * product page. The two are checked together because a tag-mode widget
       * with no tag has nothing to show.
       */
      /*
       * ⚠️ Generous on purpose. Duda's content panel does not promise a
       * literal boolean for a checkbox, and a strict `=== true` reads "true",
       * 1 and "1" as OFF — silently, and in the one place where Duda's OWN
       * "Show if: singlePage is true" rule was simultaneously evaluating the
       * same value as ON. That contradiction (the dropdown visible in the
       * panel, the widget insisting the box was unticked) is what this exists
       * to make impossible.
       *
       * The shim must pass `data.singlePage` RAW for this to help — a shim
       * that narrows it to a boolean first throws the information away before
       * it ever arrives. See DUDA-WIDGETS in CLAUDE.md.
       */
      /*
       * The listing is a CATEGORY-page widget: there is no product to resolve,
       * so it branches out before any of the product identity work below.
       */
      /*
       * The Datasheets / User Manuals / Certificates pages. Static pages, no
       * product — `resourceType` from the content panel says which list.
       */
      if (sectionName === "resources") {
        var resourceType = resourceTypeOf(props.resourceType);
        hub.lastInit.mode = "resources";
        hub.lastInit.resourceType = resourceType || null;
        // RAW, before coercion: what Duda actually sent, for when it is not
        // what the dropdown appears to say.
        hub.lastInit.resourceTypeRaw = props.resourceType;
        renderResourcesInto(container, resourceType, props.heading, props.subheading, inEditor, onEmpty);
        return;
      }

      if (sectionName === "product-list") {
        hub.lastInit.mode = "product-list";
        dudaPageProduct().then(function (pd) {
          // Stashed for resolveCategory(): on a category page this is the
          // category's own row, not a product's.
          hub.lastPageData = pd || null;
          renderListInto(container, props, onEmpty);
        });
        return;
      }

      var singlePage = truthyProp(props.singlePage);
      /*
       * Duda's dynamic dropdown documents `value` as the thing embedded into
       * the widget, but the panel builds each option as {value,label} and a
       * loader handing the whole option through is entirely plausible. A bare
       * `typeof === "string"` check turns that into an empty tag, which is
       * indistinguishable from "nothing selected": the widget collapses and
       * the live page shows nothing while the editor's dropdown clearly has a
       * tag in it. Accept both shapes rather than depend on which one arrives.
       */
      var rawCat = props.productCategory;
      if (rawCat && typeof rawCat === "object") rawCat = rawCat.value || rawCat.id || "";
      var productCategory = typeof rawCat === "string" ? rawCat.trim() : "";
      if (singlePage) {
        hub.lastInit.mode = "category";
        hub.lastInit.productCategory = productCategory;
        renderCategoryInto(container, productCategory, props.heading, onEmpty);
        return;
      }

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
  /*
   * ⚠️ `%BUILD%` is replaced with a hash of this file's bytes by the route that
   * serves it (routes/public.ts). Do not "fix" it to a literal.
   *
   * The hand-written half is for humans; the hash is what makes the marker
   * trustworthy. A hand-maintained version only tells you which build you have
   * if it is bumped in the same commit as every change — and when it was not,
   * a cached older copy reported the SAME string as the current one, which is
   * precisely the question the marker exists to answer. Read from disk (tests,
   * a local file) it stays the literal `%BUILD%`, which is itself a useful
   * signal: it means nothing served it.
   */
  var iface = { init: init, clean: clean, version: "2026-10-02-resources+%BUILD%" };
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

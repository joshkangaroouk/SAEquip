/* =============================================================================
   SAEquip — Add to Quote widget
   Self-contained: bundles the shared quote store (idempotent). No head HTML.
   Languages (2026-10-07): the fixed text below is in the page's language, and
   each line keeps Duda's product and choice ids so the basket can show it in
   whichever language the visitor switches to. The button's own label is a
   content-panel field, which Duda translates itself.
   Markup: #atq-btn #atq-error #atq-count-num #atq-qty + .atq-qty-inc/.atq-qty-dec
   ============================================================================= */

/* >>> shared quote code (duda-widgets/quote-shared.js) */
/* ── Shared quote store + languages (identical in every quote widget) ───────────
   ⚠️ This block is COPIED into all three quote widgets by
   scripts/build-quote-widgets.mjs, from duda-widgets/quote-shared.js. Edit it
   there, never in one widget, or the three drift apart.

   The STORE keeps the basket in localStorage, which every language of the site
   shares — that is right: a visitor who switches to French keeps their basket.
   Since v2 each line also keeps Duda's ids (the product's, and each chosen
   option's choice), which are the same in every language, so a line added on
   the English page reads in French on /fr/ and links to the French page. Lines
   saved before v2 have no ids and show as they were added.

   v2 REPLACES an older copy of the store (one still inside a widget not yet
   updated), so whichever widget's code runs first, lines keep their ids. The
   saved basket format is unchanged apart from the extra fields. */
(function () {
  'use strict';
  if (window.SAEquipQuote && window.SAEquipQuote.v >= 2) return;

  var KEY   = 'saequip_quote_basket';
  var EVENT = 'saequip:quote-updated';
  var store = window.localStorage;

  function read() {
    try { var b = JSON.parse(store.getItem(KEY) || '[]'); return Array.isArray(b) ? b : []; }
    catch (e) { return []; }
  }
  function write(basket) {
    store.setItem(KEY, JSON.stringify(basket));
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { basket: basket } }));
    return basket;
  }
  function sortedKey(obj) {
    obj = obj || {};
    return JSON.stringify(Object.keys(obj).sort().reduce(function (a, k) { a[k] = obj[k]; return a; }, {}));
  }
  /* The same line: by ids when both have them (whatever language each was
     added in), otherwise by the text, as before v2. */
  function sameLine(e, item) {
    if (e.dudaId && item.dudaId) return e.dudaId === item.dudaId && sortedKey(e.choices) === sortedKey(item.choices);
    return e.name === item.name && e.sku === item.sku && sortedKey(e.options) === sortedKey(item.options);
  }

  window.SAEquipQuote = {
    v: 2, KEY: KEY, EVENT: EVENT, get: read,
    count: function () { return read().reduce(function (n, e) { return n + (parseInt(e.quantity, 10) || 1); }, 0); },
    add: function (item) {
      var basket = read();
      var existing = basket.find(function (e) { return sameLine(e, item); });
      if (existing) {
        existing.quantity = (parseInt(existing.quantity, 10) || 1) + (parseInt(item.quantity, 10) || 1);
        existing.addedAt  = new Date().toISOString();
      } else {
        var line = {
          name:  item.name || '', sku: item.sku || '', options: item.options || {},
          price: item.price || '', image: item.image || '', url: item.url || '',
          quantity: parseInt(item.quantity, 10) || 1, addedAt: new Date().toISOString()
        };
        if (item.dudaId) line.dudaId = item.dudaId;
        if (item.slug) line.slug = item.slug;
        if (item.choices && Object.keys(item.choices).length) line.choices = item.choices;
        basket.push(line);
      }
      return write(basket);
    },
    setQuantity: function (index, qty) {
      var basket = read();
      if (!basket[index]) return basket;
      qty = parseInt(qty, 10);
      basket[index].quantity = (isNaN(qty) || qty < 1) ? 1 : qty;
      return write(basket);
    },
    remove: function (index) {
      var basket = read();
      if (index < 0 || index >= basket.length) return basket;
      basket.splice(index, 1);
      return write(basket);
    },
    clear: function () { return write([]); },
    onChange: function (cb) {
      document.addEventListener(EVENT, function (e) { cb(e.detail && e.detail.basket ? e.detail.basket : read()); });
      window.addEventListener('storage', function (e) { if (e.key === KEY) cb(read()); });
    }
  };
})();

/* ── Languages ────────────────────────────────────────────────────────────────
   The page's language, links that keep it, and basket lines shown in it. The
   names come from our API (/public/quote-labels), which serves Duda's own
   translations — so a line reads exactly as Duda's product page does. Any
   failure shows the line as it was saved: the basket never breaks over this. */
(function () {
  'use strict';
  if (window.SAEquipQuoteI18n && window.SAEquipQuoteI18n.v >= 1) return;

  var API = 'https://sa-equip-backend.vercel.app/public/quote-labels';
  var LOCALES = ['en', 'ar', 'zh', 'fr', 'de', 'pt-br', 'es'];
  var LANG_TAG = { en: 'en', ar: 'ar', zh: 'zh-Hans', fr: 'fr', de: 'de', 'pt-br': 'pt-BR', es: 'es' };

  function normalise(raw) {
    if (typeof raw !== 'string') return null;
    var t = raw.trim().toLowerCase().replace(/_/g, '-');
    if (!t) return null;
    if (t === 'zh-tw' || t === 'zh-hk' || t === 'zh-mo' || t.indexOf('zh-hant') === 0) return null;
    var base = t.split('-')[0];
    if (base === 'pt') return 'pt-br';
    return LOCALES.indexOf(base) !== -1 ? base : null;
  }
  function pageLang() {
    var h = '';
    try { h = document.documentElement.getAttribute('lang') || ''; } catch (e) {}
    if (!h && window.Parameters && window.Parameters.currentLocale) h = String(window.Parameters.currentLocale);
    return h;
  }
  /** Ours: "en", "fr", "pt-br"… English for anything we do not translate. */
  function locale() { return normalise(pageLang()) || 'en'; }

  /* The page's language prefix ("/fr"), copied from the URL — never built — and
     only when the first segment matches the page's language, so a page such
     as /aviation is never taken for one. "" on the default language. */
  function prefix() {
    var raw = pageLang().toLowerCase().split(/[-_]/)[0];
    if (!raw) return '';
    var m = /^\/([a-z]{2,3}(?:-[a-z0-9]{2,8})?)(?=\/|$)/i.exec(window.location.pathname || '');
    return m && m[1].toLowerCase().split('-')[0] === raw ? '/' + m[1] : '';
  }
  /** "/product/x" → "/fr/product/x" on a French page; anything else untouched. */
  function href(path) {
    if (typeof path !== 'string' || path.charAt(0) !== '/' || path.charAt(1) === '/') return path;
    var p = prefix();
    if (!p || path === p || path.indexOf(p + '/') === 0) return path;
    return p + path;
  }

  /* One fetch per language per visit, kept for the session. */
  var memo = {};
  function labels() {
    var lang = locale();
    if (memo[lang]) return memo[lang];
    var key = 'saequip_quote_labels_' + lang;
    try {
      var c = JSON.parse(window.sessionStorage.getItem(key) || 'null');
      if (c && c.v && Date.now() - c.t < 10 * 60 * 1000) return (memo[lang] = Promise.resolve(c.v));
    } catch (e) {}
    memo[lang] = window.fetch(API + (lang === 'en' ? '' : '?lang=' + encodeURIComponent(lang)))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (v && v.products) {
          try { window.sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
          return v;
        }
        return null;
      })
      .catch(function () { return null; });
    return memo[lang];
  }

  function slugOf(item) {
    if (item.slug) return item.slug;
    var m = /\/product\/([^\/?#]+)/.exec(String(item.url || ''));
    return m ? decodeURIComponent(m[1]) : '';
  }
  /** slug → product id. Lines saved before v2 are found by the slug in their link. */
  function bySlug(L) {
    if (!L._bySlug) {
      L._bySlug = {};
      Object.keys(L.products || {}).forEach(function (id) { var p = L.products[id]; if (p && p.slug) L._bySlug[p.slug] = id; });
    }
    return L._bySlug;
  }

  /** A line's name, link, options and product id as THIS page should show them. */
  function view(item, L) {
    var slug = slugOf(item);
    var id = item.dudaId || (L && slug && bySlug(L)[slug]) || '';
    var p = L && id && L.products ? L.products[id] : null;
    var options = item.options || {};
    if (L && item.choices) {
      var mapped = {}, complete = true;
      Object.keys(item.choices).forEach(function (o) {
        var n = L.options && L.options[o], v = L.choices && L.choices[item.choices[o]];
        if (n && v) mapped[n] = v; else complete = false;
      });
      if (complete && Object.keys(mapped).length) options = mapped;
    }
    var path = (p && p.slug) || slug ? href('/product/' + encodeURIComponent((p && p.slug) || slug)) : '';
    return {
      name: (p && p.name) || item.name,
      url: path ? window.location.origin + path : item.url,
      options: options,
      dudaId: id
    };
  }

  /** A string from a widget's own table, in the page's language, {name} filled. */
  function t(table, key, vars) {
    var lang = locale();
    var s = (table[lang] && table[lang][key]) || table.en[key] || key;
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : s;
  }

  /* Translate a widget's own fixed text, and keep its site links in the page's
     language: data-qi18n (text), data-qi18n-aria (aria-label),
     data-qi18n-ph (placeholder). Duda translates the content-panel fields
     itself; these are the words written into the widget's code. */
  function apply(root, table) {
    if (!root) return;
    var lang = locale();
    if (lang !== 'en') {
      Array.prototype.forEach.call(root.querySelectorAll('[data-qi18n]'), function (el) { el.textContent = t(table, el.getAttribute('data-qi18n')); });
      Array.prototype.forEach.call(root.querySelectorAll('[data-qi18n-aria]'), function (el) { el.setAttribute('aria-label', t(table, el.getAttribute('data-qi18n-aria'))); });
      Array.prototype.forEach.call(root.querySelectorAll('[data-qi18n-ph]'), function (el) { el.setAttribute('placeholder', t(table, el.getAttribute('data-qi18n-ph'))); });
    }
    if (root.setAttribute) root.setAttribute('lang', LANG_TAG[lang] || 'en');
    /* ⚠️ Duda's own link fields point at the English page (measured: "View
       Quote Basket" on /de/ went to /basket), so the prefix is added here. */
    Array.prototype.forEach.call(root.querySelectorAll('a[href^="/"]'), function (a) {
      a.setAttribute('href', href(a.getAttribute('href')));
    });
  }

  window.SAEquipQuoteI18n = { v: 1, locale: locale, prefix: prefix, href: href, labels: labels, view: view, t: t, apply: apply };
})();
/* <<< shared quote code */

/* ── Add to Quote widget ───────────────────────────────────────────────────── */
(function () {
  'use strict';

  var Quote = window.SAEquipQuote;
  if (!Quote) { console.error('[SAEquip] quote store missing'); return; }
  var I18n = window.SAEquipQuoteI18n;

  /* This widget's fixed text. Machine-drafted translations — awaiting a
     native speaker's review, like the rest of the site's widget text. */
  var TEXT = {
    en: {
      chooseAll: 'Please select all options before adding to your quote.',
      choose: 'Please choose: {list}',
      loading: 'Product options are still loading - please try again in a moment.',
      added: 'Added to Quote List',
      failed: 'Could not save to your quote. Please try again.',
      dec: 'Decrease quantity', inc: 'Increase quantity', qty: 'Quantity'
    },
    ar: {
      chooseAll: 'يرجى تحديد جميع الخيارات قبل الإضافة إلى طلب عرض السعر.',
      choose: 'يرجى اختيار: {list}',
      loading: 'لا تزال خيارات المنتج قيد التحميل - يرجى المحاولة مرة أخرى بعد قليل.',
      added: 'تمت الإضافة إلى قائمة عروض الأسعار',
      failed: 'تعذّر الحفظ في طلب عرض السعر. يرجى المحاولة مرة أخرى.',
      dec: 'إنقاص الكمية', inc: 'زيادة الكمية', qty: 'الكمية'
    },
    zh: {
      chooseAll: '加入询价前，请先选择所有选项。',
      choose: '请选择：{list}',
      loading: '产品选项仍在加载中，请稍后再试。',
      added: '已加入询价清单',
      failed: '无法保存到询价清单，请重试。',
      dec: '减少数量', inc: '增加数量', qty: '数量'
    },
    fr: {
      chooseAll: 'Veuillez sélectionner toutes les options avant d\'ajouter le produit à votre devis.',
      choose: 'Veuillez choisir : {list}',
      loading: 'Les options du produit sont en cours de chargement - veuillez réessayer dans un instant.',
      added: 'Ajouté à la liste des devis',
      failed: 'Impossible d\'enregistrer dans votre devis. Veuillez réessayer.',
      dec: 'Diminuer la quantité', inc: 'Augmenter la quantité', qty: 'Quantité'
    },
    de: {
      chooseAll: 'Bitte wählen Sie alle Optionen aus, bevor Sie das Produkt zu Ihrem Angebot hinzufügen.',
      choose: 'Bitte wählen Sie: {list}',
      loading: 'Die Produktoptionen werden noch geladen - bitte versuchen Sie es gleich noch einmal.',
      added: 'Zur Angebotsliste hinzugefügt',
      failed: 'Speichern in Ihrem Angebot nicht möglich. Bitte versuchen Sie es erneut.',
      dec: 'Menge verringern', inc: 'Menge erhöhen', qty: 'Menge'
    },
    'pt-br': {
      chooseAll: 'Selecione todas as opções antes de adicionar ao seu orçamento.',
      choose: 'Escolha: {list}',
      loading: 'As opções do produto ainda estão carregando - tente novamente em instantes.',
      added: 'Adicionado à lista de orçamento',
      failed: 'Não foi possível salvar no seu orçamento. Tente novamente.',
      dec: 'Diminuir quantidade', inc: 'Aumentar quantidade', qty: 'Quantidade'
    },
    es: {
      chooseAll: 'Seleccione todas las opciones antes de añadir el producto a su presupuesto.',
      choose: 'Elija: {list}',
      loading: 'Las opciones del producto aún se están cargando - vuelva a intentarlo en un momento.',
      added: 'Añadido a la lista de presupuesto',
      failed: 'No se ha podido guardar en su presupuesto. Vuelva a intentarlo.',
      dec: 'Reducir cantidad', inc: 'Aumentar cantidad', qty: 'Cantidad'
    }
  };
  function T(key, vars) { return I18n ? I18n.t(TEXT, key, vars) : TEXT.en[key]; }

  var btn      = document.getElementById('atq-btn');
  var errorEl  = document.getElementById('atq-error');
  var countEl  = document.getElementById('atq-count-num');
  var qtyInput = document.getElementById('atq-qty');
  var qtyDec   = document.querySelector('.atq-qty-dec');
  var qtyInc   = document.querySelector('.atq-qty-inc');
  if (!btn) return;
  if (I18n) I18n.apply(btn.closest ? btn.closest('.atq-wrapper') || btn.parentNode : btn.parentNode, TEXT);

  function renderCount() { if (countEl) countEl.textContent = Quote.count(); }
  renderCount();
  Quote.onChange(renderCount);

  /* ── quantity stepper ─────────────────────────────────────────────────── */
  function setQty(v) { v = parseInt(v, 10); if (isNaN(v) || v < 1) v = 1; if (qtyInput) qtyInput.value = v; }
  function getQty() { var v = qtyInput ? parseInt(qtyInput.value, 10) : 1; return (isNaN(v) || v < 1) ? 1 : v; }
  if (qtyDec)   qtyDec.addEventListener('click', function () { setQty(getQty() - 1); });
  if (qtyInc)   qtyInc.addEventListener('click', function () { setQty(getQty() + 1); });
  if (qtyInput) qtyInput.addEventListener('change', function () { setQty(qtyInput.value); });

  /* =========================================================================
     DUDA ADAPTER — the only Duda-specific, breakage-prone code.
     ========================================================================= */

  function readProduct() {
    var ssr = readProductFromSSR();
    if (ssr && ssr.name) return ssr;
    return readProductFromMeta();
  }

  function readProductFromSSR() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var t = scripts[i].textContent;
      if (!t || t.indexOf('productView') === -1) continue;
      var obj = extractJsonObject(t, '"productView":');
      if (obj && (obj.name || obj.sku)) {
        return {
          name:  obj.name || '',
          sku:   obj.sku || '',
          price: obj.displayed_price != null ? String(obj.displayed_price) : '',
          image: obj.image || '',
          /* Language-free: the same in every language of the site. */
          dudaId:  typeof obj.identifier === 'string' ? obj.identifier : '',
          slug:    typeof obj.seo_url === 'string' ? obj.seo_url : '',
          options: Array.isArray(obj.options) ? obj.options : []
        };
      }
    }
    return null;
  }

  function extractJsonObject(text, marker) {
    var start = text.indexOf(marker);
    if (start === -1) return null;
    start = text.indexOf('{', start);
    if (start === -1) return null;
    var depth = 0, inStr = false, esc = false;
    for (var i = start; i < text.length; i++) {
      var c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') { inStr = true; }
      else if (c === '{') { depth++; }
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(start, i + 1)); } catch (e) { return null; }
        }
      }
    }
    return null;
  }

  function readProductFromMeta() {
    function meta(prop) {
      var el = document.querySelector('meta[property="' + prop + '"]');
      return el ? (el.getAttribute('content') || '').trim() : '';
    }
    return {
      name:  meta('og:title') || (document.title || '').trim(),
      sku:   '',
      price: '',
      image: meta('og:image')
    };
  }

  /* Product URL = the current page in the current environment (preview stays on
     preview, live stays on live). No base-URL config needed. */
  function readProductUrl() {
    return window.location.origin + window.location.pathname;
  }

  /* An "option control" is a dropdown, a native radio, or a custom aria radio. */
  /* An "option control" is a dropdown, a native radio, or a custom aria radio. */
  function getOptionControls() {
    return document.querySelectorAll('select, input[type="radio"], [role="radio"]');
  }

  function readOptions() {
    var selected = {}, missing = [];

    /* <select> dropdowns */
    Array.prototype.forEach.call(document.querySelectorAll('select'), function (sel, idx) {
      var label = labelForSelect(sel) || ('Option ' + (idx + 1));
      var val = selectedValue(sel);
      if (val === null) missing.push(label);
      else selected[label] = val;
    });

    /* Duda native-store radio option groups (stable data-* hooks) */
    Array.prototype.forEach.call(document.querySelectorAll('[data-auto="radio-buttons-group"]'), function (grp) {
      var titleEl = grp.querySelector('[data-grab="radiogroup-title"]');
      var label = (titleEl && clean(titleEl.textContent)) || 'Option';
      var radios = grp.querySelectorAll('input[type="radio"]');
      if (!radios.length) return;
      var checked = null;
      Array.prototype.forEach.call(radios, function (r) { if (r.checked) checked = r; });   /* live state, not the HTML attribute */
      if (!checked) missing.push(label);
      else selected[label] = radioValue(checked);
    });

    /* generic aria radiogroups (fallback; harmless if none exist) */
    Array.prototype.forEach.call(document.querySelectorAll('[role="radiogroup"]'), function (grp) {
      if (!grp.querySelector('[role="radio"]')) return;
      var label = groupHeading(grp) || 'Option';
      var checked = grp.querySelector('[role="radio"][aria-checked="true"], [role="radio"].selected, [role="radio"].active');
      if (!checked) missing.push(label);
      else selected[label] = clean(checked.getAttribute('aria-label') || checked.textContent || '') || 'Selected';
    });

    return { selected: selected, missing: missing };
  }

  /* value of a selected Duda radio = its visible label text */
  function radioValue(input) {
    var lab = input.closest ? input.closest('label') : null;
    var p = lab && lab.querySelector('[data-grab="radio-label"]');
    if (p && clean(p.textContent)) return clean(p.textContent);
    if (lab && clean(lab.textContent)) return clean(lab.textContent);
    if (input.value) return clean(input.value);
    return 'Selected';
  }

  function groupHeading(wrapper) {
    if (!wrapper) return '';
    var h = wrapper.querySelector('[data-grab="radiogroup-title"],h1,h2,h3,h4,h5,h6,[role="heading"]');
    return h ? clean(h.textContent) : '';
  }

  function selectedValue(sel) {
    if (!sel.value) return null;
    var opt = sel.options[sel.selectedIndex];
    var txt = opt ? opt.text.trim() : String(sel.value).trim();
    if (!txt) return null;
    if (/^(select|choose|please|--)/i.test(txt)) return null;
    return txt;
  }

  function labelForSelect(sel) {
    if (sel.id) {
      var lbl = document.querySelector('label[for="' + cssEscape(sel.id) + '"]');
      if (lbl && clean(lbl.textContent)) return clean(lbl.textContent);
    }
    if (sel.getAttribute('aria-label')) return clean(sel.getAttribute('aria-label'));
    var node = sel.parentElement;
    for (var hops = 0; node && hops < 6; hops++) {
      if (node.querySelectorAll('select').length !== 1) break;
      var h = node.querySelector('h1,h2,h3,h4,h5,h6,label,[role="heading"]');
      if (h && clean(h.textContent)) return clean(h.textContent);
      node = node.parentElement;
    }
    return '';
  }

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim().replace(/:$/, ''); }
  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&');
  }
  /* The chosen options as Duda ids ({optionId: choiceId}), matched by the
     labels this page shows — both come from the same page, so in the same
     language. Null if any cannot be matched: the line then keeps its text
     only, exactly as before. */
  function choiceIds(selected, pageOptions) {
    var out = {}, labels = Object.keys(selected);
    if (!labels.length || !pageOptions || !pageOptions.length) return null;
    var same = function (a, b) { return clean(a).toLowerCase() === clean(b).toLowerCase(); };
    for (var i = 0; i < labels.length; i++) {
      var hit = null;
      pageOptions.forEach(function (o) {
        if (!same(o.name, labels[i])) return;
        (o.opt_choices || []).forEach(function (c) { if (same(c.value, selected[labels[i]])) hit = { o: o.id, c: c.id }; });
      });
      if (!hit) {
        /* By the value alone, when exactly one option offers it. */
        var hits = [];
        pageOptions.forEach(function (o) {
          (o.opt_choices || []).forEach(function (c) { if (same(c.value, selected[labels[i]])) hits.push({ o: o.id, c: c.id }); });
        });
        if (hits.length === 1) hit = hits[0];
      }
      if (!hit || !hit.o || !hit.c) return null;
      out[hit.o] = hit.c;
    }
    return out;
  }
  /* =============================== END DUDA ADAPTER ======================= */

  /* options expected? (see earlier notes — supports optionless products) */
  var sawOptions = getOptionControls().length > 0;
  if (!sawOptions && window.MutationObserver) {
    var optObserver = new MutationObserver(function () {
      if (getOptionControls().length > 0) { sawOptions = true; optObserver.disconnect(); }
    });
    optObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { optObserver.disconnect(); }, 4000);
  }

  function showError(msg) {
    errorEl.textContent = msg || T('chooseAll');
    errorEl.style.display = 'block';
    btn.classList.add('atq-error-state');
    btn.addEventListener('animationend', function h() {
      btn.classList.remove('atq-error-state');
      btn.removeEventListener('animationend', h);
    });
  }
  function hideError() { errorEl.style.display = 'none'; }

  function showSuccess() {
    var original = btn.textContent;
    btn.innerHTML =
      '<svg class="atq-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="20 6 9 17 4 12"></polyline></svg>' +
      '<span>' + T('added').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
    btn.classList.add('atq-success');
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('atq-success');
      btn.disabled = false;
    }, 2000);
  }

  btn.addEventListener('click', function () {
    hideError();

    var controls = getOptionControls();
    if (controls.length === 0 && sawOptions) {
      showError(T('loading'));
      return;
    }

    var opts = readOptions();
    if (opts.missing.length) {
      showError(T('choose', { list: opts.missing.join(', ') }));
      return;
    }

    var product = readProduct();
    try {
      Quote.add({
        name:     product.name,
        sku:      product.sku,
        options:  opts.selected,
        price:    product.price,
        image:    product.image,
        url:      readProductUrl(),
        quantity: getQty(),
        dudaId:   product.dudaId || '',
        slug:     product.slug || '',
        choices:  choiceIds(opts.selected, product.options)
      });
      /* tell the header widget to auto-open its dropdown (desktop only) */
      document.dispatchEvent(new CustomEvent('saequip:quote-added'));
      showSuccess();
      setQty(1);
    } catch (e) {
      showError(T('failed'));
    }
  });
})();

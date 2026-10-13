/* =============================================================================
   SAEquip — Header Quote Basket (count + modal popup)
   Self-contained store (idempotent). No head HTML.
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
  /* What POST /public/quotes accepts. ⚠️ Beyond either, the server refuses
     the WHOLE quote, so they are enforced here, where the visitor can still
     change the basket (fixed 2026-10-12). */
  var MAX_QTY = 100000, MAX_LINES = 100;
  function clampQty(q) { q = parseInt(q, 10); return isNaN(q) || q < 1 ? 1 : Math.min(q, MAX_QTY); }
  /* ⚠️ localStorage can be unavailable: blocked site data, a privacy mode,
     some in-app browsers. Reading `window.localStorage` then THROWS, and it
     used to be read bare here — so every quote widget died at load, and the
     basket form, left without its submit handler, posted natively with the
     visitor's details in the URL (fixed 2026-10-12). Without it the basket
     lives for this page view only. */
  var store = (function () {
    try {
      var s = window.localStorage, probe = '__saequip_probe';
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch (e) {
      var mem = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();

  function read() {
    try { var b = JSON.parse(store.getItem(KEY) || '[]'); return Array.isArray(b) ? b : []; }
    catch (e) { return []; }
  }
  function write(basket) {
    /* A full quota must not throw out of Quote.clear() after a quote has been
       sent: the basket page would report "could not reach the server" and
       invite a duplicate. */
    try { store.setItem(KEY, JSON.stringify(basket)); } catch (e) {}
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { basket: basket } }));
    return basket;
  }
  function sortedKey(obj) {
    obj = obj || {};
    return JSON.stringify(Object.keys(obj).sort().reduce(function (a, k) { a[k] = obj[k]; return a; }, {}));
  }
  /* The same line: by ids when BOTH lines have their choice ids (whatever
     language each was added in), otherwise by the text, as before v2.
     ⚠️ A line keeps `choices` only when the page's options could be matched
     to ids. Comparing ids alone treated "no ids" as equal to "no ids", so
     Hire and Purchase of one product merged into ONE line and the second
     choice vanished from the quote (fixed 2026-10-12). Without ids on both
     sides it falls back to the option text, which keeps them apart. */
  function hasIds(l) { return !!(l.choices && Object.keys(l.choices).length); }
  function sameLine(e, item) {
    if (e.dudaId && item.dudaId && e.dudaId !== item.dudaId) return false;
    if (e.dudaId && item.dudaId && hasIds(e) && hasIds(item)) return sortedKey(e.choices) === sortedKey(item.choices);
    if (e.dudaId && item.dudaId) return sortedKey(e.options) === sortedKey(item.options);
    return e.name === item.name && e.sku === item.sku && sortedKey(e.options) === sortedKey(item.options);
  }

  window.SAEquipQuote = {
    v: 2, KEY: KEY, EVENT: EVENT, get: read,
    count: function () { return read().reduce(function (n, e) { return n + (parseInt(e.quantity, 10) || 1); }, 0); },
    add: function (item) {
      var basket = read();
      // An id match first: a line in another language may share no text with
      // this one, and a text-only line must not win over it.
      var existing = basket.find(function (e) { return hasIds(e) && hasIds(item) && sameLine(e, item); }) ||
        basket.find(function (e) { return sameLine(e, item); });
      if (existing) {
        existing.quantity = clampQty((parseInt(existing.quantity, 10) || 1) + (parseInt(item.quantity, 10) || 1));
        existing.addedAt  = new Date().toISOString();
      } else {
        if (basket.length >= MAX_LINES) throw new Error('basket_full');
        var line = {
          name:  item.name || '', sku: item.sku || '', options: item.options || {},
          price: item.price || '', image: item.image || '', url: item.url || '',
          quantity: clampQty(item.quantity), addedAt: new Date().toISOString()
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
      basket[index].quantity = clampQty(qty);
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

/* ── Header widget UI (modal) ──────────────────────────────────────────────── */
window.dmAPI.runOnReady('quote-basket-widget', function () {

  var Quote = window.SAEquipQuote;
  if (!Quote) { console.error('[SAEquip] quote store missing'); return; }
  var I18n = window.SAEquipQuoteI18n;

  /* This widget's fixed text (2026-10-07). Its label and "View Quote Basket"
     button are content-panel fields, which Duda translates itself. "Quote
     List" uses Duda's own wording for each language, so the two agree.
     Machine-drafted — awaiting a native speaker's review. */
  var TEXT = {
    en: { dialog: 'Quote list', close: 'Close', eyebrow: 'Your equipment enquiry', title: 'Quote List',
          empty: 'No products added yet.', 'continue': 'Continue browsing', clear: 'Clear all',
          sku: 'SKU:', qty: 'Qty {n}', remove: 'Remove item', product: 'Product' },
    ar: { dialog: 'قائمة عروض الأسعار', close: 'إغلاق', eyebrow: 'استفسارك عن المعدات', title: 'قائمة عروض الأسعار',
          empty: 'لم تتم إضافة أي منتجات بعد.', 'continue': 'متابعة التصفح', clear: 'مسح الكل',
          sku: 'رمز المنتج:', qty: 'الكمية {n}', remove: 'إزالة المنتج', product: 'منتج' },
    zh: { dialog: '询价清单', close: '关闭', eyebrow: '您的设备询价', title: '询价清单',
          empty: '尚未添加任何产品。', 'continue': '继续浏览', clear: '全部清除',
          sku: 'SKU：', qty: '数量 {n}', remove: '移除产品', product: '产品' },
    fr: { dialog: 'Liste des devis', close: 'Fermer', eyebrow: 'Votre demande d\'équipement', title: 'Liste des devis',
          empty: 'Aucun produit ajouté pour le moment.', 'continue': 'Continuer mes recherches', clear: 'Tout effacer',
          sku: 'Réf. :', qty: 'Qté {n}', remove: 'Retirer le produit', product: 'Produit' },
    de: { dialog: 'Angebotsliste', close: 'Schließen', eyebrow: 'Ihre Geräteanfrage', title: 'Angebotsliste',
          empty: 'Noch keine Produkte hinzugefügt.', 'continue': 'Weiter stöbern', clear: 'Alle entfernen',
          sku: 'Art.-Nr.:', qty: 'Menge {n}', remove: 'Produkt entfernen', product: 'Produkt' },
    'pt-br': { dialog: 'Lista de orçamento', close: 'Fechar', eyebrow: 'Sua consulta de equipamentos', title: 'Lista de orçamento',
          empty: 'Nenhum produto adicionado ainda.', 'continue': 'Continuar navegando', clear: 'Limpar tudo',
          sku: 'SKU:', qty: 'Qtd. {n}', remove: 'Remover produto', product: 'Produto' },
    es: { dialog: 'Lista de presupuesto', close: 'Cerrar', eyebrow: 'Su consulta de equipos', title: 'Lista de presupuesto',
          empty: 'Aún no ha añadido ningún producto.', 'continue': 'Seguir navegando', clear: 'Borrar todo',
          sku: 'Ref.:', qty: 'Cant. {n}', remove: 'Eliminar producto', product: 'Producto' }
  };
  function T(key, vars) { return I18n ? I18n.t(TEXT, key, vars) : TEXT.en[key].replace('{n}', vars && vars.n); }
  /* Names and options in the page's language once they arrive; until then
     (and if they never do) each line shows as it was saved. */
  var L = null;

  var root     = element.querySelector('.qc') || element;
  var toggle   = element.querySelector('.qc-btn');
  var overlay  = element.querySelector('.qc-overlay');
  var modal    = element.querySelector('.qc-modal');
  var closeBtn = element.querySelector('.qc-close');
  var contBtn  = element.querySelector('.qc-continue');
  var itemsEl  = element.querySelector('.qc-items');
  var clearEl  = element.querySelector('.qc-clear');
  var counts   = element.querySelectorAll('.qc-num');
  if (!toggle) return;
  if (I18n) I18n.apply(root, TEXT);

  function isDesktop() { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }

  /* ── open / close ─────────────────────────────────────────────────────── */
  /* ⚠️ The popup is a modal dialog (role=dialog, aria-modal), so focus has to
     move into it, stay there and come back. It did none of that, and it
     auto-opens after an Add to Quote, leaving keyboard focus on a control
     hidden behind the overlay (fixed 2026-10-12). */
  var opener = null;
  function openModal() {
    if (root.classList.contains('qc-open')) return;
    opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : toggle;
    root.classList.add('qc-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';   /* lock background scroll */
    if (closeBtn) closeBtn.focus();
  }
  function closeModal() {
    if (!root.classList.contains('qc-open')) return;
    root.classList.remove('qc-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    try { if (opener && opener.isConnected) opener.focus(); } catch (e) {}
    opener = null;
  }
  function trapTab(e) {
    if (e.key !== 'Tab' || !modal || !root.classList.contains('qc-open')) return;
    var f = [].slice.call(modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled])'))
      .filter(function (x) { return x.offsetParent !== null || x === document.activeElement; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!modal.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  toggle.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (contBtn)  contBtn.addEventListener('click', closeModal);
  if (overlay)  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && root.classList.contains('qc-open')) closeModal();
    else trapTab(e);
  });

  /* auto-open when something is added on a product page (desktop only) */
  document.addEventListener('saequip:quote-added', function () { if (isDesktop()) openModal(); });

  /* ── rendering ────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safeUrl(u) { u = String(u || ''); return /^https?:\/\//i.test(u) ? u : ''; }

  function optionRows(opts) {
    if (!opts) return '';
    return Object.keys(opts).map(function (k) {
      return '<div class="qc-optrow"><span class="qc-optlabel">' + esc(k) + ':</span> ' + esc(opts[k]) + '</div>';
    }).join('');
  }

  function itemCard(item, index) {
    var shown = I18n ? I18n.view(item, L) : item;
    var url   = safeUrl(shown.url);
    var open  = url ? '<a class="qc-link" href="' + esc(url) + '">' : '';
    var close = url ? '</a>' : '';
    var imgInner = item.image
      ? '<img class="qc-thumb" src="' + esc(item.image) + '" alt="" loading="lazy">'
      : '<span class="qc-thumb qc-thumb--ph"></span>';
    var img = open + imgInner + close;
    var qty = parseInt(item.quantity, 10) || 1;
    return '<div class="qc-item">' +
        img +
        '<div class="qc-info">' +
          '<div class="qc-name">' + open + esc(shown.name || T('product')) + close + '</div>' +
          (item.sku ? '<div class="qc-sku">' + esc(T('sku')) + ' ' + esc(item.sku) + '</div>' : '') +
          '<div class="qc-opts">' + optionRows(shown.options) + '</div>' +
          '<div class="qc-meta">' + esc(T('qty', { n: qty })) + '</div>' +
        '</div>' +
        '<button class="qc-x" type="button" data-index="' + index + '" aria-label="' + esc(T('remove')) + '">&times;</button>' +
      '</div>';
  }

  function render(basket) {
    basket = basket || Quote.get();
    var n = Quote.count();
    Array.prototype.forEach.call(counts, function (el) { el.textContent = n; });
    if (modal)   modal.classList.toggle('qc-is-empty', basket.length === 0);
    if (itemsEl) itemsEl.innerHTML = basket.map(itemCard).join('');
  }

  /* remove a line (delegated). Product-link clicks have no data-index -> navigate. */
  if (itemsEl) {
    itemsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.qc-x');
      if (!btn) return;
      e.preventDefault();
      var idx = parseInt(btn.getAttribute('data-index'), 10);
      if (!isNaN(idx)) Quote.remove(idx);
    });
  }
  if (clearEl) {
    clearEl.addEventListener('click', function (e) { e.preventDefault(); Quote.clear(); });
  }

  render();
  Quote.onChange(render);
  if (I18n) I18n.labels().then(function (v) { if (v) { L = v; render(); } });
});

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

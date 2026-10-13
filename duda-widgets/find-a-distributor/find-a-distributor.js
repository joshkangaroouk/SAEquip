/* ==========================================================================
   SA Equip — Find a Distributor widget
   Region filter + search + custom dropdown + staggered card animation.

   Duda: the Widget Builder exposes `element` (the widget root). This falls
   back to a document-wide query so the same file works in a plain HTML page.

   LANGUAGES (2026-10-09) — measured on the live site, all six languages:
   - ⚠️ Duda machine-translates the "Collection name" Content field like any
     other text ("Distributors" → "Distributeurs", "Vertriebspartner", "الموزعون"…),
     so the widget asked for a collection that does not exist and showed
     nothing. It now falls back to DEFAULT_COLLECTION.
   - Duda does NOT translate the collection's rows: countries, regions and
     names come back in English on every language page. Regions come from
     REGION below; countries from the browser's own names (Intl.DisplayNames);
     "SA Equip – Global Headquarters"-style names from HQ_NAME.
   - The template's default wording and every sentence this script writes are
     translated here; a Content field the site owner fills in is left to Duda.
   ⚠️ Edit in the repo (duda-widgets/find-a-distributor/) and paste from there.
   ========================================================================== */

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

(function () {
  'use strict';

  /* The real name of the Duda collection. Used when the Content field's value
     finds nothing, which on a translated page is always (see above). */
  var DEFAULT_COLLECTION = 'Distributors';

  var PREFERRED_ORDER = [
    'Europe',
    'Middle East',
    'Oceania',
    'South America',
    'South East Asia'
  ];

  var ALL = '__all__';

  var I18n = window.SAEquipQuoteI18n;
  var lang = I18n ? I18n.locale() : 'en';
  var LANG_TAG = { en: 'en', ar: 'ar', zh: 'zh-Hans', fr: 'fr', de: 'de', 'pt-br': 'pt-BR', es: 'es' };

  /* This widget's own wording. Machine-drafted translations, awaiting a native
     speaker's review like the rest of the site's widget text. English is
     exactly the wording this widget always had. Plural entries take the
     Intl.PluralRules categories (Arabic has six). */
  var TEXT = {
    en: {
      introHeading: 'Find a distributor in your area',
      introText: 'Select your region from the list below to see the distributors in your area.',
      filterAria: 'Filter distributors by region',
      hqNote: 'If there is no distributor in your area, please contact us at SA Equip Global Headquarters.',
      hqTitle: 'SA Equip – Global Headquarters',
      allRegions: 'All regions',
      inAll: 'all regions',
      searchLabel: 'Search distributors',
      searchPh: 'Search by country, city or company',
      clearSearch: 'Clear search',
      emptyTitle: 'No distributors match your search',
      emptyText: 'Try a different region or search term, or contact SA Equip Global Headquarters directly.',
      reset: 'Clear filters',
      noResults: 'No results',
      showing: { one: 'Showing {n} distributor in {region}', other: 'Showing {n} distributors in {region}' },
      showingSearch: { one: 'Showing {n} distributor in {region} matching your search', other: 'Showing {n} distributors in {region} matching your search' },
      logoAlt: '{name} logo'
    },
    ar: {
      introHeading: 'ابحث عن موزع في منطقتك',
      introText: 'اختر منطقتك من القائمة أدناه لعرض الموزعين في منطقتك.',
      filterAria: 'تصفية الموزعين حسب المنطقة',
      hqNote: 'إذا لم يكن هناك موزع في منطقتك، يرجى التواصل مع المقر الرئيسي العالمي لـ SA Equip.',
      hqTitle: 'SA Equip – المقر الرئيسي العالمي',
      allRegions: 'جميع المناطق',
      inAll: 'جميع المناطق',
      searchLabel: 'البحث عن موزعين',
      searchPh: 'ابحث حسب الدولة أو المدينة أو الشركة',
      clearSearch: 'مسح البحث',
      emptyTitle: 'لا يوجد موزعون مطابقون لبحثك',
      emptyText: 'جرّب منطقة أو كلمة بحث أخرى، أو تواصل مباشرة مع المقر الرئيسي العالمي لـ SA Equip.',
      reset: 'مسح عوامل التصفية',
      noResults: 'لا توجد نتائج',
      showing: { one: 'موزع واحد · {region}', two: 'موزعان · {region}', few: '{n} موزعين · {region}', many: '{n} موزعًا · {region}', other: '{n} موزع · {region}' },
      showingSearch: { one: 'نتيجة واحدة تطابق بحثك · {region}', two: 'نتيجتان تطابقان بحثك · {region}', few: '{n} نتائج تطابق بحثك · {region}', many: '{n} نتيجة تطابق بحثك · {region}', other: '{n} نتيجة تطابق بحثك · {region}' },
      logoAlt: 'شعار {name}'
    },
    zh: {
      introHeading: '查找您所在地区的经销商',
      introText: '请从下方列表中选择您所在的地区，查看当地的经销商。',
      filterAria: '按地区筛选经销商',
      hqNote: '如果您所在地区没有经销商，请联系 SA Equip 全球总部。',
      hqTitle: 'SA Equip – 全球总部',
      allRegions: '所有地区',
      inAll: '所有地区',
      searchLabel: '搜索经销商',
      searchPh: '按国家、城市或公司搜索',
      clearSearch: '清除搜索',
      emptyTitle: '没有符合搜索条件的经销商',
      emptyText: '请尝试其他地区或搜索词，或直接联系 SA Equip 全球总部。',
      reset: '清除筛选',
      noResults: '无结果',
      showing: { other: '{n} 家经销商 · {region}' },
      showingSearch: { other: '{n} 家符合搜索条件的经销商 · {region}' },
      logoAlt: '{name} 标志'
    },
    fr: {
      introHeading: 'Trouvez un distributeur près de chez vous',
      introText: 'Sélectionnez votre région dans la liste ci-dessous pour voir les distributeurs de votre zone.',
      filterAria: 'Filtrer les distributeurs par région',
      hqNote: 'S\'il n\'y a pas de distributeur dans votre région, contactez le siège mondial de SA Equip.',
      hqTitle: 'SA Equip – Siège mondial',
      allRegions: 'Toutes les régions',
      inAll: 'Toutes les régions',
      searchLabel: 'Rechercher un distributeur',
      searchPh: 'Rechercher par pays, ville ou entreprise',
      clearSearch: 'Effacer la recherche',
      emptyTitle: 'Aucun distributeur ne correspond à votre recherche',
      emptyText: 'Essayez une autre région ou un autre terme, ou contactez directement le siège mondial de SA Equip.',
      reset: 'Effacer les filtres',
      noResults: 'Aucun résultat',
      showing: { one: '{n} distributeur · {region}', other: '{n} distributeurs · {region}' },
      showingSearch: { one: '{n} distributeur correspond à votre recherche · {region}', other: '{n} distributeurs correspondent à votre recherche · {region}' },
      logoAlt: 'Logo de {name}'
    },
    de: {
      introHeading: 'Finden Sie einen Vertriebspartner in Ihrer Nähe',
      introText: 'Wählen Sie unten Ihre Region aus, um die Vertriebspartner in Ihrer Nähe zu sehen.',
      filterAria: 'Vertriebspartner nach Region filtern',
      hqNote: 'Wenn es in Ihrer Region keinen Vertriebspartner gibt, wenden Sie sich bitte an den globalen Hauptsitz von SA Equip.',
      hqTitle: 'SA Equip – Globaler Hauptsitz',
      allRegions: 'Alle Regionen',
      inAll: 'Alle Regionen',
      searchLabel: 'Vertriebspartner suchen',
      searchPh: 'Nach Land, Stadt oder Firma suchen',
      clearSearch: 'Suche löschen',
      emptyTitle: 'Keine Vertriebspartner entsprechen Ihrer Suche',
      emptyText: 'Versuchen Sie eine andere Region oder einen anderen Suchbegriff, oder wenden Sie sich direkt an den globalen Hauptsitz von SA Equip.',
      reset: 'Filter zurücksetzen',
      noResults: 'Keine Ergebnisse',
      showing: { other: '{n} Vertriebspartner · {region}' },
      showingSearch: { other: '{n} Vertriebspartner passend zu Ihrer Suche · {region}' },
      logoAlt: 'Logo von {name}'
    },
    'pt-br': {
      introHeading: 'Encontre um distribuidor na sua região',
      introText: 'Selecione sua região na lista abaixo para ver os distribuidores da sua área.',
      filterAria: 'Filtrar distribuidores por região',
      hqNote: 'Se não houver um distribuidor na sua região, entre em contato com a sede global da SA Equip.',
      hqTitle: 'SA Equip – Sede global',
      allRegions: 'Todas as regiões',
      inAll: 'Todas as regiões',
      searchLabel: 'Pesquisar distribuidores',
      searchPh: 'Pesquise por país, cidade ou empresa',
      clearSearch: 'Limpar pesquisa',
      emptyTitle: 'Nenhum distribuidor corresponde à sua pesquisa',
      emptyText: 'Tente outra região ou outro termo de pesquisa, ou entre em contato diretamente com a sede global da SA Equip.',
      reset: 'Limpar filtros',
      noResults: 'Nenhum resultado',
      showing: { one: '{n} distribuidor · {region}', other: '{n} distribuidores · {region}' },
      showingSearch: { one: '{n} distribuidor corresponde à sua pesquisa · {region}', other: '{n} distribuidores correspondem à sua pesquisa · {region}' },
      logoAlt: 'Logotipo de {name}'
    },
    es: {
      introHeading: 'Encuentre un distribuidor en su zona',
      introText: 'Seleccione su región en la lista para ver los distribuidores de su zona.',
      filterAria: 'Filtrar distribuidores por región',
      hqNote: 'Si no hay ningún distribuidor en su zona, póngase en contacto con la sede central mundial de SA Equip.',
      hqTitle: 'SA Equip – Sede central mundial',
      allRegions: 'Todas las regiones',
      inAll: 'Todas las regiones',
      searchLabel: 'Buscar distribuidores',
      searchPh: 'Buscar por país, ciudad o empresa',
      clearSearch: 'Borrar búsqueda',
      emptyTitle: 'Ningún distribuidor coincide con su búsqueda',
      emptyText: 'Pruebe con otra región u otro término de búsqueda, o póngase en contacto directamente con la sede central mundial de SA Equip.',
      reset: 'Borrar filtros',
      noResults: 'Sin resultados',
      showing: { one: '{n} distribuidor · {region}', other: '{n} distribuidores · {region}' },
      showingSearch: { one: '{n} distribuidor coincide con su búsqueda · {region}', other: '{n} distribuidores coinciden con su búsqueda · {region}' },
      logoAlt: 'Logotipo de {name}'
    }
  };

  /* The collection's "continents" values, which Duda leaves in English. The
     English value is still what filters; only the label changes. A region not
     listed here shows as entered. */
  var REGION = {
    'Europe':          { ar: 'أوروبا', zh: '欧洲', fr: 'Europe', de: 'Europa', 'pt-br': 'Europa', es: 'Europa' },
    'Middle East':     { ar: 'الشرق الأوسط', zh: '中东', fr: 'Moyen-Orient', de: 'Naher Osten', 'pt-br': 'Oriente Médio', es: 'Oriente Medio' },
    'Oceania':         { ar: 'أوقيانوسيا', zh: '大洋洲', fr: 'Océanie', de: 'Ozeanien', 'pt-br': 'Oceania', es: 'Oceanía' },
    'South America':   { ar: 'أمريكا الجنوبية', zh: '南美洲', fr: 'Amérique du Sud', de: 'Südamerika', 'pt-br': 'América do Sul', es: 'Sudamérica' },
    'South East Asia': { ar: 'جنوب شرق آسيا', zh: '东南亚', fr: 'Asie du Sud-Est', de: 'Südostasien', 'pt-br': 'Sudeste Asiático', es: 'Sudeste Asiático' },
    'Africa':          { ar: 'أفريقيا', zh: '非洲', fr: 'Afrique', de: 'Afrika', 'pt-br': 'África', es: 'África' },
    'Asia':            { ar: 'آسيا', zh: '亚洲', fr: 'Asie', de: 'Asien', 'pt-br': 'Ásia', es: 'Asia' },
    'North America':   { ar: 'أمريكا الشمالية', zh: '北美洲', fr: 'Amérique du Nord', de: 'Nordamerika', 'pt-br': 'América do Norte', es: 'Norteamérica' },
    'Central America': { ar: 'أمريكا الوسطى', zh: '中美洲', fr: 'Amérique centrale', de: 'Mittelamerika', 'pt-br': 'América Central', es: 'Centroamérica' },
    'Caribbean':       { ar: 'منطقة البحر الكاريبي', zh: '加勒比地区', fr: 'Caraïbes', de: 'Karibik', 'pt-br': 'Caribe', es: 'Caribe' },
    'Central Asia':    { ar: 'آسيا الوسطى', zh: '中亚', fr: 'Asie centrale', de: 'Zentralasien', 'pt-br': 'Ásia Central', es: 'Asia Central' },
    'East Asia':       { ar: 'شرق آسيا', zh: '东亚', fr: 'Asie de l\'Est', de: 'Ostasien', 'pt-br': 'Ásia Oriental', es: 'Asia Oriental' },
    'South Asia':      { ar: 'جنوب آسيا', zh: '南亚', fr: 'Asie du Sud', de: 'Südasien', 'pt-br': 'Ásia do Sul', es: 'Asia del Sur' }
  };

  /* SA Equip's own offices in the collection ("SA Equip – European Office"):
     the part after the dash. A country there goes through translateCountry(). */
  var HQ_NAME = {
    'Global Headquarters': { ar: 'المقر الرئيسي العالمي', zh: '全球总部', fr: 'Siège mondial', de: 'Globaler Hauptsitz', 'pt-br': 'Sede global', es: 'Sede central mundial' },
    'European Office':     { ar: 'المكتب الأوروبي', zh: '欧洲办事处', fr: 'Bureau européen', de: 'Europabüro', 'pt-br': 'Escritório europeu', es: 'Oficina europea' }
  };

  /* Country names written differently from the browser's English ones. */
  var COUNTRY_ALIAS = {
    'the netherlands': 'NL', 'holland': 'NL', 'uk': 'GB', 'great britain': 'GB',
    'united states': 'US', 'usa': 'US', 'uae': 'AE', 'czech republic': 'CZ',
    'russia': 'RU', 'south korea': 'KR', 'vietnam': 'VN', 'hong kong': 'HK',
    'macao': 'MO', 'macau': 'MO', 'ivory coast': 'CI', 'turkey': 'TR'
  };

  function T(key, vars) {
    var s = (TEXT[lang] && TEXT[lang][key]) || TEXT.en[key] || key;
    return typeof s === 'string' && vars
      ? s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; })
      : s;
  }

  /** A plural entry, in the form this language uses for `n`. */
  function TP(key, n, vars) {
    var entry = (TEXT[lang] && TEXT[lang][key]) || TEXT.en[key];
    var form = 'other';
    try { form = new Intl.PluralRules(LANG_TAG[lang] || 'en').select(n); } catch (e) {}
    var s = entry[form] || entry.other;
    vars = vars || {};
    vars.n = n;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  function regionLabel(region) {
    return lang !== 'en' && REGION[region] && REGION[region][lang] ? REGION[region][lang] : region;
  }

  var countryCodes = null;
  /** The browser's English country names → ISO code, built once. */
  function codeForCountry(english) {
    if (!countryCodes) {
      countryCodes = {};
      try {
        var en = new Intl.DisplayNames(['en'], { type: 'region' });
        for (var a = 65; a <= 90; a++) {
          for (var b = 65; b <= 90; b++) {
            var code = String.fromCharCode(a, b), name = null;
            try { name = en.of(code); } catch (e) { name = null; }
            if (name && name !== code) countryCodes[normalise(name)] = code;
          }
        }
      } catch (e) { /* no Intl.DisplayNames: countries stay as entered */ }
    }
    var key = normalise(english);
    return COUNTRY_ALIAS[key] || countryCodes[key] || countryCodes[key.replace(/^the /, '')] || null;
  }

  /** "Germany" → "Allemagne" on a French page; anything unknown as entered. */
  function translateCountry(english) {
    if (lang === 'en' || !english) return english;
    var code = codeForCountry(english);
    if (!code) return english;
    try {
      var name = new Intl.DisplayNames([LANG_TAG[lang]], { type: 'region' }).of(code);
      return name && name !== code ? name : english;
    } catch (e) {
      return english;
    }
  }

  /** "SA Equip – Global Headquarters" → "SA Equip – Siège mondial". Other names as entered. */
  function translateName(name) {
    if (lang === 'en' || !name) return name;
    var m = /^(SA ?Equip\s*[–-]\s*)(.+)$/i.exec(name);
    if (!m) return name;
    var rest = m[2].trim();
    if (HQ_NAME[rest] && HQ_NAME[rest][lang]) return m[1] + HQ_NAME[rest][lang];
    var country = translateCountry(rest);
    return country !== rest ? m[1] + country : name;
  }

  function toArray(list) {
    return Array.prototype.slice.call(list || []);
  }

  /* lower-cases and strips accents so "Macae" finds "Macaé" */
  function normalise(value) {
    var text = String(value == null ? '' : value).toLowerCase();
    if (typeof text.normalize === 'function') {
      text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  function splitContinents(value) {
    return String(value || '')
      .split(/[|,;]/)
      .map(function (part) { return part.trim(); })
      .filter(Boolean);
  }

  function sortRegions(regions) {
    return regions.sort(function (a, b) {
      var ai = PREFERRED_ORDER.indexOf(a);
      var bi = PREFERRED_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) { return regionLabel(a).localeCompare(regionLabel(b)); }
      if (ai === -1) { return 1; }
      if (bi === -1) { return -1; }
      return ai - bi;
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ⚠️ A web address from the collection goes into an href only if it is
     http(s). escapeHtml() stops markup, not a `javascript:` URL, which would
     run on the live page when clicked (fixed 2026-10-12). Anything else is
     shown as plain text instead of a link. */
  function webUrl(value) {
    var v = String(value == null ? '' : value).trim();
    return /^https?:\/\//i.test(v) ? v : '';
  }

  /* The same rule for links Duda's own template rendered from the
     collection and the Content fields (Handlebars escapes HTML, not URL
     schemes): only web, mail, phone, site-relative and in-page links keep
     their href. */
  function scrubLinks(root) {
    Array.prototype.forEach.call(root.querySelectorAll('a[href]'), function (a) {
      var h = (a.getAttribute('href') || '').trim();
      if (!/^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(h)) a.removeAttribute('href');
    });
  }

  function buildCardHtml(item) {
    var d = item.data || item;
    var logo = d.image
      ? '<img class="sae-dist__logo-img" src="' + escapeHtml(d.image) + '" alt="' + escapeHtml(d.image_alt || T('logoAlt', { name: d.name })) + '" loading="lazy" decoding="async">'
      : '<span class="sae-dist__logo-fallback" aria-hidden="true"><svg focusable="false"><use href="#sae-i-pin"></use></svg></span>';

    var rows = '';
    if (d.address) {
      rows += '<li class="sae-dist__meta-row"><span class="sae-dist__icon"><svg aria-hidden="true" focusable="false"><use href="#sae-i-pin"></use></svg></span>' +
        (webUrl(d.map_link)
          ? '<a class="sae-dist__meta-link" href="' + escapeHtml(webUrl(d.map_link)) + '" target="_blank" rel="noopener">' + escapeHtml(d.address) + '</a>'
          : '<span class="sae-dist__meta-text">' + escapeHtml(d.address) + '</span>') + '</li>';
    }
    if (d.email) {
      rows += '<li class="sae-dist__meta-row"><span class="sae-dist__icon"><svg aria-hidden="true" focusable="false"><use href="#sae-i-mail"></use></svg></span>' +
        '<a class="sae-dist__meta-link" href="mailto:' + escapeHtml(d.email) + '">' + escapeHtml(d.email) + '</a></li>';
    }
    if (d.phone) {
      rows += '<li class="sae-dist__meta-row"><span class="sae-dist__icon"><svg aria-hidden="true" focusable="false"><use href="#sae-i-phone"></use></svg></span>' +
        '<a class="sae-dist__meta-link" href="tel:' + escapeHtml(d.phone_link || d.phone) + '">' + escapeHtml(d.phone) + '</a></li>';
    }
    if (webUrl(d.website)) {
      rows += '<li class="sae-dist__meta-row"><span class="sae-dist__icon"><svg aria-hidden="true" focusable="false"><use href="#sae-i-globe"></use></svg></span>' +
        '<a class="sae-dist__meta-link" href="' + escapeHtml(webUrl(d.website)) + '" target="_blank" rel="noopener">' + escapeHtml(d.website_label || d.website) + '</a></li>';
    }

    var continents = d.continents || '';

    return '<article class="sae-dist__card" data-sae-card data-continents="' + escapeHtml(continents) + '" ' +
      'data-search="' + escapeHtml((d.name || '') + ' ' + (d.country || '') + ' ' + (d.address || '') + ' ' + continents) + '">' +
      '<div class="sae-dist__body">' +
      '<div class="sae-dist__head">' +
      '<span class="sae-dist__logo">' + logo + '</span>' +
      '<div class="sae-dist__head-text">' +
      '<p class="sae-dist__country">' + escapeHtml(d.country) + '</p>' +
      '<h3 class="sae-dist__name">' + escapeHtml(d.name) + '</h3>' +
      '</div></div>' +
      '<ul class="sae-dist__meta sae-dist__meta--footer">' + rows + '</ul>' +
      '</div></article>';
  }

  function loadCollection(root, collectionName, done) {
    if (!collectionName || typeof window.dmAPI === 'undefined' || typeof window.dmAPI.loadCollectionsAPI !== 'function') {
      done(null);
      return;
    }
    window.dmAPI.loadCollectionsAPI().then(function (collection) {
      function rows(name) {
        return collection.data(name).get().then(
          function (result) { return result && result.values && result.values.length ? result.values : null; },
          function () { return null; }
        );
      }
      /* ⚠️ On a translated page the Content field holds Duda's translation of
         the name, which matches no collection (Duda answers "No collection for
         site alias…"). The collection itself has one name in every language. */
      return rows(collectionName).then(function (values) {
        return values || (collectionName !== DEFAULT_COLLECTION ? rows(DEFAULT_COLLECTION) : null);
      });
    }).then(function (values) {
      if (!values) { done(null); return; }
      var grid = root.querySelector('[data-sae-grid]');
      if (grid) { grid.innerHTML = values.map(buildCardHtml).join(''); scrubLinks(grid); }
      done(values);
    }).catch(function () { done(null); });
  }

  function init(root) {
    if (!root || root.__saeDistInit) { return; }
    root.__saeDistInit = true;

    scrubLinks(root);

    /* The template's default wording, in the page's language (a filled-in
       Content field is Duda's to translate, and carries no marker). */
    if (I18n) { I18n.apply(root, TEXT); }

    var collectionName = (typeof data !== 'undefined' && data && data.config && data.config.collection_name) ? String(data.config.collection_name).trim() : '';

    if (collectionName) {
      root.__saeDistInit = false;
      loadCollection(root, collectionName, function () {
        root.__saeDistInit = false;
        initCore(root);
      });
      return;
    }

    root.__saeDistInit = false;
    initCore(root);
  }

  function initCore(root) {
    if (!root || root.__saeDistInit) { return; }
    root.__saeDistInit = true;

    var grid        = root.querySelector('[data-sae-grid]');
    var filtersWrap = root.querySelector('[data-sae-filters]');
    var searchInput = root.querySelector('[data-sae-search]');
    var searchClear = root.querySelector('[data-sae-search-clear]');
    var countEl     = root.querySelector('[data-sae-count]');
    var emptyEl     = root.querySelector('[data-sae-empty]');
    var resetBtn    = root.querySelector('[data-sae-reset]');

    var selectWrap    = root.querySelector('[data-sae-select]');
    var selectTrigger = root.querySelector('[data-sae-select-trigger]');
    var selectLabel   = root.querySelector('[data-sae-select-label]');
    var selectList    = root.querySelector('[data-sae-select-list]');

    if (!grid) { return; }

    var cards = toArray(grid.querySelectorAll('[data-sae-card]')).map(function (node) {
      var regions = splitContinents(node.getAttribute('data-continents'));
      /* Country and office names in the page's language. The English stays in
         the search text, so either finds the card. */
      var shown = [];
      var countryEl = node.querySelector('.sae-dist__country');
      var nameEl = node.querySelector('.sae-dist__name');
      if (countryEl) {
        var country = countryEl.textContent.trim();
        var countryLocal = translateCountry(country);
        if (countryLocal !== country) { countryEl.textContent = countryLocal; shown.push(countryLocal); }
      }
      if (nameEl) {
        var name = nameEl.textContent.trim();
        var nameLocal = translateName(name);
        if (nameLocal !== name) { nameEl.textContent = nameLocal; shown.push(nameLocal); }
      }
      regions.forEach(function (region) { if (regionLabel(region) !== region) { shown.push(regionLabel(region)); } });
      return {
        node: node,
        regions: regions,
        haystack: normalise((node.getAttribute('data-search') || node.textContent) + ' ' + shown.join(' '))
      };
    });

    if (!cards.length) { return; }

    var state = { region: ALL, query: '' };
    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    root.setAttribute('data-sae-anim', '');

    /* ---------------------------------------------------------------- data */

    var regions = [];
    cards.forEach(function (card) {
      card.regions.forEach(function (region) {
        if (regions.indexOf(region) === -1) { regions.push(region); }
      });
    });
    regions = sortRegions(regions);

    function countFor(region) {
      if (region === ALL) { return cards.length; }
      return cards.filter(function (card) {
        return card.regions.indexOf(region) !== -1;
      }).length;
    }

    var options = [{ value: ALL, label: T('allRegions'), count: cards.length }]
      .concat(regions.map(function (region) {
        return { value: region, label: regionLabel(region), count: countFor(region) };
      }));

    /* ------------------------------------------------------- sidebar list */

    var filterButtons = [];

    if (filtersWrap) {
      filtersWrap.innerHTML = '';
      options.forEach(function (option) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sae-dist__filter';
        btn.setAttribute('data-region', option.value);
        btn.setAttribute('aria-current', option.value === ALL ? 'true' : 'false');
        btn.innerHTML =
          '<span class="sae-dist__filter-text">' + escapeHtml(option.label) + '</span>' +
          '<span class="sae-dist__filter-count">' + option.count + '</span>' +
          '<span class="sae-dist__filter-arrow"><svg aria-hidden="true" focusable="false">' +
          '<use href="#sae-i-chevron"></use></svg></span>';
        btn.addEventListener('click', function () { setRegion(option.value); });
        filtersWrap.appendChild(btn);
        filterButtons.push(btn);
      });
    }

    /* ------------------------------------------------------ mobile dropdown */

    var optionButtons = [];
    var activeIndex = 0;

    if (selectList) {
      selectList.innerHTML = '';
      options.forEach(function (option, index) {
        var li = document.createElement('li');
        li.setAttribute('role', 'none');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sae-dist__option';
        btn.setAttribute('role', 'option');
        btn.setAttribute('data-region', option.value);
        btn.setAttribute('aria-selected', option.value === ALL ? 'true' : 'false');
        btn.style.animationDelay = (index * 40) + 'ms';
        btn.innerHTML =
          '<span class="sae-dist__option-text">' + escapeHtml(option.label) + '</span>' +
          '<span class="sae-dist__option-count">' + option.count + '</span>';

        btn.addEventListener('click', function () {
          setRegion(option.value);
          closeSelect(true);
        });

        li.appendChild(btn);
        selectList.appendChild(li);
        optionButtons.push(btn);
      });
    }

    function openSelect() {
      if (!selectWrap) { return; }
      selectWrap.classList.add('is-open');
      selectTrigger.setAttribute('aria-expanded', 'true');
      activeIndex = Math.max(0, optionButtons.findIndex(function (btn) {
        return btn.getAttribute('aria-selected') === 'true';
      }));
      highlight(activeIndex, false);
      document.addEventListener('click', onDocClick, true);
    }

    function closeSelect(focusTrigger) {
      if (!selectWrap || !selectWrap.classList.contains('is-open')) { return; }
      selectWrap.classList.remove('is-open');
      selectTrigger.setAttribute('aria-expanded', 'false');
      optionButtons.forEach(function (btn) { btn.classList.remove('is-active'); });
      document.removeEventListener('click', onDocClick, true);
      if (focusTrigger) { selectTrigger.focus(); }
    }

    function toggleSelect() {
      if (selectWrap.classList.contains('is-open')) { closeSelect(false); }
      else { openSelect(); }
    }

    function onDocClick(event) {
      if (!selectWrap.contains(event.target)) { closeSelect(false); }
    }

    function highlight(index, doFocus) {
      if (!optionButtons.length) { return; }
      activeIndex = (index + optionButtons.length) % optionButtons.length;
      optionButtons.forEach(function (btn, i) {
        btn.classList.toggle('is-active', i === activeIndex);
      });
      if (doFocus) { optionButtons[activeIndex].focus(); }
    }

    if (selectTrigger) {
      selectTrigger.addEventListener('click', toggleSelect);

      selectTrigger.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSelect();
          highlight(activeIndex, true);
        } else if (event.key === 'Escape') {
          closeSelect(false);
        }
      });
    }

    if (selectWrap) {
      selectWrap.addEventListener('keydown', function (event) {
        if (!selectWrap.classList.contains('is-open')) { return; }
        if (event.key === 'ArrowDown') {
          event.preventDefault(); highlight(activeIndex + 1, true);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault(); highlight(activeIndex - 1, true);
        } else if (event.key === 'Home') {
          event.preventDefault(); highlight(0, true);
        } else if (event.key === 'End') {
          event.preventDefault(); highlight(optionButtons.length - 1, true);
        } else if (event.key === 'Escape' || event.key === 'Tab') {
          closeSelect(event.key === 'Escape');
        }
      });
    }

    /* ------------------------------------------------------------- search */

    var searchTimer = null;

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        if (searchClear) { searchClear.hidden = !searchInput.value; }
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(function () {
          state.query = normalise(searchInput.value.trim());
          render();
        }, 140);
      });

      searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && searchInput.value) {
          event.preventDefault();
          clearSearch();
        }
      });
    }

    function clearSearch() {
      if (!searchInput) { return; }
      searchInput.value = '';
      state.query = '';
      if (searchClear) { searchClear.hidden = true; }
      render();
      searchInput.focus();
    }

    if (searchClear) { searchClear.addEventListener('click', clearSearch); }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (searchInput) { searchInput.value = ''; }
        if (searchClear) { searchClear.hidden = true; }
        state.query = '';
        setRegion(ALL);
      });
    }

    /* ------------------------------------------------------------- filter */

    function setRegion(region) {
      state.region = region;

      filterButtons.forEach(function (btn) {
        btn.setAttribute('aria-current', btn.getAttribute('data-region') === region ? 'true' : 'false');
      });

      optionButtons.forEach(function (btn) {
        btn.setAttribute('aria-selected', btn.getAttribute('data-region') === region ? 'true' : 'false');
      });

      if (selectLabel) {
        var match = options.filter(function (o) { return o.value === region; })[0];
        selectLabel.textContent = match ? match.label : T('allRegions');
      }

      render();
    }

    function matches(card) {
      var regionOk = state.region === ALL || card.regions.indexOf(state.region) !== -1;
      var queryOk = !state.query || card.haystack.indexOf(state.query) !== -1;
      return regionOk && queryOk;
    }

    /** "Showing 15 distributors in all regions", in the page's language and grammar. */
    function countText(visible) {
      if (visible === 0) { return T('noResults'); }
      var region = state.region === ALL ? T('inAll') : regionLabel(state.region);
      return TP(state.query ? 'showingSearch' : 'showing', visible, { region: region });
    }

    /* ------------------------------------------------------------- render */

    function render() {
      var visible = 0;

      cards.forEach(function (card) {
        var show = matches(card);
        card.node.hidden = !show;
        card.node.classList.remove('is-in');
        card.node.style.removeProperty('--sae-delay');
        if (show) {
          card.node.style.setProperty('--sae-delay', (visible * 70) + 'ms');
          visible++;
        }
      });

      /* force a reflow so the animation restarts on every filter change */
      void grid.offsetWidth;

      cards.forEach(function (card) {
        if (!card.node.hidden) { card.node.classList.add('is-in'); }
      });

      if (emptyEl) { emptyEl.hidden = visible !== 0; }
      grid.hidden = visible === 0;

      if (countEl) { countEl.textContent = countText(visible); }
    }

    /* --------------------------------------------------------- first paint */

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      cards.forEach(function (card) { card.node.classList.add('is-in'); });
      render();
      return;
    }

    cards.forEach(function (card, index) {
      card.node.style.setProperty('--sae-delay', (index * 70) + 'ms');
    });

    if (countEl) { countEl.textContent = countText(cards.length); }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    cards.forEach(function (card) { observer.observe(card.node); });
  }

  function boot() {
    var scope = (typeof element !== 'undefined' && element) ? element : document;
    var roots = [];

    if (scope !== document && scope.hasAttribute && scope.hasAttribute('data-sae-distributors')) {
      roots.push(scope);
    }
    roots = roots.concat(toArray(scope.querySelectorAll('[data-sae-distributors]')));
    roots.forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());

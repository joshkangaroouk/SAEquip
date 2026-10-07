/* =============================================================================
   SAEquip — Quote Basket page (cart list + quote request form)
   Self-contained: bundles the shared quote store (idempotent), so there is NO
   dependency on head HTML. In-page thank-you with Retrieve Basket / Back to Home.
   Form fields match the old WordPress quote form (updated 2026-10-02).
   Languages (2026-10-07): the page's own text is in the page's language, lines
   show in it too, and a quote reaches staff in English with the customer's
   language — the values sent (dates, countries) stay English throughout.
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

/* ── Basket page widget ────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* This widget's fixed text. Machine-drafted translations — awaiting a
     native speaker's review, like the rest of the site's widget text. */
  var TEXT = {
    en: {
      basket: "Your quote basket",
      title: "Your Quote Basket",
      empty: "No products added yet.",
      "continue": "Continue browsing",
      formTitle: "Request your quote",
      firstName: "First Name",
      lastName: "Last Name",
      company: "Company Name",
      email: "Email",
      phone: "Telephone",
      when: "When do you need this equipment?",
      pleaseSelect: "Please select…",
      whenUrgently: "Urgently",
      whenWeek: "Within the next week",
      whenMonth: "Within the next month",
      whenQuarter: "Within the next quarter",
      when3Months: "More than 3 months",
      whenPricing: "Pricing exercise only",
      whenUnsure: "Unsure",
      address: "Address",
      country: "Country",
      selectCountry: "Select a country / region…",
      postcode: "Postcode",
      message: "Message",
      submit: "Submit Quote Request",
      sending: "Sending…",
      thanksTitle: "Thank you - Quote request has been sent",
      thanksText: "Our team will review it and be in touch shortly.",
      retrieve: "Retrieve Basket",
      home: "Back to Home",
      sku: "SKU:",
      remove: "Remove",
      dec: "Decrease",
      inc: "Increase",
      qty: "Quantity",
      product: "Product",
      needFirstName: "first name",
      needLastName: "last name",
      needCompany: "company name",
      needEmail: "email",
      needPhone: "telephone",
      sep: ", ",
      complete: "Please complete: {list}.",
      emptyBasket: "Your basket is empty - add some products first.",
      errSend: "Something went wrong sending your request. Please try again or call us.",
      errNetwork: "Could not reach the server. Please check your connection and try again.",
      err429: "Too many requests. Please try again in a few minutes.",
      err400: "Please check your details and try again."
    },
    ar: {
      basket: "سلة عروض الأسعار الخاصة بك",
      title: "سلة عروض الأسعار الخاصة بك",
      empty: "لم تتم إضافة أي منتجات بعد.",
      "continue": "متابعة التصفح",
      formTitle: "اطلب عرض السعر",
      firstName: "الاسم الأول",
      lastName: "اسم العائلة",
      company: "اسم الشركة",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      when: "متى تحتاج إلى هذه المعدات؟",
      pleaseSelect: "يرجى الاختيار…",
      whenUrgently: "بشكل عاجل",
      whenWeek: "خلال الأسبوع القادم",
      whenMonth: "خلال الشهر القادم",
      whenQuarter: "خلال الربع القادم",
      when3Months: "بعد أكثر من 3 أشهر",
      whenPricing: "لمعرفة الأسعار فقط",
      whenUnsure: "غير متأكد",
      address: "العنوان",
      country: "الدولة",
      selectCountry: "اختر دولة / منطقة…",
      postcode: "الرمز البريدي",
      message: "الرسالة",
      submit: "إرسال طلب عرض السعر",
      sending: "جارٍ الإرسال…",
      thanksTitle: "شكرًا لك - تم إرسال طلب عرض السعر",
      thanksText: "سيراجعه فريقنا ويتواصل معك قريبًا.",
      retrieve: "استعادة السلة",
      home: "العودة إلى الصفحة الرئيسية",
      sku: "رمز المنتج:",
      remove: "إزالة",
      dec: "إنقاص",
      inc: "زيادة",
      qty: "الكمية",
      product: "منتج",
      needFirstName: "الاسم الأول",
      needLastName: "اسم العائلة",
      needCompany: "اسم الشركة",
      needEmail: "البريد الإلكتروني",
      needPhone: "الهاتف",
      sep: "، ",
      complete: "يرجى إكمال: {list}.",
      emptyBasket: "سلتك فارغة - أضف بعض المنتجات أولًا.",
      errSend: "حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى أو الاتصال بنا.",
      errNetwork: "عذرًا، تعذّر الوصول إلى الخادم. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
      err429: "طلبات كثيرة جدًا. يرجى المحاولة مرة أخرى بعد بضع دقائق.",
      err400: "يرجى التحقق من بياناتك والمحاولة مرة أخرى."
    },
    zh: {
      basket: "您的询价清单",
      title: "您的询价清单",
      empty: "尚未添加任何产品。",
      "continue": "继续浏览",
      formTitle: "申请报价",
      firstName: "名字",
      lastName: "姓氏",
      company: "公司名称",
      email: "电子邮箱",
      phone: "电话",
      when: "您何时需要此设备？",
      pleaseSelect: "请选择…",
      whenUrgently: "紧急",
      whenWeek: "一周内",
      whenMonth: "一个月内",
      whenQuarter: "一个季度内",
      when3Months: "3 个月以上",
      whenPricing: "仅询价",
      whenUnsure: "尚不确定",
      address: "地址",
      country: "国家/地区",
      selectCountry: "请选择国家/地区…",
      postcode: "邮政编码",
      message: "留言",
      submit: "提交询价请求",
      sending: "正在发送…",
      thanksTitle: "谢谢 - 您的询价请求已发送",
      thanksText: "我们的团队将进行审核，并会尽快与您联系。",
      retrieve: "恢复清单",
      home: "返回首页",
      sku: "SKU：",
      remove: "移除",
      dec: "减少",
      inc: "增加",
      qty: "数量",
      product: "产品",
      needFirstName: "名字",
      needLastName: "姓氏",
      needCompany: "公司名称",
      needEmail: "电子邮箱",
      needPhone: "电话",
      sep: "、",
      complete: "请填写：{list}。",
      emptyBasket: "您的清单为空 - 请先添加产品。",
      errSend: "发送请求时出现问题。请重试或致电我们。",
      errNetwork: "抱歉，无法连接服务器。请检查网络连接后重试。",
      err429: "请求过多，请几分钟后再试。",
      err400: "请检查您填写的信息后重试。"
    },
    fr: {
      basket: "Votre panier de devis",
      title: "Votre panier de devis",
      empty: "Aucun produit ajouté pour le moment.",
      "continue": "Continuer mes recherches",
      formTitle: "Demandez votre devis",
      firstName: "Prénom",
      lastName: "Nom",
      company: "Nom de l'entreprise",
      email: "E-mail",
      phone: "Téléphone",
      when: "Quand avez-vous besoin de cet équipement ?",
      pleaseSelect: "Veuillez sélectionner…",
      whenUrgently: "De toute urgence",
      whenWeek: "Dans la semaine",
      whenMonth: "Dans le mois",
      whenQuarter: "Dans le trimestre",
      when3Months: "Dans plus de 3 mois",
      whenPricing: "Estimation de prix uniquement",
      whenUnsure: "Je ne sais pas encore",
      address: "Adresse",
      country: "Pays",
      selectCountry: "Sélectionnez un pays / une région…",
      postcode: "Code postal",
      message: "Message",
      submit: "Envoyer la demande de devis",
      sending: "Envoi…",
      thanksTitle: "Merci - votre demande de devis a été envoyée",
      thanksText: "Notre équipe va l'examiner et vous recontactera très prochainement.",
      retrieve: "Récupérer le panier",
      home: "Retour à l'accueil",
      sku: "Réf. :",
      remove: "Retirer",
      dec: "Diminuer",
      inc: "Augmenter",
      qty: "Quantité",
      product: "Produit",
      needFirstName: "prénom",
      needLastName: "nom",
      needCompany: "nom de l'entreprise",
      needEmail: "e-mail",
      needPhone: "téléphone",
      sep: ", ",
      complete: "Veuillez renseigner : {list}.",
      emptyBasket: "Votre panier est vide - ajoutez d'abord des produits.",
      errSend: "Un problème est survenu lors de l'envoi de votre demande. Veuillez réessayer ou nous appeler.",
      errNetwork: "Désolé, impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
      err429: "Trop de demandes. Veuillez réessayer dans quelques minutes.",
      err400: "Veuillez vérifier vos informations et réessayer."
    },
    de: {
      basket: "Ihr Angebotskorb",
      title: "Ihr Angebotskorb",
      empty: "Noch keine Produkte hinzugefügt.",
      "continue": "Weiter stöbern",
      formTitle: "Angebot anfordern",
      firstName: "Vorname",
      lastName: "Nachname",
      company: "Firmenname",
      email: "E-Mail",
      phone: "Telefon",
      when: "Wann benötigen Sie diese Ausrüstung?",
      pleaseSelect: "Bitte auswählen…",
      whenUrgently: "Dringend",
      whenWeek: "Innerhalb der nächsten Woche",
      whenMonth: "Innerhalb des nächsten Monats",
      whenQuarter: "Innerhalb des nächsten Quartals",
      when3Months: "In mehr als 3 Monaten",
      whenPricing: "Nur zur Preisermittlung",
      whenUnsure: "Noch unklar",
      address: "Adresse",
      country: "Land",
      selectCountry: "Land / Region auswählen…",
      postcode: "Postleitzahl",
      message: "Nachricht",
      submit: "Angebotsanfrage senden",
      sending: "Wird gesendet…",
      thanksTitle: "Vielen Dank - Ihre Angebotsanfrage wurde gesendet",
      thanksText: "Unser Team prüft sie und meldet sich in Kürze bei Ihnen.",
      retrieve: "Korb wiederherstellen",
      home: "Zurück zur Startseite",
      sku: "Art.-Nr.:",
      remove: "Entfernen",
      dec: "Verringern",
      inc: "Erhöhen",
      qty: "Menge",
      product: "Produkt",
      needFirstName: "Vorname",
      needLastName: "Nachname",
      needCompany: "Firmenname",
      needEmail: "E-Mail",
      needPhone: "Telefon",
      sep: ", ",
      complete: "Bitte ausfüllen: {list}.",
      emptyBasket: "Ihr Korb ist leer - bitte fügen Sie zuerst Produkte hinzu.",
      errSend: "Beim Senden Ihrer Anfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder rufen Sie uns an.",
      errNetwork: "Der Server ist leider nicht erreichbar. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
      err429: "Zu viele Anfragen. Bitte versuchen Sie es in ein paar Minuten erneut.",
      err400: "Bitte überprüfen Sie Ihre Angaben und versuchen Sie es erneut."
    },
    "pt-br": {
      basket: "Sua cesta de orçamentos",
      title: "Sua cesta de orçamentos",
      empty: "Nenhum produto adicionado ainda.",
      "continue": "Continuar navegando",
      formTitle: "Solicite seu orçamento",
      firstName: "Nome",
      lastName: "Sobrenome",
      company: "Nome da empresa",
      email: "E-mail",
      phone: "Telefone",
      when: "Quando você precisa deste equipamento?",
      pleaseSelect: "Selecione…",
      whenUrgently: "Com urgência",
      whenWeek: "Na próxima semana",
      whenMonth: "No próximo mês",
      whenQuarter: "No próximo trimestre",
      when3Months: "Em mais de 3 meses",
      whenPricing: "Apenas cotação de preços",
      whenUnsure: "Ainda não sei",
      address: "Endereço",
      country: "País",
      selectCountry: "Selecione um país ou região…",
      postcode: "CEP",
      message: "Mensagem",
      submit: "Enviar solicitação de orçamento",
      sending: "Enviando…",
      thanksTitle: "Obrigado - sua solicitação de orçamento foi enviada",
      thanksText: "Nossa equipe vai analisá-la e entrará em contato em breve.",
      retrieve: "Recuperar cesta",
      home: "Voltar ao início",
      sku: "SKU:",
      remove: "Remover",
      dec: "Diminuir",
      inc: "Aumentar",
      qty: "Quantidade",
      product: "Produto",
      needFirstName: "nome",
      needLastName: "sobrenome",
      needCompany: "nome da empresa",
      needEmail: "e-mail",
      needPhone: "telefone",
      sep: ", ",
      complete: "Preencha: {list}.",
      emptyBasket: "Sua cesta está vazia - adicione alguns produtos primeiro.",
      errSend: "Ocorreu um erro ao enviar sua solicitação. Tente novamente ou ligue para nós.",
      errNetwork: "Desculpe, não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
      err429: "Muitas solicitações. Tente novamente em alguns minutos.",
      err400: "Verifique seus dados e tente novamente."
    },
    es: {
      basket: "Su cesta de presupuestos",
      title: "Su cesta de presupuestos",
      empty: "Aún no ha añadido ningún producto.",
      "continue": "Seguir navegando",
      formTitle: "Solicite su presupuesto",
      firstName: "Nombre",
      lastName: "Apellidos",
      company: "Nombre de la empresa",
      email: "Correo electrónico",
      phone: "Teléfono",
      when: "¿Cuándo necesita este equipo?",
      pleaseSelect: "Seleccione…",
      whenUrgently: "Con urgencia",
      whenWeek: "En la próxima semana",
      whenMonth: "En el próximo mes",
      whenQuarter: "En el próximo trimestre",
      when3Months: "En más de 3 meses",
      whenPricing: "Solo consulta de precios",
      whenUnsure: "No estoy seguro",
      address: "Dirección",
      country: "País",
      selectCountry: "Seleccione un país o región…",
      postcode: "Código postal",
      message: "Mensaje",
      submit: "Enviar solicitud de presupuesto",
      sending: "Enviando…",
      thanksTitle: "Gracias - su solicitud de presupuesto se ha enviado",
      thanksText: "Nuestro equipo la revisará y se pondrá en contacto con usted en breve.",
      retrieve: "Recuperar la cesta",
      home: "Volver al inicio",
      sku: "Ref.:",
      remove: "Eliminar",
      dec: "Reducir",
      inc: "Aumentar",
      qty: "Cantidad",
      product: "Producto",
      needFirstName: "nombre",
      needLastName: "apellidos",
      needCompany: "nombre de la empresa",
      needEmail: "correo electrónico",
      needPhone: "teléfono",
      sep: ", ",
      complete: "Complete: {list}.",
      emptyBasket: "Su cesta está vacía - añada primero algunos productos.",
      errSend: "Se ha producido un error al enviar su solicitud. Vuelva a intentarlo o llámenos.",
      errNetwork: "Lo sentimos, no hemos podido conectar con el servidor. Compruebe su conexión y vuelva a intentarlo.",
      err429: "Demasiadas solicitudes. Vuelva a intentarlo en unos minutos.",
      err400: "Revise sus datos y vuelva a intentarlo."
    }
  };
  var I18n = window.SAEquipQuoteI18n;
  function T(key, vars) { return I18n ? I18n.t(TEXT, key, vars) : TEXT.en[key]; }

  /* ▼▼ SET THIS to your server endpoint ▼▼ */
  var ENDPOINT = 'https://sa-equip-backend.vercel.app/public/quotes';
  /* ▼▼ SET THIS to your home page URL/slug ▼▼ */
  var HOME_URL = '/';
  /* ▲▲ ───────────────────────────────────────────────────────────────── ▲▲ */

  /* The same country names the WordPress quote form used, so old and new
     quote requests read alike — those English names are what is SENT, in every
     language. Each carries its ISO code so another language can show the name
     in that language (Intl.DisplayNames). United Kingdom first — most
     customers are UK. */
  var FIRST_COUNTRY = ["GB", "United Kingdom (UK)"];
  var COUNTRIES = [
    ["AF", "Afghanistan"], ["AX", "Åland Islands"], ["AL", "Albania"],
    ["DZ", "Algeria"], ["AS", "American Samoa"], ["AD", "Andorra"],
    ["AO", "Angola"], ["AI", "Anguilla"], ["AQ", "Antarctica"],
    ["AG", "Antigua and Barbuda"], ["AR", "Argentina"], ["AM", "Armenia"],
    ["AW", "Aruba"], ["AU", "Australia"], ["AT", "Austria"],
    ["AZ", "Azerbaijan"], ["BS", "Bahamas"], ["BH", "Bahrain"],
    ["BD", "Bangladesh"], ["BB", "Barbados"], ["BY", "Belarus"],
    ["PW", "Belau"], ["BE", "Belgium"], ["BZ", "Belize"],
    ["DY", "Benin"], ["BM", "Bermuda"], ["BT", "Bhutan"],
    ["BO", "Bolivia"], ["BQ", "Bonaire, Saint Eustatius and Saba"], ["BA", "Bosnia and Herzegovina"],
    ["BW", "Botswana"], ["BV", "Bouvet Island"], ["BR", "Brazil"],
    ["IO", "British Indian Ocean Territory"], ["BN", "Brunei"], ["BG", "Bulgaria"],
    ["HV", "Burkina Faso"], ["BI", "Burundi"], ["KH", "Cambodia"],
    ["CM", "Cameroon"], ["CA", "Canada"], ["CV", "Cape Verde"],
    ["KY", "Cayman Islands"], ["CF", "Central African Republic"], ["TD", "Chad"],
    ["CL", "Chile"], ["CN", "China"], ["CX", "Christmas Island"],
    ["CC", "Cocos (Keeling) Islands"], ["CO", "Colombia"], ["KM", "Comoros"],
    ["CG", "Congo (Brazzaville)"], ["CD", "Congo (Kinshasa)"], ["CK", "Cook Islands"],
    ["CR", "Costa Rica"], ["HR", "Croatia"], ["CU", "Cuba"],
    ["CW", "Curaçao"], ["CY", "Cyprus"], ["CZ", "Czech Republic"],
    ["DK", "Denmark"], ["DJ", "Djibouti"], ["DM", "Dominica"],
    ["DO", "Dominican Republic"], ["EC", "Ecuador"], ["EG", "Egypt"],
    ["SV", "El Salvador"], ["GQ", "Equatorial Guinea"], ["ER", "Eritrea"],
    ["EE", "Estonia"], ["SZ", "Eswatini"], ["ET", "Ethiopia"],
    ["FK", "Falkland Islands"], ["FO", "Faroe Islands"], ["FJ", "Fiji"],
    ["FI", "Finland"], ["FX", "France"], ["GF", "French Guiana"],
    ["PF", "French Polynesia"], ["TF", "French Southern Territories"], ["GA", "Gabon"],
    ["GM", "Gambia"], ["GE", "Georgia"], ["DE", "Germany"],
    ["GH", "Ghana"], ["GI", "Gibraltar"], ["GR", "Greece"],
    ["GL", "Greenland"], ["GD", "Grenada"], ["GP", "Guadeloupe"],
    ["GU", "Guam"], ["GT", "Guatemala"], ["GG", "Guernsey"],
    ["GN", "Guinea"], ["GW", "Guinea-Bissau"], ["GY", "Guyana"],
    ["HT", "Haiti"], ["HM", "Heard Island and McDonald Islands"], ["HN", "Honduras"],
    ["HK", "Hong Kong"], ["HU", "Hungary"], ["IS", "Iceland"],
    ["IN", "India"], ["ID", "Indonesia"], ["IR", "Iran"],
    ["IQ", "Iraq"], ["IE", "Ireland"], ["IM", "Isle of Man"],
    ["IL", "Israel"], ["IT", "Italy"], ["CI", "Ivory Coast"],
    ["JM", "Jamaica"], ["JP", "Japan"], ["JE", "Jersey"],
    ["JO", "Jordan"], ["KZ", "Kazakhstan"], ["KE", "Kenya"],
    ["KI", "Kiribati"], ["XK", "Kosovo"], ["KW", "Kuwait"],
    ["KG", "Kyrgyzstan"], ["LA", "Laos"], ["LV", "Latvia"],
    ["LB", "Lebanon"], ["LS", "Lesotho"], ["LR", "Liberia"],
    ["LY", "Libya"], ["LI", "Liechtenstein"], ["LT", "Lithuania"],
    ["LU", "Luxembourg"], ["MO", "Macao"], ["MG", "Madagascar"],
    ["MW", "Malawi"], ["MY", "Malaysia"], ["MV", "Maldives"],
    ["ML", "Mali"], ["MT", "Malta"], ["MH", "Marshall Islands"],
    ["MQ", "Martinique"], ["MR", "Mauritania"], ["MU", "Mauritius"],
    ["YT", "Mayotte"], ["MX", "Mexico"], ["FM", "Micronesia"],
    ["MD", "Moldova"], ["MC", "Monaco"], ["MN", "Mongolia"],
    ["ME", "Montenegro"], ["MS", "Montserrat"], ["MA", "Morocco"],
    ["MZ", "Mozambique"], ["MM", "Myanmar"], ["NA", "Namibia"],
    ["NR", "Nauru"], ["NP", "Nepal"], ["NL", "Netherlands"],
    ["NC", "New Caledonia"], ["NZ", "New Zealand"], ["NI", "Nicaragua"],
    ["NE", "Niger"], ["NG", "Nigeria"], ["NU", "Niue"],
    ["NF", "Norfolk Island"], ["KP", "North Korea"], ["MK", "North Macedonia"],
    ["MP", "Northern Mariana Islands"], ["NO", "Norway"], ["OM", "Oman"],
    ["PK", "Pakistan"], ["PS", "Palestinian Territory"], ["PA", "Panama"],
    ["PG", "Papua New Guinea"], ["PY", "Paraguay"], ["PE", "Peru"],
    ["PH", "Philippines"], ["PN", "Pitcairn"], ["PL", "Poland"],
    ["PT", "Portugal"], ["PR", "Puerto Rico"], ["QA", "Qatar"],
    ["RE", "Reunion"], ["RO", "Romania"], ["RU", "Russia"],
    ["RW", "Rwanda"], ["ST", "São Tomé and Príncipe"], ["BL", "Saint Barthélemy"],
    ["SH", "Saint Helena"], ["KN", "Saint Kitts and Nevis"], ["LC", "Saint Lucia"],
    ["SX", "Saint Martin (Dutch part)"], ["MF", "Saint Martin (French part)"], ["PM", "Saint Pierre and Miquelon"],
    ["VC", "Saint Vincent and the Grenadines"], ["WS", "Samoa"], ["SM", "San Marino"],
    ["SA", "Saudi Arabia"], ["SN", "Senegal"], ["YU", "Serbia"],
    ["SC", "Seychelles"], ["SL", "Sierra Leone"], ["SG", "Singapore"],
    ["SK", "Slovakia"], ["SI", "Slovenia"], ["SB", "Solomon Islands"],
    ["SO", "Somalia"], ["ZA", "South Africa"], ["GS", "South Georgia/Sandwich Islands"],
    ["KR", "South Korea"], ["SS", "South Sudan"], ["ES", "Spain"],
    ["LK", "Sri Lanka"], ["SD", "Sudan"], ["SR", "Suriname"],
    ["SJ", "Svalbard and Jan Mayen"], ["SE", "Sweden"], ["CH", "Switzerland"],
    ["SY", "Syria"], ["TW", "Taiwan"], ["TJ", "Tajikistan"],
    ["TZ", "Tanzania"], ["TH", "Thailand"], ["TL", "Timor-Leste"],
    ["TG", "Togo"], ["TK", "Tokelau"], ["TO", "Tonga"],
    ["TT", "Trinidad and Tobago"], ["TN", "Tunisia"], ["TR", "Türkiye"],
    ["TM", "Turkmenistan"], ["TC", "Turks and Caicos Islands"], ["TV", "Tuvalu"],
    ["UG", "Uganda"], ["UA", "Ukraine"], ["AE", "United Arab Emirates"],
    ["US", "United States (US)"], ["UM", "United States (US) Minor Outlying Islands"], ["UY", "Uruguay"],
    ["UZ", "Uzbekistan"], ["VU", "Vanuatu"], ["VA", "Vatican"],
    ["VE", "Venezuela"], ["VN", "Vietnam"], ["VG", "Virgin Islands (British)"],
    ["VI", "Virgin Islands (US)"], ["WF", "Wallis and Futuna"], ["EH", "Western Sahara"],
    ["YE", "Yemen"], ["ZM", "Zambia"], ["ZW", "Zimbabwe"]
  ];

  var loadedAt = Date.now();   /* used for the bot "too fast" check */

  function boot(Quote) {
    var cartEl     = document.getElementById('qp-cart');
    var itemsEl    = document.getElementById('qp-items');
    var emptyEl    = document.getElementById('qp-empty');
    var formSec    = document.getElementById('qp-form-section');
    var form       = document.getElementById('qp-form');
    var statusEl   = document.getElementById('qp-status');
    var submitEl   = document.getElementById('qp-submit');
    var thanksEl   = document.getElementById('qp-thanks');
    var retrieveEl = document.getElementById('qp-retrieve');
    var homeEl     = document.getElementById('qp-home');
    var countryEl  = document.getElementById('qp-country');
    if (!itemsEl || !form) return;

    var lang = I18n ? I18n.locale() : 'en';
    if (I18n) I18n.apply(cartEl.parentNode || cartEl, TEXT);
    if (homeEl) homeEl.setAttribute('href', I18n ? I18n.href(HOME_URL) : HOME_URL);

    /* ── country dropdown: UK first, a divider, then everything else A–Z ──
       ⚠️ The VALUE is always the English name — what staff read; another
       language only changes the text shown, and re-sorts it in that language. */
    if (countryEl && countryEl.options.length <= 1) {
      var tag = lang === 'pt-br' ? 'pt-BR' : lang === 'zh' ? 'zh-Hans' : lang;
      var regionName = null;
      if (lang !== 'en') {
        try {
          var dn = new Intl.DisplayNames([tag], { type: 'region' });
          regionName = function (code, english) { var n = dn.of(code); return n && n !== code ? n : english; };
        } catch (e) { regionName = null; }
      }
      var label = function (c) { return regionName ? regionName(c[0], c[1]) : c[1]; };
      var addOpt = function (text, value, disabled) {
        var o = document.createElement('option');
        o.textContent = text;
        if (disabled) { o.disabled = true; o.value = ''; } else { o.value = value; }
        countryEl.appendChild(o);
      };
      addOpt(label(FIRST_COUNTRY), FIRST_COUNTRY[1]);
      addOpt('──────────', '', true);
      var list = COUNTRIES.slice();
      if (regionName) {
        var collator = null;
        try { collator = new Intl.Collator(tag); } catch (e) {}
        list.sort(function (a, b) { return collator ? collator.compare(label(a), label(b)) : (label(a) < label(b) ? -1 : 1); });
      }
      list.forEach(function (c) { addOpt(label(c), c[1]); });
    }

    /* Names and options in the page's language once they arrive; until then
       (and if they never do) each line shows as it was saved. */
    var labelsL = null;

    var thanked = false;        /* true once a quote has been submitted */
    var lastSubmitted = null;   /* in-memory snapshot for Retrieve Basket */

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function safeUrl(u) { u = String(u || ''); return /^https?:\/\//i.test(u) ? u : ''; }

    function optionRows(opts) {
      if (!opts) return '';
      return Object.keys(opts).map(function (k) {
        return '<span class="qp-opt"><b>' + esc(k) + ':</b> ' + esc(opts[k]) + '</span>';
      }).join('');
    }

    function itemRow(item, index) {
      var shown = I18n ? I18n.view(item, labelsL) : item;
      var url   = safeUrl(shown.url);
      var open  = url ? '<a class="qp-link" href="' + esc(url) + '">' : '';
      var close = url ? '</a>' : '';
      var imgInner = item.image
        ? '<img class="qp-thumb" src="' + esc(item.image) + '" alt="" loading="lazy">'
        : '<span class="qp-thumb qp-thumb--ph"></span>';
      var img = open + imgInner + close;
      var qty = parseInt(item.quantity, 10) || 1;
      return '<div class="qp-item" data-index="' + index + '">' +
          img +
          '<div class="qp-item-main">' +
            '<div class="qp-item-name">' + open + esc(shown.name || T('product')) + close + '</div>' +
            (item.sku ? '<div class="qp-item-sku">' + esc(T('sku')) + ' ' + esc(item.sku) + '</div>' : '') +
            '<div class="qp-item-options">' + optionRows(shown.options) + '</div>' +
          '</div>' +
          '<div class="qp-item-side">' +
            '<div class="qp-qty">' +
              '<button type="button" class="qp-qty-dec" data-index="' + index + '" aria-label="' + esc(T('dec')) + '">&minus;</button>' +
              '<input class="qp-qty-input" type="number" min="1" value="' + qty + '" data-index="' + index + '" aria-label="' + esc(T('qty')) + '">' +
              '<button type="button" class="qp-qty-inc" data-index="' + index + '" aria-label="' + esc(T('inc')) + '">+</button>' +
            '</div>' +
            '<button type="button" class="qp-remove" data-index="' + index + '">' + esc(T('remove')) + '</button>' +
          '</div>' +
        '</div>';
    }

    function render(basket) {
      /* thank-you state replaces cart + form entirely */
      if (thanked) {
        cartEl.style.display   = 'none';
        formSec.style.display  = 'none';
        thanksEl.style.display = 'block';
        return;
      }
      thanksEl.style.display = 'none';
      cartEl.style.display   = 'block';

      basket = basket || Quote.get();
      var has = basket.length > 0;
      emptyEl.style.display  = has ? 'none' : 'block';
      itemsEl.style.display  = has ? 'flex' : 'none';
      formSec.style.display  = has ? 'block' : 'none';

      if (!has) { itemsEl.innerHTML = ''; return; }
      itemsEl.innerHTML = basket.map(itemRow).join('');
    }

    /* qty + remove via delegation; data-index is fresh on each render */
    itemsEl.addEventListener('click', function (e) {
      var t = e.target;
      var idx = t.getAttribute && t.getAttribute('data-index');
      if (idx === null || idx === undefined) return;
      idx = parseInt(idx, 10);
      if (isNaN(idx)) return;
      var basket = Quote.get();
      if (t.classList.contains('qp-remove')) {
        Quote.remove(idx);
      } else if (t.classList.contains('qp-qty-inc')) {
        Quote.setQuantity(idx, (parseInt(basket[idx].quantity, 10) || 1) + 1);
      } else if (t.classList.contains('qp-qty-dec')) {
        Quote.setQuantity(idx, (parseInt(basket[idx].quantity, 10) || 1) - 1);
      }
    });
    itemsEl.addEventListener('change', function (e) {
      if (!e.target.classList.contains('qp-qty-input')) return;
      var idx = parseInt(e.target.getAttribute('data-index'), 10);
      if (!isNaN(idx)) Quote.setQuantity(idx, e.target.value);
    });

    /* ── Retrieve Basket: restore the submitted items and show cart again ── */
    if (retrieveEl) {
      retrieveEl.addEventListener('click', function () {
        thanked = false;
        if (lastSubmitted && lastSubmitted.length) {
          lastSubmitted.forEach(function (it) { Quote.add(it); });
        }
        lastSubmitted = null;
        render();
      });
    }

    /* ── form submit ──────────────────────────────────────────────────── */
    function status(type, msg) {
      statusEl.className = 'qp-status is-' + type;
      statusEl.textContent = msg;
    }

    /* A form control by its name attribute. Looked up explicitly rather than as
       `form.name`, which collides with the form element's own properties. */
    function field(name) { return form.querySelector('[name="' + name + '"]'); }
    function value(name) { var el = field(name); return el ? String(el.value || '').trim() : ''; }

    /* Required fields — the same set the WordPress quote form required. */
    var REQUIRED = [
      ['firstName', T('needFirstName')],
      ['lastName',  T('needLastName')],
      ['company',   T('needCompany')],
      ['email',     T('needEmail')],
      ['phone',     T('needPhone')]
    ];

    /* clear a field's red border as soon as it is corrected */
    form.addEventListener('input', function (e) {
      if (e.target && e.target.classList) e.target.classList.remove('qp-invalid');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      statusEl.className = 'qp-status';
      statusEl.textContent = '';

      var email = value('email');
      var missing = [];
      REQUIRED.forEach(function (r) {
        var el = field(r[0]);
        var ok = value(r[0]) !== '' && (r[0] !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
        if (el) el.classList.toggle('qp-invalid', !ok);
        if (!ok) missing.push(r[1]);
      });
      if (missing.length) {
        var bad = form.querySelector('.qp-invalid');
        if (bad && bad.focus) bad.focus();
        status('error', T('complete', { list: missing.join(T('sep')) }));
        return;
      }

      var basket = Quote.get();
      if (!basket.length) {
        status('error', T('emptyBasket'));
        return;
      }

      var payload = {
        firstName:  value('firstName'),
        lastName:   value('lastName'),
        company:    value('company'),
        email:      email,
        phone:      value('phone'),
        requiredBy: value('requiredBy'),
        address:    value('address'),
        country:    value('country'),
        postcode:   value('postcode'),
        message:    value('message'),
        website:    field('website') ? field('website').value : '',   /* honeypot */
        elapsedMs:  Date.now() - loadedAt,
        locale:     lang,
        /* As shown on this page, plus Duda's ids: the server turns those into
           the English names staff read. Lines without ids go as they are. */
        items: basket.map(function (it) {
          var shown = I18n ? I18n.view(it, labelsL) : it;
          var line = {
            name: shown.name || it.name, sku: it.sku, options: shown.options,
            quantity: parseInt(it.quantity, 10) || 1
          };
          if (shown.dudaId) line.dudaId = shown.dudaId;
          if (it.choices) line.choices = it.choices;
          return line;
        })
      };

      submitEl.disabled = true;
      var original = submitEl.textContent;
      submitEl.textContent = T('sending');

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function (r) {
        return r.text().then(function (text) {
          var data = {};
          try { data = text ? JSON.parse(text) : {}; } catch (err) {}
          return { httpOk: r.ok, data: data, status: r.status };
        });
      })
      .then(function (res) {
        /* success = HTTP 2xx, unless the body explicitly says ok:false */
        var success = res.httpOk && res.data.ok !== false;
        if (success) {
          /* snapshot the full items (with price/image) for Retrieve Basket */
          lastSubmitted = Quote.get().map(function (it) {
            return JSON.parse(JSON.stringify(it));
          });
          submitEl.disabled = false;
          submitEl.textContent = original;
          thanked = true;
          Quote.clear();     /* header count -> 0; onChange re-renders */
          render();          /* show the thank-you panel */
        } else {
          /* The server's own message is English, so other languages show
             one of their own by status — English keeps the server's words. */
          var msg = lang === 'en'
            ? res.data.error || T('errSend')
            : res.status === 429 ? T('err429') : res.status === 400 ? T('err400') : T('errSend');
          status('error', msg);
          submitEl.disabled = false;
          submitEl.textContent = original;
        }
      })
      .catch(function () {
        status('error', T('errNetwork'));
        submitEl.disabled = false;
        submitEl.textContent = original;
      });
    });

    render();
    Quote.onChange(render);
    if (I18n) I18n.labels().then(function (v) { if (v) { labelsL = v; render(); } });
  }

  /* run once the DOM is ready (store is already defined synchronously above) */
  function startWhenReady() {
    var Quote = window.SAEquipQuote;
    if (!Quote) { console.error('[SAEquip] quote store missing'); return; }
    boot(Quote);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWhenReady);
  } else {
    startWhenReady();
  }
})();

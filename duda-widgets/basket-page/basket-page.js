/* =============================================================================
   SAEquip — Quote Basket page (cart list + quote request form)
   Self-contained: bundles the shared quote store (idempotent), so there is NO
   dependency on head HTML. In-page thank-you with Retrieve Basket / Back to Home.
   Form fields match the old WordPress quote form (updated 2026-10-02).
   ============================================================================= */

/* ── Shared quote store (identical block in every quote widget; idempotent) ── */
(function () {
  'use strict';
  if (window.SAEquipQuote) return;

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
  function optionsKey(opts) {
    opts = opts || {};
    return JSON.stringify(Object.keys(opts).sort().reduce(function (a, k) { a[k] = opts[k]; return a; }, {}));
  }

  window.SAEquipQuote = {
    KEY: KEY, EVENT: EVENT, get: read,
    count: function () { return read().reduce(function (n, e) { return n + (parseInt(e.quantity, 10) || 1); }, 0); },
    add: function (item) {
      var basket = read();
      var key = optionsKey(item.options);
      var existing = basket.find(function (e) {
        return e.name === item.name && e.sku === item.sku && optionsKey(e.options) === key;
      });
      if (existing) {
        existing.quantity = (parseInt(existing.quantity, 10) || 1) + (parseInt(item.quantity, 10) || 1);
        existing.addedAt  = new Date().toISOString();
      } else {
        basket.push({
          name:  item.name || '', sku: item.sku || '', options: item.options || {},
          price: item.price || '', image: item.image || '', url: item.url || '',
          quantity: parseInt(item.quantity, 10) || 1, addedAt: new Date().toISOString()
        });
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

/* ── Basket page widget ────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ▼▼ SET THIS to your server endpoint ▼▼ */
  var ENDPOINT = 'https://sa-equip-backend.vercel.app/public/quotes';
  /* ▼▼ SET THIS to your home page URL/slug ▼▼ */
  var HOME_URL = '/';
  /* ▲▲ ───────────────────────────────────────────────────────────────── ▲▲ */

  /* The same country names the WordPress quote form used, so old and new
     quote requests read alike. United Kingdom first — most customers are UK. */
  var FIRST_COUNTRY = 'United Kingdom (UK)';
  var COUNTRIES = [
    "Afghanistan", "Åland Islands", "Albania", "Algeria", "American Samoa", "Andorra",
    "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia",
    "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
    "Bangladesh", "Barbados", "Belarus", "Belau", "Belgium", "Belize",
    "Benin", "Bermuda", "Bhutan", "Bolivia", "Bonaire, Saint Eustatius and Saba", "Bosnia and Herzegovina",
    "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde",
    "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island",
    "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo (Brazzaville)", "Congo (Kinshasa)", "Cook Islands",
    "Costa Rica", "Croatia", "Cuba", "Curaçao", "Cyprus", "Czech Republic",
    "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
    "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
    "Falkland Islands", "Faroe Islands", "Fiji", "Finland", "France", "French Guiana",
    "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany",
    "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe",
    "Guam", "Guatemala", "Guernsey", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Heard Island and McDonald Islands", "Honduras", "Hong Kong", "Hungary", "Iceland",
    "India", "Indonesia", "Iran", "Iraq", "Ireland", "Isle of Man",
    "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jersey",
    "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait",
    "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
    "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Madagascar",
    "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
    "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia",
    "Moldova", "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco",
    "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
    "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue",
    "Norfolk Island", "North Korea", "North Macedonia", "Northern Mariana Islands", "Norway", "Oman",
    "Pakistan", "Palestinian Territory", "Panama", "Papua New Guinea", "Paraguay", "Peru",
    "Philippines", "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar",
    "Reunion", "Romania", "Russia", "Rwanda", "São Tomé and Príncipe", "Saint Barthélemy",
    "Saint Helena", "Saint Kitts and Nevis", "Saint Lucia", "Saint Martin (Dutch part)", "Saint Martin (French part)", "Saint Pierre and Miquelon",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Saudi Arabia", "Senegal", "Serbia",
    "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
    "Somalia", "South Africa", "South Georgia/Sandwich Islands", "South Korea", "South Sudan", "Spain",
    "Sri Lanka", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Sweden", "Switzerland",
    "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste",
    "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye",
    "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
    "United States (US)", "United States (US) Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican",
    "Venezuela", "Vietnam", "Virgin Islands (British)", "Virgin Islands (US)", "Wallis and Futuna", "Western Sahara",
    "Yemen", "Zambia", "Zimbabwe"
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

    if (homeEl) homeEl.setAttribute('href', HOME_URL);

    /* ── country dropdown: UK first, a divider, then everything else A–Z ── */
    if (countryEl && countryEl.options.length <= 1) {
      var addOpt = function (text, disabled) {
        var o = document.createElement('option');
        o.textContent = text;
        if (disabled) { o.disabled = true; o.value = ''; } else { o.value = text; }
        countryEl.appendChild(o);
      };
      addOpt(FIRST_COUNTRY);
      addOpt('──────────', true);
      COUNTRIES.forEach(function (c) { addOpt(c); });
    }

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
      var url   = safeUrl(item.url);
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
            '<div class="qp-item-name">' + open + esc(item.name || 'Product') + close + '</div>' +
            (item.sku ? '<div class="qp-item-sku">SKU: ' + esc(item.sku) + '</div>' : '') +
            '<div class="qp-item-options">' + optionRows(item.options) + '</div>' +
          '</div>' +
          '<div class="qp-item-side">' +
            '<div class="qp-qty">' +
              '<button type="button" class="qp-qty-dec" data-index="' + index + '" aria-label="Decrease">&minus;</button>' +
              '<input class="qp-qty-input" type="number" min="1" value="' + qty + '" data-index="' + index + '" aria-label="Quantity">' +
              '<button type="button" class="qp-qty-inc" data-index="' + index + '" aria-label="Increase">+</button>' +
            '</div>' +
            '<button type="button" class="qp-remove" data-index="' + index + '">Remove</button>' +
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
      ['firstName', 'first name'],
      ['lastName',  'last name'],
      ['company',   'company name'],
      ['email',     'email'],
      ['phone',     'telephone']
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
        status('error', 'Please complete: ' + missing.join(', ') + '.');
        return;
      }

      var basket = Quote.get();
      if (!basket.length) {
        status('error', 'Your basket is empty - add some products first.');
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
        items: basket.map(function (it) {
          return {
            name: it.name, sku: it.sku, options: it.options,
            quantity: parseInt(it.quantity, 10) || 1
          };
        })
      };

      submitEl.disabled = true;
      var original = submitEl.textContent;
      submitEl.textContent = 'Sending…';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function (r) {
        return r.text().then(function (text) {
          var data = {};
          try { data = text ? JSON.parse(text) : {}; } catch (err) {}
          return { httpOk: r.ok, data: data };
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
          status('error', res.data.error || 'Something went wrong sending your request. Please try again or call us.');
          submitEl.disabled = false;
          submitEl.textContent = original;
        }
      })
      .catch(function () {
        status('error', 'Could not reach the server. Please check your connection and try again.');
        submitEl.disabled = false;
        submitEl.textContent = original;
      });
    });

    render();
    Quote.onChange(render);
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

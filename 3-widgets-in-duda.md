Basket Page widget:

(UPDATED 2026-10-02 — the quote form now asks for the same details as the old
WordPress form: First Name, Last Name, Company Name, Email and Telephone
(required), then When do you need this equipment?, Address, Country, Postcode
and Message. To install: in Duda's Widget Builder, open "SAEquip - Basket
Page" and replace ALL THREE of its HTML, CSS and JS with the blocks below, then
publish. The backend already accepts this form, and still accepts the old one,
so the order you do it in does not matter. The shared quote store at the top
of the JS is unchanged, so the other two widgets need no edits.)

HTML:
<div class="qp-wrapper">

  <!-- ── Cart list ──────────────────────────────────────────────────────── -->
  <section class="qp-cart" id="qp-cart" aria-label="Your quote basket">
    <h2 class="qp-title">Your Quote Basket</h2>

    <div class="qp-empty" id="qp-empty">
      <div class="qp-empty-text">No products added yet.</div>
      {{#custom_link continueBrowsingLink}}<span class="qp-continue">Continue browsing</span>{{/custom_link}}
    </div>

    <div class="qp-items" id="qp-items"></div>
  </section>

  <!-- ── Quote request form ─────────────────────────────────────────────── -->
  <section class="qp-form-section" id="qp-form-section">
    <div class="qp-form-box">
      <h3 class="qp-form-title">Request your quote</h3>

      <form class="qp-form" id="qp-form" novalidate>
      <!-- honeypot: hidden from people, bots tend to fill it -->
      <div class="qp-hp" aria-hidden="true">
        <label>Leave this field empty
          <input type="text" name="website" tabindex="-1" autocomplete="off">
        </label>
      </div>

      <div class="qp-row">
        <div class="qp-field">
          <label for="qp-first">First Name <span class="qp-req">*</span></label>
          <input type="text" id="qp-first" name="firstName" required maxlength="100" autocomplete="given-name">
        </div>
        <div class="qp-field">
          <label for="qp-last">Last Name <span class="qp-req">*</span></label>
          <input type="text" id="qp-last" name="lastName" required maxlength="100" autocomplete="family-name">
        </div>
      </div>

      <div class="qp-field">
        <label for="qp-company">Company Name <span class="qp-req">*</span></label>
        <input type="text" id="qp-company" name="company" required maxlength="200" autocomplete="organization">
      </div>

      <div class="qp-row">
        <div class="qp-field">
          <label for="qp-email">Email <span class="qp-req">*</span></label>
          <input type="email" id="qp-email" name="email" required maxlength="160" autocomplete="email">
        </div>
        <div class="qp-field">
          <label for="qp-phone">Telephone <span class="qp-req">*</span></label>
          <input type="tel" id="qp-phone" name="phone" required maxlength="40" autocomplete="tel">
        </div>
      </div>

      <div class="qp-field">
        <label for="qp-when">When do you need this equipment?</label>
        <select id="qp-when" name="requiredBy">
          <option value="">Please select…</option>
          <option>Urgently</option>
          <option>Within the next week</option>
          <option>Within the next month</option>
          <option>Within the next quarter</option>
          <option>More than 3 months</option>
          <option>Pricing exercise only</option>
          <option>Unsure</option>
        </select>
      </div>

      <div class="qp-field">
        <label for="qp-address">Address</label>
        <input type="text" id="qp-address" name="address" maxlength="300" autocomplete="street-address">
      </div>

      <div class="qp-row">
        <div class="qp-field">
          <label for="qp-country">Country</label>
          <!-- options are filled in by the JS (WordPress's full country list) -->
          <select id="qp-country" name="country" autocomplete="country-name">
            <option value="">Select a country / region…</option>
          </select>
        </div>
        <div class="qp-field">
          <label for="qp-postcode">Postcode</label>
          <input type="text" id="qp-postcode" name="postcode" maxlength="20" autocomplete="postal-code">
        </div>
      </div>

      <div class="qp-field">
        <label for="qp-message">Message</label>
        <textarea id="qp-message" name="message" rows="4" maxlength="2000"></textarea>
      </div>

      <!-- Cloudflare Turnstile / reCAPTCHA goes here when you add it:
           <div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div> -->

      <div class="qp-status" id="qp-status" role="alert" aria-live="polite"></div>

      <button type="submit" class="qp-submit" id="qp-submit">Submit Quote Request</button>
      </form>
    </div>
  </section>

  <!-- ── Thank-you panel (shown after a successful submit) ───────────────── -->
  <section class="qp-thanks" id="qp-thanks" role="status" aria-live="polite" style="display:none;">
    <h2 class="qp-thanks-title">Thank you - Quote request has been sent</h2>
    <p class="qp-thanks-text">Our team will review it and be in touch shortly.</p>
    <div class="qp-thanks-actions">
      <button type="button" class="qp-btn-secondary" id="qp-retrieve">Retrieve Basket</button>
      <a class="qp-btn-primary" id="qp-home" href="/">Back to Home</a>
    </div>
  </section>

</div>
CSS:
.qp-wrapper {
  --qp-ink: #1a1a1a;
  --qp-muted: #666;
  --qp-line: #e4e4e4;
  --qp-bg: #f7f7f7;
  max-width: 820px;
  margin: 0 auto;
  font-family: inherit;
  color: var(--qp-ink);
  box-sizing: border-box;
}
.qp-wrapper * { box-sizing: border-box; }

.qp-title { font-family: inherit; font-size: 22px; font-weight: normal; margin: 0 0 16px; }

/* ── empty state (matches the header modal) ─────────────────────────────── */
.qp-empty {
  background: #f4f4f4;
  border-radius: 0px;
  padding: 34px 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}
.qp-empty-text { font-size: 14px; }
.qp-continue {
  display: inline-block;
  margin-top: 12px;
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: normal;
  text-transform: capitalize;
  color: var(--qp-ink);
  text-decoration: underline;
  cursor: pointer;
}
.qp-continue:hover { color: #000; }

/* ── cart items (match the header modal item look) ──────────────────────── */
.qp-items { display: flex; flex-direction: column; }

.qp-item {
  display: flex;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid var(--qp-line);
}
.qp-thumb {
  width: 76px; height: 76px; flex-shrink: 0;
  object-fit: cover; border-radius: 0px;
  background: var(--qp-bg); border: 1px solid var(--qp-line);
}
.qp-thumb--ph { display: inline-block; }

.qp-item-main { flex: 1 1 auto; min-width: 0; }
.qp-item-name { font-size: 15px; font-weight: 700; color: var(--qp-ink); line-height: 1.3; }
.qp-item-sku  { font-size: 12px; color: var(--qp-muted); margin: 2px 0 5px; }
.qp-item-options { display: flex; flex-direction: column; gap: 2px; }
.qp-opt   { font-size: 13px; color: #555; line-height: 1.4; }
.qp-opt b { font-weight: 600; color: #333; }

/* clickable product title / image */
.qp-link { color: inherit; text-decoration: none; }
.qp-link:hover { text-decoration: underline; }
.qp-item-name .qp-link { color: var(--qp-ink); }
img.qp-thumb { cursor: pointer; }

.qp-item-side {
  flex-shrink: 0;
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 8px; min-width: 120px;
}

.qp-qty { display: inline-flex; align-items: center; border: 1px solid var(--qp-line); border-radius: 0; overflow: hidden; }
.qp-qty button {
  width: 30px; height: 32px; border: none; background: #fff; cursor: pointer;
  font-size: 16px; line-height: 1; color: var(--qp-ink);
}
.qp-qty button:hover { background: var(--qp-bg); }
.qp-qty-input {
  width: 44px; height: 32px; border: none; text-align: center;
  border-left: 1px solid var(--qp-line); border-right: 1px solid var(--qp-line);
  font-size: inherit; font-family: inherit; -moz-appearance: textfield;
}
.qp-qty-input::-webkit-outer-spin-button,
.qp-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.qp-remove {
  background: none; border: none; cursor: pointer; padding: 0;
  font-size: inherit; color: var(--qp-muted); text-decoration: underline;
}
.qp-remove:hover { color: #c0392b; }

/* ── form ─────────────────────────────────────────────────────────────── */
.qp-form-section { margin-top: 34px; }
.qp-form-box {
  background: #ffffff;
  border: 1px solid var(--qp-line);
  border-radius: 0px;
  padding: 28px;
}
.qp-form-title { font-family: inherit; font-size: 18px; font-weight: normal; margin: 0 0 16px; }

.qp-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

.qp-field { margin-bottom: 14px; }
.qp-row { display: flex; gap: 14px; }
.qp-row .qp-field { flex: 1 1 0; }

.qp-field label { display: block; font-family: 'Inter', sans-serif; font-size: 16px; font-weight: normal; margin-bottom: 5px; }
.qp-req { color: #c0392b; }

.qp-field input,
.qp-field select,
.qp-field textarea {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--qp-line);
  border-radius: 0px;
  font-family: inherit;
  font-size: inherit;
  color: var(--qp-ink);
  background: #fff;
}
.qp-field input:focus,
.qp-field select:focus,
.qp-field textarea:focus { outline: none; border-color: var(--qp-ink); }
.qp-field textarea { resize: vertical; }
.qp-field input.qp-invalid,
.qp-field select.qp-invalid,
.qp-field textarea.qp-invalid { border-color: #c0392b; }

/* dropdowns: same box as the inputs, with a drawn chevron instead of the
   browser's own arrow (which differs on every OS). Must come AFTER the shared
   rule above, whose `background: #fff` would otherwise remove the chevron. */
.qp-field select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  padding-right: 38px;
  cursor: pointer;
  line-height: 1.3;
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a1a1a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center / 14px 14px;
}
.qp-field select:invalid,
.qp-field select option[value=""] { color: var(--qp-muted); }
.qp-field select option { color: var(--qp-ink); }

.qp-status { display: none; border-radius: 0px; padding: 11px 14px; font-size: inherit; margin-bottom: 14px; }
.qp-status.is-error { display: block; background: #fff3f3; border: 1px solid #f5c6c6; color: #c0392b; }
.qp-status.is-success { display: block; background: #eafaf0; border: 1px solid #b8e6c8; color: #1e7e44; }

.qp-submit {
  display: block; width: 100%;
  padding: 15px 20px;
  background: var(--qp-ink); color: #fff;
  border: none; border-radius: 0px;
  font-family: 'Inter', sans-serif; font-weight: normal; font-size: 16px;
  letter-spacing: normal; text-transform: capitalize;
  cursor: pointer; transition: background 0.2s ease;
}
.qp-submit:hover:not(:disabled) { background: #333; }
.qp-submit:disabled { opacity: 0.65; cursor: not-allowed; }

/* ── thank-you panel ───────────────────────────────────────────────────── */
.qp-thanks { text-align: center; padding: 44px 20px; }
.qp-thanks-title { font-family: inherit; font-size: 22px; font-weight: normal; margin: 0 0 10px; color: var(--qp-ink); }
.qp-thanks-text { font-size: inherit; color: var(--qp-muted); margin: 0 0 26px; }
.qp-thanks-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

.qp-btn-primary,
.qp-btn-secondary {
  display: inline-block;
  padding: 13px 24px;
  border-radius: 0px;
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: normal;
  letter-spacing: normal;
  text-transform: capitalize;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  border: 1px solid var(--qp-ink);
  transition: background 0.2s ease;
}
.qp-btn-primary { background: var(--qp-ink); color: #fff; }
.qp-btn-primary:hover { background: #333; border-color: #333; }
.qp-btn-secondary { background: #fff; color: var(--qp-ink); }
.qp-btn-secondary:hover { background: var(--qp-bg); }

@media (max-width: 560px) {
  .qp-thanks-actions { flex-direction: column; }
  .qp-btn-primary, .qp-btn-secondary { width: 100%; }
  .qp-item { flex-wrap: wrap; }
  .qp-item-side { align-items: flex-start; min-width: 0; width: 100%; flex-direction: row; justify-content: space-between; }
  .qp-row { flex-direction: column; gap: 0; }
}
JS:
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

Quote Basket Header widget:

HTML:
<style>
  /* hold hidden until styled (prevents FOUC); main CSS reveals via .qc { visibility: visible !important } */
  .qc { visibility: hidden; animation: qc-reveal 0.01s linear 2.5s forwards; }
  @keyframes qc-reveal { to { visibility: visible; } }
  .qc-icon svg { width: 1.2em; height: 1.2em; }
  .qc-overlay { opacity: 0; visibility: hidden; }
</style>

<div class="qc">
  <button class="qc-btn" type="button" aria-haspopup="dialog" aria-expanded="false">
    <span class="qc-icon"><svg style="width:1.2em;height:1.2em" fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 902.86 902.86" xml:space="preserve"><g><g><path d="M671.504,577.829l110.485-432.609H902.86v-68H729.174L703.128,179.2L0,178.697l74.753,399.129h596.751V577.829z M685.766,247.188l-67.077,262.64H131.199L81.928,246.756L685.766,247.188z"></path><path d="M578.418,825.641c59.961,0,108.743-48.783,108.743-108.744s-48.782-108.742-108.743-108.742H168.717c-59.961,0-108.744,48.781-108.744,108.742s48.782,108.744,108.744,108.744c59.962,0,108.743-48.783,108.743-108.744c0-14.4-2.821-28.152-7.927-40.742h208.069c-5.107,12.59-7.928,26.342-7.928,40.742C469.675,776.858,518.457,825.641,578.418,825.641z M209.46,716.897c0,22.467-18.277,40.744-40.743,40.744c-22.466,0-40.744-18.277-40.744-40.744c0-22.465,18.277-40.742,40.744-40.742C191.183,676.155,209.46,694.432,209.46,716.897z M619.162,716.897c0,22.467-18.277,40.744-40.743,40.744s-40.743-18.277-40.743-40.744c0-22.465,18.277-40.742,40.743-40.742S619.162,694.432,619.162,716.897z"></path></g></g></svg></span>
    <span class="qc-label">{{labelText}}</span>
    <span class="qc-count"><span class="qc-num">0</span></span>
  </button>

  <div class="qc-overlay">
    <div class="qc-modal" role="dialog" aria-modal="true" aria-label="Quote list">
      <button class="qc-close" type="button" aria-label="Close">&times;</button>

      <div class="qc-eyebrow">Your equipment enquiry</div>
      <h2 class="qc-title">Quote List <span class="qc-num">0</span></h2>

      <div class="qc-panel">
        <div class="qc-empty">
          No products added yet.
          <button class="qc-continue" type="button">Continue browsing</button>
        </div>
        <div class="qc-items"></div>
      </div>

      <div class="qc-view">
        {{#custom_link quotePageLink}}
        {{#custom_button viewBtnText class="qc-view-btn"}}
        {{/custom_button}}
        {{/custom_link}}
      </div>
      <button class="qc-clear" type="button">Clear all</button>
    </div>
  </div>
</div>
CSS:
/* SAEquip header quote basket — modal popup. Everything scoped under .qc. */
.qc {
  /* trigger theming */
  --qc-bg: #1f1f1f;
  --qc-bg-hover: #2b2b2b;
  --qc-fg: #ffffff;

  position: relative;
  display: inline-flex;
  align-items: center;
  font-family: inherit;
  visibility: visible !important;   /* reveals the widget once this CSS is active */
}

/* ── trigger button ────────────────────────────────────────────────────── */
.qc-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--qc-bg);
  color: var(--qc-fg);
  border: none;
  border-radius: 0px;
  height: 50px;
  padding: 0 14px;
  font-family: inherit;
  font-size: inherit;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.16s ease;
}
.qc-btn:hover { background: var(--qc-bg-hover); }

.qc-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
.qc-icon svg { width: 1.2em; height: 1.2em; fill: currentColor; vertical-align: middle; }
.qc-label { font-family: inherit; font-size: inherit; color: inherit; }

.qc-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 5px;
  border-radius: 999px; background: #ffffff; color: #1f1f1f;
  font-size: 11px; font-weight: 700; line-height: 1;
}

/* ── modal overlay ─────────────────────────────────────────────────────── */
.qc-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.18s ease, visibility 0.18s;
  -webkit-overflow-scrolling: touch;
}
.qc.qc-open .qc-overlay { opacity: 1; visibility: visible; }

.qc-modal {
  position: relative;
  width: 100%;
  max-width: 640px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  color: #1a1a1a;
  border-radius: 0px;
  padding: 30px 30px 26px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
  transform: translateY(-10px);
  transition: transform 0.18s ease;
  text-align: left;
}
.qc.qc-open .qc-modal { transform: translateY(0); }

.qc-close {
  position: absolute;
  top: 16px; right: 16px;
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: #f0f0f0; color: #555;
  font-size: 20px; line-height: 1; cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.qc-close:hover { background: #e4e4e4; color: #000; }

.qc-eyebrow {
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: #8a8a8a; font-weight: 600;
}
.qc-title {
  margin: 6px 0 0;
  font-size: 30px; font-weight: 800; line-height: 1.1;
  color: #1a1a1a;
}
.qc-title .qc-num { color: #b0b0b0; }

/* ── items panel ───────────────────────────────────────────────────────── */
.qc-panel {
  flex: 1 1 auto;
  min-height: 60px;
  overflow-y: auto;
  background: #f4f4f4;
  border-radius: 0px;
  padding: 6px 14px;
  margin: 18px 0;
}

.qc-empty { text-align: center; color: #666; font-size: 14px; padding: 26px 10px; }
.qc-continue {
  display: inline-block; margin-top: 12px;
  background: none; border: none; cursor: pointer;
  font-family: inherit; font-size: 12px; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: #1a1a1a; text-decoration: underline;
}
.qc-continue:hover { color: #000; }

.qc-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 2px; border-bottom: 1px solid #e2e2e2;
}
.qc-item:last-child { border-bottom: none; }

.qc-thumb {
  width: 56px; height: 56px; flex-shrink: 0;
  object-fit: cover; background: #fff; border: 1px solid #e2e2e2;
}
.qc-thumb--ph { display: inline-block; }

.qc-info { flex: 1 1 auto; min-width: 0; }
.qc-name { font-size: 14px; font-weight: 700; color: #1a1a1a; line-height: 1.3; }
.qc-sku  { font-size: 11px; color: #888; margin: 1px 0 3px; }
.qc-opts { margin-top: 2px; }
.qc-optrow { font-size: 12px; color: #555; line-height: 1.4; word-break: break-word; }
.qc-optlabel { color: #333; font-weight: 600; }
.qc-meta { font-size: 12px; color: #333; margin-top: 3px; }

.qc-x {
  flex-shrink: 0; background: none; border: none; cursor: pointer;
  font-size: 22px; line-height: 1; color: #aaa; padding: 0 2px;
  transition: color 0.15s ease;
}
.qc-x:hover { color: #c0392b; }

.qc-link { color: inherit; text-decoration: none; }
.qc-link:hover { text-decoration: underline; }
img.qc-thumb { cursor: pointer; }

/* ── buttons ───────────────────────────────────────────────────────────── */
.qc-view { display: block; width: 100%; }
.qc-view a { display: block; width: 100%; }
.qc-view .qc-view-btn { display: block; width: 100%; box-sizing: border-box; }

.qc-clear {
  display: block; width: 100%; margin-top: 10px;
  background: none; border: none; cursor: pointer;
  font-family: inherit; font-size: 12px; color: #8f8f8f;
  text-decoration: underline; text-align: center; padding: 2px;
}
.qc-clear:hover { color: #555; }

/* ── empty-state toggles ───────────────────────────────────────────────── */
.qc-modal.qc-is-empty .qc-items,
.qc-modal.qc-is-empty .qc-view,
.qc-modal.qc-is-empty .qc-clear { display: none; }
.qc-modal:not(.qc-is-empty) .qc-empty { display: none; }

@media (max-width: 560px) {
  .qc-modal { padding: 24px 18px 20px; }
  .qc-title { font-size: 24px; }
}
JS:
/* =============================================================================
   SAEquip — Header Quote Basket (count + modal popup)
   Self-contained store (idempotent). No head HTML.
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

/* ── Header widget UI (modal) ──────────────────────────────────────────────── */
window.dmAPI.runOnReady('quote-basket-widget', function () {

  var Quote = window.SAEquipQuote;
  if (!Quote) { console.error('[SAEquip] quote store missing'); return; }

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

  function isDesktop() { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }

  /* ── open / close ─────────────────────────────────────────────────────── */
  function openModal() {
    root.classList.add('qc-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';   /* lock background scroll */
  }
  function closeModal() {
    root.classList.remove('qc-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (contBtn)  contBtn.addEventListener('click', closeModal);
  if (overlay)  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && root.classList.contains('qc-open')) closeModal();
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
    var url   = safeUrl(item.url);
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
          '<div class="qc-name">' + open + esc(item.name || 'Product') + close + '</div>' +
          (item.sku ? '<div class="qc-sku">SKU: ' + esc(item.sku) + '</div>' : '') +
          '<div class="qc-opts">' + optionRows(item.options) + '</div>' +
          '<div class="qc-meta">Qty ' + qty + '</div>' +
        '</div>' +
        '<button class="qc-x" type="button" data-index="' + index + '" aria-label="Remove item">&times;</button>' +
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
});

Add to Quote widget:

HTML:
<div class="atq-wrapper">
  <div class="atq-error-msg" id="atq-error" role="alert" aria-live="polite" style="display:none;">
    Please select all options before adding to your quote.
  </div>

  <div class="atq-row">
    <div class="atq-qty">
      <button type="button" class="atq-qty-dec" aria-label="Decrease quantity">&minus;</button>
      <input type="number" class="atq-qty-input" id="atq-qty" min="1" value="1" aria-label="Quantity">
      <button type="button" class="atq-qty-inc" aria-label="Increase quantity">+</button>
    </div>

    <button class="atq-btn" id="atq-btn" type="button">{{buttonText}}</button>
  </div>
</div>
CSS:
.atq-wrapper {
  width: 100%;
  font-family: inherit;
  box-sizing: border-box;
}

.atq-error-msg {
  width: 100%;
  box-sizing: border-box;
  background-color: #fff3f3;
  color: #c0392b;
  border: 1px solid #f5c6c6;
  border-radius: 4px;
  padding: 10px 14px;
  margin-bottom: 10px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  text-align: center;
}

/* quantity + button on the same row */
.atq-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ── quantity adjuster (square, no radius) ─────────────────────────────── */
.atq-qty {
  display: inline-flex;
  align-items: center;
  border: 1px solid #d9d9d9;
  border-radius: 0;
  overflow: hidden;
  flex-shrink: 0;
}
.atq-qty button {
  width: 40px; height: 42px;
  border: none; background: #fff; cursor: pointer;
  font-size: 18px; line-height: 1; color: #1a1a1a;
  font-family: inherit;
}
.atq-qty button:hover { background: #f2f2f2; }
.atq-qty-input {
  width: 52px; height: 42px;
  border: none; text-align: center;
  border-left: 1px solid #d9d9d9; border-right: 1px solid #d9d9d9;
  font-size: 15px; font-family: inherit; color: #1a1a1a;
  -moz-appearance: textfield;
}
.atq-qty-input::-webkit-outer-spin-button,
.atq-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

/* ── button (height matches the 42px stepper + its 1px borders = 44px) ─── */
.atq-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  padding: 0 28px;
  background-color: #1a1a1a;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: normal;
  text-transform: none;        /* honour the content-panel label's case */
  cursor: pointer;
  transition: background-color 0.2s ease;
  box-sizing: border-box;
  line-height: 1.3;
  -webkit-tap-highlight-color: transparent;
}
.atq-btn:hover:not(:disabled) { background-color: #333333; }

.atq-btn:disabled { cursor: not-allowed; }
.atq-btn.atq-success { background-color: #27ae60; }
.atq-btn.atq-error-state { animation: atq-shake 0.35s ease; }

.atq-tick { width: 1.1em; height: 1.1em; flex-shrink: 0; }

@keyframes atq-shake {
  0%   { transform: translateX(0); }
  20%  { transform: translateX(-5px); }
  40%  { transform: translateX(5px); }
  60%  { transform: translateX(-4px); }
  80%  { transform: translateX(4px); }
  100% { transform: translateX(0); }
}
JS:
/* =============================================================================
   SAEquip — Add to Quote widget
   Self-contained: bundles the shared quote store (idempotent). No head HTML.
   Markup: #atq-btn #atq-error #atq-count-num #atq-qty + .atq-qty-inc/.atq-qty-dec
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

/* ── Add to Quote widget ───────────────────────────────────────────────────── */
(function () {
  'use strict';

  var Quote = window.SAEquipQuote;
  if (!Quote) { console.error('[SAEquip] quote store missing'); return; }

  var btn      = document.getElementById('atq-btn');
  var errorEl  = document.getElementById('atq-error');
  var countEl  = document.getElementById('atq-count-num');
  var qtyInput = document.getElementById('atq-qty');
  var qtyDec   = document.querySelector('.atq-qty-dec');
  var qtyInc   = document.querySelector('.atq-qty-inc');
  if (!btn) return;

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
          image: obj.image || ''
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
    errorEl.textContent = msg || 'Please select all options before adding to your quote.';
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
      '<span>Added to Quote List</span>';
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
      showError('Product options are still loading — please try again in a moment.');
      return;
    }

    var opts = readOptions();
    if (opts.missing.length) {
      showError('Please choose: ' + opts.missing.join(', '));
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
        quantity: getQty()
      });
      /* tell the header widget to auto-open its dropdown (desktop only) */
      document.dispatchEvent(new CustomEvent('saequip:quote-added'));
      showSuccess();
      setQty(1);
    } catch (e) {
      showError('Could not save to your quote. Please try again.');
    }
  });
})();

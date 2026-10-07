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

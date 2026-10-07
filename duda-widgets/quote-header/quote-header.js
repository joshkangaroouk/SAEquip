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

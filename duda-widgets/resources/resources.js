(function (el, section, inEditor, cfg) {
  // Stamped SYNCHRONOUSLY, before any async work.
  el.setAttribute('data-saeh-section', section);

  // Diagnostic: the RAW object Duda handed this shim. Read it in the console
  // with __saehData['resources'] — the content-panel values are under .config.
  (window.__saehData || (window.__saehData = {}))[section] = data;

  // Read into primitives NOW, at evaluation time.
  var resourceType = cfg.resourceType, heading = cfg.heading;

  var SRC = 'https://sa-equip-backend.vercel.app/public/widget.js?v=23';
  var L = window.__saehLoader || (window.__saehLoader = {});
  if (!L.p) L.p = new Promise(function (res, rej) {
    var s = document.createElement('script');
    s.src = SRC; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  L.p.then(function () {
    window.SAEquipHubWidget.init({
      container: el,
      props: { section: section, inEditor: inEditor, resourceType: resourceType, heading: heading }
    });
  }).catch(function () {});
})(element, 'resources', data.inEditor, data.config || data);

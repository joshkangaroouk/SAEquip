/*
 * SAEquip Product Hub — embeddable public widget (vanilla JS, no framework).
 *
 * Usage on a product page:
 *   <div id="saequip-product-hub"></div>
 *   <script src="https://YOUR-BACKEND/public/widget.js" defer></script>
 *
 * - API base is derived from this script's own src (so it calls the backend
 *   that served it) — nothing is hardcoded.
 * - Product slug: data-slug on the mount div, else parsed from /product/<slug>.
 * - Fails quietly: never throws into / breaks the host page.
 */
(function () {
  "use strict";

  var MOUNT_ID = "saequip-product-hub";
  var STYLE_ID = "saeh-styles";

  function apiBaseFromScript() {
    var src = (document.currentScript && document.currentScript.src) || "";
    if (!src) {
      var tag = document.querySelector('script[src*="/public/widget.js"]');
      if (tag) src = tag.src || tag.getAttribute("src") || "";
    }
    try {
      return new URL(src, window.location.href).origin;
    } catch (e) {
      return "";
    }
  }

  var API = apiBaseFromScript();

  function slugFrom(mount) {
    var ds = mount.getAttribute("data-slug");
    if (ds && ds.trim()) return ds.trim();
    var path = (window.location && window.location.pathname) || "";
    var m = path.match(/\/product\/([^\/?#]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  // ---- tiny DOM helpers (textContent only — never inject HTML) ----
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function input(type, placeholder, cls, required) {
    var i = document.createElement("input");
    i.type = type;
    i.className = cls;
    if (placeholder) i.placeholder = placeholder;
    if (required) i.required = true;
    return i;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      ".saeh-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:920px;margin:24px 0;line-height:1.5;box-sizing:border-box}",
      ".saeh-root *{box-sizing:border-box}",
      ".saeh-section{margin:22px 0}",
      ".saeh-h{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#111;margin:0 0 12px;border-left:4px solid #ffd200;padding-left:10px}",
      ".saeh-logos{display:flex;flex-wrap:wrap;gap:18px;align-items:center}",
      ".saeh-logos img{max-height:56px;max-width:150px;object-fit:contain;display:block}",
      ".saeh-table{width:100%;border-collapse:collapse;font-size:14px}",
      ".saeh-table td{padding:9px 12px;border-bottom:1px solid #ececec;vertical-align:top}",
      ".saeh-table tr:nth-child(even){background:#fafafa}",
      ".saeh-table td.saeh-label{font-weight:600;width:40%;color:#333}",
      ".saeh-list{list-style:none;padding:0;margin:0}",
      ".saeh-list li{position:relative;padding:5px 0 5px 26px;font-size:14px}",
      ".saeh-check li:before{content:'\\2713';position:absolute;left:0;top:6px;color:#111;background:#ffd200;border-radius:50%;width:17px;height:17px;font-size:11px;line-height:17px;text-align:center;font-weight:700}",
      ".saeh-apps li:before{content:'';position:absolute;left:7px;top:12px;width:6px;height:6px;background:#111;border-radius:50%}",
      ".saeh-dl{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ececec}",
      ".saeh-dl-title{flex:1 1 auto;font-size:14px;font-weight:500;min-width:140px}",
      ".saeh-btn{display:inline-block;background:#111;color:#fff;border:none;border-radius:5px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;line-height:1.2}",
      ".saeh-btn:hover{background:#333}",
      ".saeh-btn:disabled{opacity:.6;cursor:default}",
      ".saeh-form{flex-basis:100%;display:none;flex-wrap:wrap;gap:8px;margin-top:10px;padding:14px;background:#f7f7f7;border-radius:8px}",
      ".saeh-form.saeh-open{display:flex}",
      ".saeh-in{flex:1 1 180px;padding:9px;border:1px solid #ccc;border-radius:5px;font-size:14px}",
      ".saeh-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}",
      ".saeh-msg{flex-basis:100%;font-size:13px;margin-top:2px}",
      ".saeh-ok{color:#137333}",
      ".saeh-err{color:#c5221f}",
      "@media(max-width:520px){.saeh-table td.saeh-label{width:auto}.saeh-dl{align-items:flex-start}}",
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  function logoSection(title, logos) {
    var sec = el("div", "saeh-section");
    if (title) sec.appendChild(el("div", "saeh-h", title));
    var row = el("div", "saeh-logos");
    logos.forEach(function (l) {
      if (!l || !l.url) return;
      var img = document.createElement("img");
      img.src = l.url;
      img.alt = l.alt || l.label || "";
      img.loading = "lazy";
      row.appendChild(img);
    });
    sec.appendChild(row);
    return sec;
  }

  function specsSection(specs) {
    var sec = el("div", "saeh-section");
    sec.appendChild(el("div", "saeh-h", "Technical Specifications"));
    var table = el("table", "saeh-table");
    var tbody = el("tbody");
    specs.forEach(function (s) {
      var tr = el("tr");
      tr.appendChild(el("td", "saeh-label", s.label));
      tr.appendChild(el("td", null, s.value));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sec.appendChild(table);
    return sec;
  }

  function listSection(title, items, checklist) {
    var sec = el("div", "saeh-section");
    sec.appendChild(el("div", "saeh-h", title));
    var ul = el("ul", "saeh-list " + (checklist ? "saeh-check" : "saeh-apps"));
    items.forEach(function (t) {
      ul.appendChild(el("li", null, t));
    });
    sec.appendChild(ul);
    return sec;
  }

  function validationMessage(body) {
    if (body && body.details && body.details.fieldErrors) {
      var fe = body.details.fieldErrors;
      var parts = [];
      Object.keys(fe).forEach(function (k) {
        if (fe[k] && fe[k].length) parts.push(fe[k][0]);
      });
      if (parts.length) return parts.join(" ");
    }
    return "Please check your details and try again.";
  }

  function leadForm(downloadId) {
    var form = el("form", "saeh-form");
    var name = input("text", "Name", "saeh-in", true);
    var email = input("email", "Email", "saeh-in", true);
    var company = input("text", "Company (optional)", "saeh-in", false);
    var honeypot = input("text", "", "saeh-hp", false);
    honeypot.name = "website";
    honeypot.tabIndex = -1;
    honeypot.setAttribute("autocomplete", "off");
    honeypot.setAttribute("aria-hidden", "true");
    var submit = el("button", "saeh-btn", "Get download");
    submit.type = "submit";
    var msg = el("div", "saeh-msg");

    form.appendChild(name);
    form.appendChild(email);
    form.appendChild(company);
    form.appendChild(honeypot);
    form.appendChild(submit);
    form.appendChild(msg);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "saeh-msg";
      msg.textContent = "";
      var payload = {
        name: name.value.trim(),
        email: email.value.trim(),
        website: honeypot.value,
      };
      if (company.value.trim()) payload.company = company.value.trim();

      submit.disabled = true;
      submit.textContent = "Submitting…";
      fetch(API + "/public/downloads/" + encodeURIComponent(downloadId) + "/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (body) {
              return { status: res.status, body: body };
            });
        })
        .then(function (r) {
          submit.disabled = false;
          submit.textContent = "Get download";
          if (r.status === 429) {
            msg.className = "saeh-msg saeh-err";
            msg.textContent = "Too many requests — please try again shortly.";
            return;
          }
          if (r.status >= 400) {
            msg.className = "saeh-msg saeh-err";
            msg.textContent = validationMessage(r.body);
            return;
          }
          msg.className = "saeh-msg saeh-ok";
          msg.textContent = "Thanks — your download is starting.";
          if (r.body && r.body.fileUrl) {
            window.open(r.body.fileUrl, "_blank", "noopener");
          }
        })
        .catch(function () {
          submit.disabled = false;
          submit.textContent = "Get download";
          msg.className = "saeh-msg saeh-err";
          msg.textContent = "Something went wrong. Please try again.";
        });
    });

    return form;
  }

  function downloadRow(d) {
    var row = el("div", "saeh-dl");
    row.appendChild(el("span", "saeh-dl-title", d.title));
    if (!d.gated && d.fileUrl) {
      var a = el("a", "saeh-btn", "Download");
      a.href = d.fileUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("download", "");
      row.appendChild(a);
    } else {
      var btn = el("button", "saeh-btn", "Download");
      btn.type = "button";
      var form = leadForm(d.id);
      btn.addEventListener("click", function () {
        form.classList.toggle("saeh-open");
      });
      row.appendChild(btn);
      row.appendChild(form);
    }
    return row;
  }

  function downloadsSection(downloads) {
    var sec = el("div", "saeh-section");
    sec.appendChild(el("div", "saeh-h", "Downloads"));
    downloads.forEach(function (d) {
      sec.appendChild(downloadRow(d));
    });
    return sec;
  }

  function render(mount, data) {
    if (!data) return; // unknown product / error → render nothing
    var logos = data.logos || { sa: [], cert: [] };
    var root = el("div", "saeh-root");

    if (logos.cert && logos.cert.length) root.appendChild(logoSection("Certifications", logos.cert));
    if (logos.sa && logos.sa.length) root.appendChild(logoSection("", logos.sa));
    if (data.specs && data.specs.length) root.appendChild(specsSection(data.specs));
    if (data.benefits && data.benefits.length) root.appendChild(listSection("Key Benefits", data.benefits, true));
    if (data.applications && data.applications.length)
      root.appendChild(listSection("Applications", data.applications, false));
    if (data.downloads && data.downloads.length) root.appendChild(downloadsSection(data.downloads));

    if (!root.childNodes.length) return; // nothing to show
    injectStyles();
    mount.innerHTML = "";
    mount.appendChild(root);
  }

  function init() {
    try {
      var mount = document.getElementById(MOUNT_ID);
      if (!mount || !API) return;
      var slug = slugFrom(mount);
      if (!slug) return;
      fetch(API + "/public/products/content?slug=" + encodeURIComponent(slug), { credentials: "omit" })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (data) {
          try {
            render(mount, data);
          } catch (e) {
            /* never break the host page */
          }
        })
        .catch(function () {
          /* network error → render nothing */
        });
    } catch (e) {
      /* never break the host page */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

# SAEquip Product Hub

## What this is

An internal admin dashboard for SAEquip (industrial/hazardous-area equipment) that manages everything about a product that **Duda's native e-commerce store can't handle natively**: logos/certifications, technical spec tables, benefit/application lists, compatible products, categories and downloadable datasheets (lead-gating is built but switched off). It also owns the **quote request** flow (a custom "add to quote" basket system, replacing native Duda checkout/pricing for these products).

The dashboard talks to Duda's REST API to pull in the real product catalog (name, SKU, price, images, variations — all native fields), and lets staff fill in the extra content per product. That content is then rendered **back onto the live product page** via a small embeddable JS widget, so the public site shows a merged view: native Duda fields + Hub content, seamlessly.

Two users: Kangaroo (agency, builds/maintains this) and SAEquip staff (day-to-day content editing).

## Architecture — three surfaces

1. **Duda** (`saequip.multiscreensite.com`, going live at `saequip.com`) — the public site. Not in this repo. Holds native product fields (name, SKU, price, images, variations) and the product page template where the widget is embedded.
2. **`frontend/`** — the private admin dashboard (this repo). Login-gated, staff-only. React SPA.
3. **`backend/`** — Express API. Talks to Duda's REST API (server-side credentials, never exposed to the browser) and to Supabase (DB/Auth/Storage). Also serves the public embeddable widget and its data/lead-capture endpoints — those are the *only* parts of this backend the public internet touches unauthenticated.

## Tech stack

- **Monorepo**: npm workspaces (`backend`, `frontend`), root `npm run dev` runs both concurrently.
- **Backend**: Node + TypeScript (ESM, `type: module`) + Express + Prisma. Zod for validation. `express-rate-limit` on public routes. `resend` for optional transactional email.
- **Frontend**: Vite + React 18 + TypeScript + Tailwind. `react-router-dom` v7. `@dnd-kit` (core/sortable/utilities) for drag-reorder. `react-dropzone` for uploads. `sonner` for toasts. `dompurify` for rendering trusted-but-HTML content (specs/descriptions). Font: **DIN 2014 via Adobe Fonts** — loaded by the `<link>` in `frontend/index.html`, NOT self-hosted (Adobe's licence forbids vendoring the files, so there is nothing in `public/fonts` and no `@fontsource` package). The web project ships weights **200/300/400/600/700/800, normal only — no 500**, so `tailwind.config.js` maps every weight name onto one that exists and `font-medium` resolves to 400. The dashboard has been through IBM Plex Sans, Montserrat and a dark/sharp/ClashGrotesk pass, all reverted — check `index.css`/`tailwind.config.js`/`index.html` before assuming any of them.

⚠️ **The Adobe Fonts link is a live external dependency**: the dashboard's domain must be listed in the Adobe Fonts web project, and if the Creative Cloud subscription lapses the stylesheet stops serving and the UI silently falls back to system sans — no build error.

**Type/layout scale**: `html` is set to `font-size: 110%` in `index.css` — deliberately on the ROOT, because Tailwind's spacing scale, the type scale and `--radius` are all rem-based, so this scales layout *and* type together the way browser zoom does. That root is the single knob for scaling the whole UI. Body/paragraph text is 16px (`0.909rem` = 16/17.6, kept in rem so it tracks the root); the `body` rule in `index.css` and the `body` token in `tailwind.config.js` must stay in step.
- **Database/Auth/Storage**: Supabase — Postgres (via Prisma, pooled `DATABASE_URL` + direct `DIRECT_URL` for migrations), Auth (email+password, public signup **disabled**, `ALLOWED_EMAIL_DOMAINS` allowlist, backend verifies JWTs via `supabase.auth.getUser`), Storage (three buckets: `product-media` public for logos/images, `product-files` private for gated download files served via short-lived signed URLs, `product-models` public for `.glb` 3D models — see the 3D Model Viewer section below).
- **Hosting**: **Vercel Pro**, a *single* project serving both surfaces from one origin — see the Vercel deployment section below. **Railway is gone** (deleted 2026-09-08); the Railway section further down is kept only as history.
- **External APIs**: Duda REST API (HTTP Basic auth), Resend (optional, email notifications).

## Data model (Prisma) — source of truth split

**Duda owns**: native product fields + description only. All Duda custom_fields were deliberately deleted from the store — the Hub DB is the sole source of truth for everything else.

**Supabase (via `HubProduct`, keyed by `dudaProductId`) owns**:
- `Logo` + `ProductLogo` — SA/Cert logos are a **global shared catalog** (`Logo`, kind `SA_LOGO`/`CERT_LOGO`), not per-product. `ProductLogo` is a join table; a row's existence = that catalog logo is *active* for that product. Adding a logo to the catalog makes it available to every product; deleting one is global (UI warns with a usage count).
- `SpecRow` — ordered label/value technical spec rows.
- `ProductTextItem` — ordered text items, `kind` `BENEFIT` or `APPLICATION`.
- `Download` + `Lead` — per-product (not shared like logos) file attachments, each referencing a `MediaAsset`. `gated: true` withholds the file until a visitor submits the "File Requests" form, and each submission is a `Lead` row — listed on the dashboard's **Resource Requests** page. ⚠️ **Every file is gated** (2026-10-05); new ones are written gated — see "Gating" under the resources widget. Each download also has a **`kind`** (`DATASHEET`/`MANUAL`/`CERTIFICATE`) and, for a certificate only, a **`certScheme`** (`INMETRO`/`UKEX`/`IECEX`/`EX`/`COMPLIANCE`) — these decide which resources page lists it; see "The resources widget".
- `MediaAsset` — the shared "media centre" library backing `Logo`, `Download`, and a product's 3D model. `kind` is `"image" | "file" | "model"`.
- `HubProduct.glbAssetId` — a product's **interactive 3D model** (`.glb`), one per product (not a shared catalog like Logos). See "3D Model Viewer" below.
- `CompatibleLink` — product→product "Compatible Products & Accessories", ordered, keyed on Hub ids with both sides cascading. Edited in the product editor's Compatible Products section and rendered by the `compatible` carousel; 286 links imported (Stage 3d).
- `ProductCategory` — product↔category assignment, **Hub-owned** (no FK; categories live in Duda), pushed to Duda by `duda:sync-categories`. `CategoryMirror` is the local copy of Duda's tree the public endpoints read; `CategoryOrder` is the Hub-owned drag order. See "Categories" below.
- `HubProduct` also **mirrors** Duda's `name`, `sku`, `slug` (`seo.product_url`), `thumbnailUrl` (`images[0]`) and `status`, written by `syncHubProduct` and refreshed in bulk by `hub:sync-mirror`, so public endpoints never call Duda. Its `descriptionHtml` is NOT a mirror — it is the authored copy the Overview tab renders (see the product editor section).
- `DudaEditorAccount` + `DudaEditorSiteAccess` + `DudaSsoAudit` — staff→Duda-account mapping, the per-site SSO allowlist, and an append-only audit of editor-access requests. See "Website Editor" below.
- `QuoteRequest` + `QuoteRequestItem` — see Quote Requests section below.

## Product identity / widget-to-backend detection method (confirmed)

The public widget (`backend/src/public-widget/widget.js`) determines which product it's rendering for like this, checked in order (recorded in `__saequipHub.lastInit.refFrom`):
1. A product passed in props, or a `data-slug="..."` attribute on a legacy mount `<div>`.
2. **Duda's page data** — `dmAPI…pageData().identifier`, which IS `HubProduct.dudaProductId` (see the Widget Builder section). This is what the live Widget Builder widgets use.
3. Otherwise, `window.location.pathname` against `/\/product\/([^\/?#]+)/` — the Duda product page URL pattern `/product/<slug>`.

That identity goes to `GET /public/products/content` as `?dudaId=` or `?slug=` (it also accepts `?sku=`, but SKUs are not unique — 4 are shared). `HubProduct.slug` is backfilled automatically from the Duda product's `seo.product_url` whenever a product is opened or saved in the dashboard, and in bulk by `hub:sync-mirror`.

## The embeddable widget

Single script (`GET /public/widget.js`, served by the backend, cached ~5 min) handles both:
- **Full embed** (legacy/simple): `<div id="saequip-product-hub"></div>` — renders every section.
- **Section-scoped embeds** (used in production, so sections can be placed independently anywhere on the Duda product template): `<div class="saequip-hub" data-section="sa-logos"></div>`, repeated per section (`sa-logos | cert-logos | specs | benefits | applications | downloads`, plus the newer `tabs | 3d-viewer | compatible`). ⚠️ `downloads` renders nothing today — the content endpoint returns `downloads: []` (Stage 3e). All mounts on a page share **one** memoized fetch per slug regardless of how many section-embeds/script copies exist. Renders inline (no iframe), so each mount auto-sizes — but note in Duda's **HTML/Embed element** you still need the **"auto height" toggle** enabled or Duda's own container clips it.
- Vanilla JS, no framework, fails silently on any error (never breaks the host page).
- **An empty section removes its own footprint.** Duda offers no way to hide an element conditionally, and hiding just the mount is not enough — Duda's HTML/Embed element is a wrapper with its own padding and min-height, so an empty widget still left a visible gap. `collapseMount()` hides the mount and then walks UP at most 4 levels, hiding each ancestor **only while that ancestor contains nothing but our mount** — so a column that also holds a heading is never touched, and the worst case is a smaller gap rather than missing page content. It fires on all four empty paths: no API/slug, an unknown `data-section`, an unknown product or failed fetch, and (the common one) a product with no content for the requested section. `data-collapse="false"` on a mount opts out. ⚠️ The legacy `downloads` section's inline lead form (name/email/company) predates the "File Requests" form and posts the OLD fields, which `/public/downloads/:id/lead` now refuses. It never renders (the content endpoint sends `downloads: []`); retire it rather than revive it — the resources widget is where downloads live.

## Duda Widget Builder widgets (the preferred embed route)

⚠️ **A plain HTML/Embed element cannot show real content inside Duda's editor.** Its script gets no product context there — `dmAPI` is unreachable and the editor URL (`my.duda.co/site/<id>/product`) has no slug to parse — so the editor shows an empty shell and layout work is blind. **Widget Builder widgets do** run in the editor, which is why `data.inEditor` exists.

**Verified live in the editor** (throwaway diagnostic widget, 2026-09-09): `data.inEditor === true`, `dmAPI.dynamicPageApi().isDynamicPage() === true` on a store product page, and `pageData()` returns the whole product. So the editor genuinely has a product context.

**`pageData().identifier` IS `HubProduct.dudaProductId`** — confirmed by lookup (`01M1XPJT6CCYYW1QPNW4HS39GW` → Trolley for EX Heater). Use it in preference to everything else:

| Key | Unique across the 96 products? |
|---|---|
| `identifier` → `dudaId` | **yes** — the stable primary key |
| `seo_url` → `slug` | yes, but changes whenever SEO is edited |
| `sku` | **no** — 4 duplicated, 3 missing |

`pageData()` also carries `name`, `description`, `price`, `variations`, `images`, `stock_status`, `category_ids` — so a widget can read native fields without calling our API at all. Note it reports **`"currency": "USD"`**, which is the store's actual setting.

### The widget shim to paste into Duda

⚠️ **`api.scripts.renderExternalApp` does NOT work for this widget — the shim loads the script and calls `init` itself.** Identical for every product-page widget except `section`:

```js
(function (el, section, inEditor) {
  // Stamped SYNCHRONOUSLY, before any async work.
  el.setAttribute('data-saeh-section', section);

  // Diagnostic: what Duda ACTUALLY put in `data`, before this shim touches it.
  // Keyed by section so several widgets on a page do not clobber each other.
  // `lastInit.propKeys` only shows what the SHIM built, which is a different
  // question and cost three round trips to tell apart once already.
  (window.__saehData || (window.__saehData = {}))[section] = data;

  var SRC = 'https://sa-equip-backend.vercel.app/public/widget.js?v=22';
  var L = window.__saehLoader || (window.__saehLoader = {});
  if (!L.p) L.p = new Promise(function (res, rej) {
    var s = document.createElement('script');
    s.src = SRC; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  L.p.then(function () {
    window.SAEquipHubWidget.init({ container: el, props: { section: section, inEditor: inEditor } });
  }).catch(function () {});
})(element, 'compatible', data.inEditor);
```

⚠️ **The section is an IIFE PARAMETER and is stamped on the element — not held in a `var`.** Both halves matter, and this is the second time the same bug has appeared. Every shim's `.then()` runs *after* every shim has been evaluated, so any shared binding holds the **last** widget's value by then. Symptom: the compatible widget rendered the 3D viewer's content on the **live** page while the **editor looked fine** — because the editor initialises widgets one at a time and live does them all in one tick.

`init()` therefore treats **the container's `data-saeh-section` attribute as authoritative**, with props as fallback: there is one attribute per element and each shim only ever writes its own, so crossed props cannot misroute a widget. A disagreement between the two is recorded in `__saequipHub.inits[].sectionMismatch` rather than silently rendered. Covered by `widget:test`, which reproduces four shims sharing one props object.

- The five sections: `sa-logos`, `cert-logos`, `tabs`, `3d-viewer`, `compatible`.
- **`compatible` also runs on STATIC pages** (the Industries pages), driven by a
  **category** instead of by the page's product — see "Category mode" below. It
  takes three extra content-panel values, so its shim is the full thing below
  rather than a variant of the one above:

  ```js
  (function (el, section, inEditor, cfg) {
    // Stamped SYNCHRONOUSLY, before any async work.
    el.setAttribute('data-saeh-section', section);

    // Diagnostic: the RAW object Duda handed this shim. See the console table.
    (window.__saehData || (window.__saehData = {}))[section] = data;

    // Read into primitives NOW, at evaluation time — see the warning below.
    var singlePage = cfg.singlePage, productCategory = cfg.productCategory, heading = cfg.heading;

    var SRC = 'https://sa-equip-backend.vercel.app/public/widget.js?v=22';
    var L = window.__saehLoader || (window.__saehLoader = {});
    if (!L.p) L.p = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = SRC; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    L.p.then(function () {
      window.SAEquipHubWidget.init({
        container: el,
        props: {
          section: section,
          inEditor: inEditor,
          singlePage: singlePage,
          productCategory: productCategory,
          heading: heading
        }
      });
    }).catch(function () {});
  })(element, 'compatible', data.inEditor, data.config || data);
  ```

  ⚠️ **Content-panel values live on `data.config`, NOT on `data`.** This cost
  five round trips to find. `data` itself carries only platform context —
  measured live, its keys are exactly `device | page | inEditor | accountId |
  siteId | widgetId | widgetVersion | elementId | config | refresh | locale` —
  and the panel's own variables are nested one level down in `config`. Note
  `inEditor` IS top level, which is what made the mistake survive: the shim read
  `data.inEditor` correctly right beside `data.singlePage` reading `undefined`,
  so the pattern looked proven. `data.config || data` keeps it working if a
  future widget version flattens them.

  **When a content-panel value does not arrive, read the raw object FIRST:**

  ```js
  Object.keys(__saehData['compatible']).join(' | ')   // then JSON.stringify it
  ```

  That single read would have ended this in one round trip. Instead four were
  spent on theories that were all wrong, and each is worth NOT re-chasing:

  | Theory | Why it was wrong |
  |---|---|
  | Widget/site needs republishing | `inEditor:false` + `page:'aviation'` proved the right code was on the right page already |
  | Browser serving a cached script | real, but separate — it is why the build hash now exists, and it was not this |
  | Duda sends `"true"` not `true` for a checkbox | it sends a real boolean; `truthyProp()` is defence, not the fix |
  | Dynamic dropdown passes `{value,label}` | it passes the bare string `"aviation"` |

  The through-line: every one of those was a guess about a system whose actual
  output was one console command away. **Prefer the read over the theory** —
  especially here, where Duda's behaviour is undocumented and cannot be
  inferred from the parts of it that already work.

  Confirmed working live 2026-09-15: `widgetVersion` 7, `config`
  `{singlePage:true, heading:"Aviation", productTag:"aviation"}` — that was the
  TAG-era shape; the field is `productCategory` since tags were retired, but the
  measurement of where the values live is unchanged.

  ⚠️ **Read the values into primitives at evaluation time**, as above, rather
  than reaching into `cfg` inside the `.then()`. Every shim on a page is
  evaluated before any promise resolves, so anything dereferenced later can hold
  another widget's value — the bug that once had this widget rendering the 3D
  viewer's content on the live page while the editor looked fine.

  Duda supplies a real boolean for a checkbox and a bare string for a dynamic
  dropdown's value (verified at the time as `{"singlePage":true,"productTag":"aviation"}`;
  the key is `productCategory` now).
  `truthyProp()` and the object-shape handling in `init()` are defence against
  other representations, not descriptions of what actually arrives.
- The `?v=` is a cache-buster; `/public/widget.js` is served with `max-age=300`. **Bump it whenever the widget changes** or Duda serves the cached copy.
  ⚠️ **Bump it in EVERY shim, not just the one you changed.** All shims share one promise on `window.__saehLoader`, so the script is fetched once using whichever `SRC` was evaluated first — a single stale `?v=` can therefore serve the cached old copy to every widget on the page. The snippets here use `?v=22`, but **the live values are whatever is in each shim in Duda's Widget Builder** — measured on the live EX Heater page 2026-10-02: four shims at `?v=17` and one at `?v=232`. Harmless as it stands (the server ignores `?v`; it only splits the browser cache, so every copy is current within 5 minutes), but a bump only takes effect at once if EVERY shim gets it. Read the live values with `curl -s <product page> | grep -o 'widget\.js?v=[^"]*' | sort | uniq -c`.
- The shared promise on `window.__saehLoader` means every widget on a page fetches the script **once** between them.
- **No `dudaId` prop.** The widget resolves the product itself (`dudaPageProduct()` → `identifier`, falling back to the `/product/<slug>` URL), so the shim needs no product lookup and therefore no `await`.
- `https://my.duda.co` must be in `WIDGET_ALLOWED_ORIGINS` or the editor's fetch 403s. Negligible exposure — that endpoint serves content already public on the site.

### Why not `renderExternalApp` (diagnosed 2026-09-09, don't re-litigate)

Called as documented — `renderExternalApp(src, element, props, {amd:false, name:'SAEquipHubWidget'})` — it **fetched the script and then never called `init()`**, silently. Proven from the console on the live `/product/ex-heater`:

| Evidence | Reading |
|---|---|
| `scriptTags: [".../widget.js?v=3"]` | the shim ran and `renderExternalApp` DID load us — that `?v=` exists nowhere else |
| `SAEquipHubWidget.version` correct | the current script executed and assigned its global |
| `__saequipHub.lastInit` `undefined` | `init` was never called — nothing downstream of it ever ran |
| manual `init({container, props})` | rendered 461 chars correctly — widget, API, CORS and identity all fine |
| `legacyMounts: 0`, `requirejs: false` | no legacy embed and no require.js muddying it |

That pattern is a loader consuming the script's **module value** instead of `window[name]`: a bare IIFE evaluates to `undefined`, so `undefined.init(...)` is never reached and nothing is logged. Rather than keep guessing at an invocation contract we can't see, the shim now loads the script itself — four deterministic lines. widget.js **also** publishes an AMD module (`define(function(){ return iface })`) so it satisfies either contract; `widget:test` asserts the AMD and global paths expose the same object.

⚠️ **Don't wrap the shim in an `async` IIFE that awaits before rendering.** An earlier version awaited `dmAPI…pageData()` to pass `dudaId`; a never-settling await renders nothing with no error at all. Measured since, `pageData()` resolves in **~1ms** live, so that wasn't this outage — but the failure mode is real and there's nothing here worth awaiting. Inside the widget, `dudaPageProduct()` races `pageData()` against `PAGE_DATA_TIMEOUT_MS` (1.5s) and degrades to the URL slug, so the same hang can't strand the render path either.

**Console diagnostics** (this class of bug leaves no other trace):

| Read | Tells you |
|---|---|
| `SAEquipHubWidget.version` | whether Duda is serving a cached copy — but **not** that `renderExternalApp` ran, since a legacy HTML/Embed on the page loads the same script. ⚠️ The trailing `+<hash>` is a **sha1 of the served file, stamped in by the route**, and it is the half you compare: the hand-written date is only bumped when someone remembers, and when they did not, a cached older copy reported exactly the same string as the current build — the one question the marker exists to answer, answered wrongly. A literal `%BUILD%` means the file was read from disk rather than served |
| `__saequipHub.lastInit` | `undefined` ⇒ Duda never called `init`, so the fault is in the shim, not the widget |
| `__saequipHub.inits` | every init on the page, in order — `lastInit` alone is overwritten by whichever widget ran last |
| `$$('[data-saeh-section]').map(e => e.getAttribute('data-saeh-section'))` | which section each widget container actually asked for, in document order. This is how you check a widget is wired to the section it's named after — `buildSection` is a plain string switch, so a widget showing another widget's content means the wrong `section` string is in that widget's JS |
| `__saequipHub.lastInit.argKeys` | what shape Duda actually passed |
| `__saequipHub.lastInit.refFrom` | `props` / `dmAPI` / `url` / `none` — which identity source won |
| `__saehData[<section>]` | the RAW `data` object Duda handed the shim, before any coercion. **This is the one to read when a content-panel value does not arrive** — and remember the panel's own fields are under `.config`, not at the top level — `Object.keys(__saehData['compatible'])` shows which fields Duda actually supplies, which is a different question from what the shim passed on |
| `__saequipHub.lastInit.propKeys` | which props the shim actually passed. **The first thing to read when a static-page (category mode) widget renders nothing**: no `singlePage` key at all means the shim in Duda was never updated to the six-argument form, whereas the key present but `false` means the shim is current and the checkbox is simply off. The two are otherwise indistinguishable — both just fall through to product resolution, find no product, and collapse |
| `__saequipHub.lastInit.mode` | `"category"` when the compatible widget took the static-page path, `"product-list"` for the listing widget. Absent means a product page, whatever the content panel appears to say |
| `__saequipHub.lastInit.categoryFrom` | listing widget only: which source named the category — `props` / `dmAPI` / `url` / `query` / `none` |
| `__saequipHub.pageDataTimedOut` | `true` ⇒ Duda's `pageData()` hung and the URL slug was used

### Both entry points are live at once, deliberately

`widget.js` exports `init`/`clean` for `renderExternalApp` **and** still scans the DOM for `.saequip-hub` mounts, so the existing HTML/Embed placements keep working until the Widget Builder route is proven on real product pages. Both funnel through one `renderInto()`, so they cannot drift.

The one behavioural difference: **an empty widget collapses on the live site but NOT when `inEditor` is true**, where the container is left exactly as Duda rendered it so any placeholder stays visible and the element stays selectable.

## The product listing widget (`section: "product-list"`, 2026-09-29)

Goes on Duda's **category page template**, once, for every category page. Filter panel plus
a product grid, pre-filtered to the category the page is for.

### The Duda shim

```js
(function (el, section, inEditor, cfg) {
  el.setAttribute('data-saeh-section', section);
  (window.__saehData || (window.__saehData = {}))[section] = data;

  var category = cfg.category, filterGroup = cfg.filterGroup;

  var SRC = 'https://sa-equip-backend.vercel.app/public/widget.js?v=22';
  var L = window.__saehLoader || (window.__saehLoader = {});
  if (!L.p) L.p = new Promise(function (res, rej) {
    var s = document.createElement('script');
    s.src = SRC; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  L.p.then(function () {
    window.SAEquipHubWidget.init({
      container: el,
      props: { section: section, inEditor: inEditor, category: category, filterGroup: filterGroup }
    });
  }).catch(function () {});
})(element, 'product-list', data.inEditor, data.config || data);
```

Content panel: both fields are optional. `category` overrides which category the page filters
to (normally resolved from the URL); `filterGroup` names the top-level parent whose children
are BOTH the sidebar's checkboxes and the card chips, defaulting to "Site Challenges".

⚠️ Duda's native **Sort & Filter** element and product grid must be removed from the
category template, or the page shows two listings.

### How it works

- **One fetch of `/public/catalogue`**, filtered client-side. 96 products is ~29KB, so a
  round trip per checkbox would cost more than it saves.
- ⚠️ **The page's category is a fixed BASE FILTER, not a checkbox.** On
  `/category/lighting-and-power` the grid only ever shows that category's products, and no
  control can widen past it — the visitor widens by navigating, which is what the megamenu is
  for. A **parent** page (`/category/industries`) scopes to itself plus its children, since a
  product sits on the leaves. No category resolves (an unknown slug, a non-category page) ⇒
  the whole catalogue.
- ⚠️ **One axis in the sidebar: Site Challenges.** Industries and product types are *how you
  arrived*, not how you refine, so offering them back as checkboxes only lets a visitor
  contradict the page they are on. `filterGroup` names the parent, so a rename costs a
  content-panel edit rather than a deploy.
- ⚠️ **Only options that appear in the base set are rendered.** An option matching nothing in
  this category is a dead click; the check is against the BASE set, not the current results,
  so options do not vanish from under the cursor as boxes are ticked. No options at all also
  means no "Clear filters" button, which would otherwise sit alone in an empty panel.
- **The empty state is centred in the grid column** with a `34ch` cap, so the sentence breaks
  somewhere sensible rather than at whatever width the column happens to be.
- **Filter semantics: OR.** Ticking a second challenge widens. With one axis there is nothing
  to AND across, and "must match all" empties the grid on nearly every real combination.
- **Counts beside each option** are "how many would show if this were added", recomputed on
  every change — never a static total, which would promise results a click cannot deliver.
- ⚠️ **Category resolution is by SLUG from the mirror, never derived.** Duda renders
  "Oil & Gas" as `oil---gas`, so a slugified title would miss exactly the ampersand
  categories, silently. Sources in order: the content-panel `category` prop (an explicit
  override) → `dmAPI` page data → `/category/<slug>` URL → `?category=`, recorded in
  `__saequipHub.lastInit.categoryFrom`.
- ⚠️ **`product-list` is deliberately absent from `ALL_SECTIONS`** — it belongs to a category
  page and has no product, so the legacy `data-section="all"` embed must never build it.
- Cards: white, **square 1:1 image using `object-fit:contain`** (cropping industrial kit to
  fill a square cuts the product out of frame) sitting flush with no padding and a small
  scale on card hover, chips from the filter group, an **h4** title, certification text, and
  **one** "View Product" button.
- ⚠️ **Each certification is its own `nowrap` span, not one joined string.** A single text
  node lets the browser break anywhere, and "Zone 1-2" wrapped as "Zone" / "1-2" — which
  reads as two separate marks on hazardous-area equipment. `nowrap` also covers the hyphen,
  which is its own break opportunity; a non-breaking space would not have. The separator is
  a bare text node so the only break is BETWEEN items and a comma never starts a line.
- ⚠️ **Chips are WHITE.** They were `#f1f1f1` on the body's `#f4f4f4` — three values apart,
  so the Site Challenge label was effectively invisible.
- ⚠️ **Certification text reads `Logo.alt || Logo.label`.** Every `alt` is empty today, so
  labels render — which means cards say "EX logo", "UKCA" and "Made in Britan" rather than
  ATEX/UKEX. The first two are deliberate (see the logo mapping note); filling `alt` on the
  Logos page changes the display without a code change.
- **The panel is headed by an `h6` "Filter Products" with an inset divider**, then a labelled
  search. ⚠️ **That heading and the mobile toggle carry the same words, so exactly one is
  visible at a time** — the heading is `display:none` by default and the desktop block swaps
  which shows, mirroring how the toggle is hidden there. Otherwise the label is rendered and
  announced twice.
- **"Search within category" is a real `<label for>`**, not an `aria-label`: the accessible
  name should be the one on screen. ⚠️ The input and its X sit in their own `.saeh-pl-sbox`
  positioning context — against `.saeh-pl-search` the X would centre on the label and input
  together and sit low. **Focus matches the dashboard's own field treatment** (`fieldBase` in
  `components/ui/Input.tsx`): the border takes the ring colour and a 3px ring is drawn at
  HALF opacity, both eased over 150ms. A ring rather than a thicker border because
  `box-shadow` takes no layout space, so the field cannot shift by a pixel as it gains focus.
  ⚠️ **The literal `rgba(254,210,23,.5)` fallback is its own rule and must stay that way.**
  `color-mix` is what applies the alpha to the THEME colour rather than a hardcoded yellow,
  but a browser that does not know `color-mix` drops the whole declaration — merged into one
  rule that would leave no ring at all.
- The panel heading and the group heading share one type treatment (`--saeh-body`, 14px/600,
  sentence case): they are peers in the same panel, and two different treatments for two
  labels a few pixels apart just reads as an inconsistency. The group heading renders the
  category title **as stored**, so "Site Challenges" is not re-shouted by CSS.
- **Search runs on ENTER**, over the product name AND its category titles, so "welding" finds
  the products under Welding Fume Control — the mockup's "Product or task". ⚠️ Deliberately
  not instant: re-rendering the grid mid-word makes the list jump under your thumb on a phone
  with the keyboard open, and "weld" strands you on an empty page on the way to "welding
  torch". ⚠️ It sits OUTSIDE the collapsible panel: on a phone the filter list is behind a
  toggle, and the search is the control people reach for first, so hiding it behind a click
  is the wrong trade. The native `::-webkit-search-cancel-button` is suppressed for an inline
  stroked-SVG X that inherits `currentColor` and matches the rest of the site.
- **18 per page**, then a bordered "Load more products +N" that fills black on hover. Any
  change to the search or the filters resets to the first page — otherwise a narrowed result
  set keeps a button with nothing left to load.
- ⚠️ **Loading more must not move the viewport at all.** Two separate things broke this, and
  both are pinned by `widget:test` asserting node identity plus a zero `focus()` count:
  rebuilding the grid sent the visitor to the TOP, and re-creating the button then refocusing
  it sent them to the BOTTOM. `.focus()` scrolls its target into view, and a mouse click
  focuses a button — so the "keyboard users press Enter on this" courtesy fired on every
  click. The button is now created once and only its count changes, so there is no focus to
  restore and nothing that can scroll.
- ⚠️ **"Load more" APPENDS; it must never rebuild the grid.** Emptying the grid shrinks the
  document to almost nothing, so the browser clamps `scrollY` to the new maximum and the cards
  appended a moment later cannot put it back — the visitor is thrown to the top of the page.
  Appending never shrinks the page, so there is nothing to clamp; it also stops the
  already-visible cards replaying their entry animation. A filter or search change *does*
  rebuild, because those are different products. `paint(append)` carries the distinction and
  `rendered` tracks where to resume; both cases are covered by `widget:test`, which asserts
  the existing cards are the same DOM nodes afterwards.
- Mobile-first: **stacked with a collapsible filter panel**, becoming a sticky sidebar only
  at 881px. Grid is 1 / 2 / 3 up at the house 561 / 881 breakpoints. The sidebar is
  `position:sticky` with `max-height:calc(100vh - 40px)` and its own scroll — ⚠️ sticky only
  works there because `.saeh-pl` sets `align-items:flex-start`; a stretched flex item fills
  the row and has no room to move. A 5px rule in `var(--color_7)` (Duda's theme colour, brand
  yellow only as the editor-preview fallback) tops the filter bar.
- **Cards fade up as they arrive** — first paint, every filter change, every loaded page —
  with an `nth-child` stagger capped at ~0.1s so a 40-card page is not a slow cascade.
  Silenced entirely under `prefers-reduced-motion`.
- ⚠️ **The "View Product" chevron is drawn INLINE, not fetched.** The label is 16px/400
  sentence case to match the site's buttons, and a 19px double chevron slides in on card
  hover while the label slides left to stay centred. A network-loaded icon would be blank
  for exactly as long as the hover that reveals it — the one moment it has to be there.
  `CHEVRON_ICON_SRC` is fine for the always-visible carousel arrows; it is the wrong tool
  here.
- ⚠️ **`.saeh-pl-chevwrap` animates; the `<svg>` keeps a FIXED size inside it.** Animating
  the svg's own `width` scales its viewBox content, because the default
  `preserveAspectRatio` fits the drawing to whichever axis is smaller — so the chevron
  zoomed up from a dot instead of sliding out from behind the label. Reveal an icon by
  clipping a wrapper, never by resizing the icon.

## The resources widget (`section: "resources"`, 2026-10-02)

One Duda widget for three static pages — **Datasheets**, **User Manuals** and
**Certificates** — chosen by a content-panel dropdown. Every file is gated behind a request form (see "Gating" below). Each row:
picture, SA range logo, name, "View Product", and one yellow button per file; on
Certificates, one button per scheme (INMETRO / UKEX / IECEX / EX / Compliance). Set-up steps
and the paste-ready shim are in `duda-widgets/resources/` (`SETUP.md`, `resources.js`).

### The Duda shim

```js
(function (el, section, inEditor, cfg) {
  el.setAttribute('data-saeh-section', section);
  (window.__saehData || (window.__saehData = {}))[section] = data;

  var resourceType = cfg.resourceType, heading = cfg.heading, subheading = cfg.subheading;

  var SRC = 'https://sa-equip-backend.vercel.app/public/widget.js?v=25';
  var L = window.__saehLoader || (window.__saehLoader = {});
  if (!L.p) L.p = new Promise(function (res, rej) {
    var s = document.createElement('script');
    s.src = SRC; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  L.p.then(function () {
    window.SAEquipHubWidget.init({
      container: el,
      props: {
        section: section,
        inEditor: inEditor,
        resourceType: resourceType,
        heading: heading,
        subheading: subheading
      }
    });
  }).catch(function () {});
})(element, 'resources', data.inEditor, data.config || data);
```

Content panel: a **static dropdown** `resourceType` (Datasheets=`datasheet`, User
Manuals=`manual`, Certificates=`certificate`) and two optional text fields, `subheading` and
`heading`, rendered as a real **`h6` above an `h2`**, 15px apart, on the left of the search.
⚠️ **The site's THEME styles them, not the widget**: Duda targets every h2/h6 in the page
content (`#dmRoot #dm div.dmContent h2`), which outranks any widget class, so they match the
site's own headings (h2 Barlow 400 at 42/34/30px, h6 Inter 700 14px, measured 2026-10-05). The
widget sets only their margins and line-height, which the theme leaves alone, plus a fallback
copy of that type for anywhere the theme does not reach. Values live on
`data.config`, as for every other widget. `resourceTypeOf()` also accepts the labels, plurals
and a `{value,label}` object, so a mis-set panel is not silently empty; `lastInit.resourceType`
(coerced) and `lastInit.resourceTypeRaw` (what Duda sent) are the console reads when it is.

### Which file goes on which page — set per file, never guessed

`Download.kind` + `Download.certScheme`, with a database **CHECK** that a scheme exists *iff*
the kind is `CERTIFICATE`. Set in the product editor: each row in `DownloadsSection` has a
**Type** select and, for a certificate, a **certificate** select. Both are required to save, so
a newly added file is on no page until someone chooses. Choosing a type fills the canonical
title ("Datasheet", "ATEX Certificate", "Compliance Statement"…) **only while the title is
still automatic** — empty, the filename default, or a title an earlier choice filled in
(`retitle()` in `frontend/src/lib/downloadKinds.ts`). A typed title is never overwritten.

The 176 imported downloads were typed from their titles by `npm run downloads:classify`
(dry run by default; `--confirm`; only untyped rows unless `--force`; an unknown title is a
hard failure before any write). Result: Datasheets 59 products, User Manuals 25, Certificates
29 (EX 27, IECEX 24, UKEX 20, INMETRO 19, COMPLIANCE 2). ⚠️ **"ATEX Certificate" is the `EX`
scheme** — the old site's button label — and the two generic "Certificate" files are the
Filtration Unit compliance statements, which got their own `COMPLIANCE` scheme (Josh,
2026-10-02).

`PUT /api/products/:id/downloads` now **requires** `kind` on every item and `certScheme`
exactly when it is a certificate, refined in zod to the same rule as the CHECK so a bad item is
a 400 that names the field rather than a 500. The single-row `POST`/`PATCH` predate types and
leave them alone; a row they create is on no page until typed through the PUT.

### `GET /public/resources?type=datasheet|manual|certificate`

A pure Hub read (`contentLimiter`, `s-maxage=60`). Every public product with ≥1 public download
of that type, each `{name, url, imageUrl, range:{label,logoUrl}|null, downloads:[{id, label,
title, href}]}`. Unknown type → 400 (an own-property check, so `?type=constructor` is not
`Object.prototype`'s).

- ⚠️ **`LISTED_DOWNLOAD` in `services/hubProduct.ts` is the ONE definition** of a listed
  download — typed, on a product that is `LISTABLE` *and* has a slug — used by this list and
  the request form; `PUBLIC_DOWNLOAD` is that plus `gated: false`, and only the direct file
  route uses it. So a page cannot offer a file the routes refuse, a HIDDEN product's
  certificate is reachable by no route, and a gated file is reachable only through the form.
  Each download in the payload carries `gated`, and a gated one has `href: null`.
- **Ordered by SA range** (the Logos page's `sortOrder`), A–Z within a range, no-range last. The
  range is the product's first SA logo that is **not Rental** (`/rental/i` on label, alt or
  filename): Rental sits beside a range — 51 products carry both — and the old pages never
  showed it.
- ⚠️ **7 products have only the Rental logo, so they list last with no range logo**: the EX
  Compact / EX / EX High Capacity / High Volume / Lightweight Dust Extraction Systems and the
  EX Paint / EX Vapour Extraction Systems. Ticking a range logo on the product fixes it — a data
  edit, not a code one.
- Buttons are labelled server-side: "Download Datasheet" / "Download User Manual", or the
  scheme, in `SCHEME_ORDER`. Two files under one label fall back to their titles (none today).
- ⚠️ **No file URLs in the payload.** A list of 59 products would otherwise sign 59 URLs nobody
  opens, and signing inside one `Promise.all` is exactly what made the content endpoint
  all-or-nothing.

### `GET /public/downloads/:id/file`

302 to a fresh signed URL (2 minutes, inline, so the PDF opens in the new tab's viewer) when the
download matches `PUBLIC_DOWNLOAD`; otherwise the **same bare 404** whatever the reason, so the
response says nothing about which. `Cache-Control: no-store` on both — a cached redirect would
hand the next visitor an expired signature. Its own in-memory limiter (30/min/IP). A top-level
navigation carries no Origin, so `publicCors` passes it; a cross-site `fetch()` from a
disallowed origin still 403s. ⚠️ It serves UNGATED files only — a gated one gets the same 404,
so the gate holds even for someone who copies a download id.

### The widget

- **Page-level, like `product-list`**: in neither `ALL_SECTIONS` nor `VALID`, reached only
  through `init()`, which branches out before any product work. `data-section="all"` never
  fetches it (tested).
- One fetch per type per page (`hub.resourceFetches`). Rows are built with `textContent` and
  attributes only; a product URL that is not a site path becomes `#`.
- ⚠️ **The type goes in `data-saeh-resource-type`, never into `data-saeh-section`.** `init()`
  reads that attribute first on a re-init, so it must stay exactly `resources`.
- Accessibility: the picture repeats the product link, so it is `aria-hidden` and out of the
  tab order — one link per product. Each button's accessible name starts with its visible
  label ("EX – EX Heater (PDF, opens in a new tab)") so speech input still matches it.
- Layout: mobile-first, buttons on their own row two to a line; at **721px** they move to the
  right of the row; from **1024px** a full row of four certificates fits on one line.
  ⚠️ **Rows are spaced only by the list's 12px `gap`.** An extra margin once marked where one
  SA range ended and the next began, and read as inconsistent spacing (removed 2026-10-05);
  `widget:test` now asserts no row rule carries a `margin-top`.
- **Search, top right** (stacked under the heading on a phone). Built like the listing's: the
  same field, X and **ENTER-to-search** rule, with no caption above it — its `<label for>` is visually
  hidden (`.saeh-rs-sr`), so the field keeps an accessible name. Placeholder and label name the
  page's own list — "Search Datasheets…", "Search User Manuals…", "Search Certificates…"
  (`RESOURCE_SEARCH_LABEL`) — and it
  **shares** the listing's input CSS (`.saeh-pl-search input,.saeh-rs-search input`) rather
  than copying it. Matches the product name, the range ("cyclone") and the button labels
  ("ukex"). Rows are hidden with a class, not rebuilt — ⚠️ not the `hidden` attribute, which
  `.saeh-rs-row{display:grid}` would beat. A no-match line shows the query as text, and the
  result count is announced through a visually hidden `role="status"`.
- Empty or unconfigured: collapses live; **in the editor it renders a placeholder saying what to
  choose**, and tells a failed fetch apart from an empty list — an empty box cannot be found to
  select.

### Gating — the "File Requests" form (2026-10-05)

Every file on the three pages asks for the visitor's details first, **on every download**
(Josh's choice — nothing is remembered, every request starts blank). A gated download is a
`<button>` that opens a modal: an `h2` "File Requests", the file being requested, the spam
paragraph, First / Last / Company / Email / Tel (all required — the quote form's set) and
Mobile (optional), a required privacy checkbox linking `/privacy-policy`, an optional
marketing checkbox, and "Submit & Download".

- ⚠️ **`/privacy-policy` does not exist on the Duda site yet** — create it before launch, or
  the consent link 404s.
- **`POST /public/downloads/:id/lead`** stores a `Lead`, THEN signs a 5-minute URL. Accepts a
  `LISTED_DOWNLOAD` only (it used to sign any id at all). `.strict()` zod; control characters
  stripped (`headerSafe`); phone fields must look like phone numbers (the widget checks the
  same rule first). **`elapsedMs` is REQUIRED** — unlike the basket, the widget sending it is
  ours — and a filled honeypot or an under-1.5s fill gets `{ok:true}` with no file and nothing
  stored. Postgres-backed limits: 10/minute and 30/hour per IP.
- ⚠️ **The consent wording is stored as the SERVER holds it** (`CONSENT_TEXT` in
  `services/downloadKinds.ts`), so a request records what was actually agreed to. The widget's
  copy must match word for word — `widget:test` reads both and fails on drift.
- ⚠️ **The new tab is opened INSIDE the click**, then pointed at the file when the server
  answers: a `window.open` after the request returns is outside a user gesture and every popup
  blocker stops it. A blocked tab falls back to an "Open your file" link, which is a real click.
  Any failure closes the blank tab and keeps the form.
- The modal is appended to `<body>` (like the 3D viewer), so the theme's `div.dmContent`
  heading rules do NOT reach it — its `h2` restates the theme's look itself. Focus is held
  inside, Escape/X close, focus returns to the button; a backdrop click deliberately does not
  close it. Fields, button and checkbox share the existing search/download/filter rules.
- **Resource Requests** (`/resource-requests`, sidebar after Quote Requests) lists every
  request newest first — `GET /api/resource-requests`, behind `requireAuth` — with a detail
  view (every field, the consent wording, the file with its product picture and editor link)
  and a CSV export. Both CSV exports share `lib/csv.ts`, which holds the formula-injection
  guard. Each row carries snapshots of the file and product, so it stays complete after the
  download is removed ("Since removed").
- ⚠️ **Order of rollout: deploy, THEN gate the data.** `npm run downloads:gate --workspace=backend`
  (dry run; `--confirm`; `--ungate --confirm` to undo) flips the existing files. The code before
  this listed ungated files only, so gating first would have emptied all three pages until the
  deploy landed — the same lesson as "deploy the guard BEFORE running the import".
- No email goes anywhere (Resend is not set up; these feed the CRM later, like quotes), and
  there is no role model: any signed-in user can read every request. Requests are personal
  data — deletion on request is a database job until a delete button is built.

## Languages — multi-language Duda sites (phases 1–4 built 2026-10-06)

The client added Arabic to the live site and wants Chinese (Simplified), French, German,
Portuguese (Brazil) and Spanish. The full plan, measurements included, is
`~/.claude/plans/splendid-gliding-dolphin.md`. **Built:**
- phase 1: the widgets speak the page's language
- phase 2: translation storage, the public overlay, Duda's translated names
- phase 3: the mass translation, all six languages imported
- phase 4: translate-on-save in the dashboard, and the Translations page

**Not yet: phase 5**: right-to-left if the client chooses it, a Chinese check, and native review.

**Measured on the live site** (Arabic added by the client, 2026-10-06):
- The default language is unprefixed; `/ar/…` for Arabic. **Slugs are NOT translated**
  (`/ar/product/ex-heater`).
- The page says its language with `<html lang="ar">` and `window.Parameters.currentLocale`.
- ⚠️ **Duda does NOT make Arabic right-to-left**: the computed direction is `ltr`.
- Duda's REST API is English-only. Language parameters are ignored and there is no
  translations endpoint. The published page's JSON-LD and `pageData()` carry Duda's translated
  product name and description.
- `GET /sites/multiscreen/{site}` → `lang: "en-gb"`, `additionalLanguages: ["ar"]`.

**The widget** (`widget.js`):
- `currentLocale()` reads `<html lang>`, then `Parameters.currentLocale`, then
  `__saehData[*].locale`; a `props.locale` overrides. Recorded in
  `__saequipHub.lastInit.locale` / `localeFrom` / `localeSignals`.
- An unsupported language renders English and says `lang="en"`.
- `LOCALES` and `normaliseLocale()` mirror `backend/src/services/i18n/locales.ts`; `widget:test`
  compares the lists. ⚠️ Traditional Chinese (`zh-TW`/`zh-Hant`) is deliberately NOT folded
  into Simplified.
- **Text:**
  - `T(key, vars)` / `TP(key, n)` / `fillNodes()` over the `I18N` table: ~75 keys × 7
    languages, machine-drafted and awaiting native review.
  - Plurals use `Intl.PluralRules`; Arabic's six forms are tested.
  - Templates, not concatenation, so word order can change, e.g. `"… {link}"`.
  - Certification marks (INMETRO, UKEX, IECEX, EX) are names and are not translated.
- **Links keep the language:** `localHref()` prefixes the page's own segment. That covers card
  links, resources links, `/privacy-policy` and relative links in descriptions.
  - ⚠️ `sitePrefix()` takes the first path segment only when it is shaped like a language tag
    AND matches the page's language, so `/aviation` is never a prefix.
  - Never applied to API or file URLs.
- Every data request sends `&lang=xx`, and English sends none, so English cache keys are
  unchanged. Every memo key includes the language.
- `stampLang()` sets `lang` on every root and overlay.
- **Arabic layout:**
  - Letter-spacing is reset on Arabic pages, because it breaks letter joining.
  - ⚠️ **The request form reads right-to-left in Arabic** (`.saeh-rq-overlay:lang(ar)`). It is
    our own overlay, and in a left-to-right box Arabic sentences put the full stop beside the
    first word.
  - Email and phone fields stay `dir="ltr"`.
- The form shows a translated message per HTTP status, never the server's own text, which
  showed "rate_limited" raw.
- `filterGroup` matches the category slug, then the English title (`titleEn`).

**The server:**
- ⚠️ **`CONSENT_TEXT` is per language** (`services/downloadKinds.ts`).
  - A request stores `Lead.consentText` in the visitor's language, `consentTextEn` and `locale`.
  - `widget:test` builds every language's consent from the widget's table and requires the same
    language set on both sides.
  - The non-English consent is machine-drafted legal text and **needs native review**.
- The lead route folds Arabic-Indic and full-width digits (and a full-width @) to ASCII
  before validating, and the widget does the same.
- `/public/resources` sends `labelKey`/`labelFromTitle`, so buttons are labelled in the page's
  language.

**Phase 2 — storage and the public overlay:**
- **`Translation`** holds Hub-only text: descriptions, spec labels and values, list items
  and logo text.
  - ⚠️ It is keyed by `(locale, kind, sha256 of the normalised ENGLISH)`, not by row id. Spec
    and list rows are recreated on every save, so row ids would orphan their translations.
  - Identical text is translated once, for every product that uses it.
  - Each row records `origin` MT or STAFF, its `engine`, and `text` (null means rejected,
    with `lastError` saying why).
- **`DudaTranslation`** holds Duda's own translated product names and category titles,
  copied from the PUBLISHED pages by `npm run i18n:sync-duda` (dry run by default).
  - The source is the pages' JSON-LD and breadcrumbs, with category `<title>`s as a fallback,
    because Duda's API is English-only.
  - It reads the site's languages from Duda (`getSiteLanguages()`), so the URL prefix is Duda's
    own code, never assumed.
  - A failed fetch or parse writes nothing.
  - **Arabic: 96/96 names and 23/23 titles copied (2026-10-06).** Re-run after the client edits
    Store Languages and republishes, or use `POST /api/translations/duda/refresh`.
- ⚠️ **`saveTranslations()` (`services/i18n/store.ts`) is the ONE writer**, so the rules
  cannot drift:
  - Every translation is checked by `validateTranslation()`. Every number (Arabic-Indic
    digits count), certification mark, brand and acronym must survive, and a description must
    keep identical tags and links.
  - ⚠️ A machine translation NEVER replaces a STAFF one.
  - An unsafe machine result is stored as rejected, and the English is shown.
  - An unsafe staff edit is refused.
  - Pass-through text (`isPassThrough()`: codes, measurements, ALL-CAPS marks) is never stored
    and always shows as it is.
- **The overlay** (`services/i18n/overlay.ts`) runs on `?lang=` for `/products/content`,
  `/catalogue`, `/products/by-category` and `/resources`.
  - Payloads gain `lang`, `nameEn` and `titleEn` (the widget searches English too), and sort
    with `Intl.Collator(lang)`.
  - Translation happens LAST, so the Rental check and the filter-group match run on English.
  - ⚠️ **It fails open:** a missing string, an unknown language or a failed table load gives
    English, never an error.
  - Each language's tables are cached for 60 seconds per instance, and a failed load is not
    cached. The language is in the URL, so the edge keys on it with no new `Vary`.
- **Admin** (behind `requireAuth`): `GET /api/translations/sources?locale&productId` (each
  English string and its state), `PUT /api/translations/batch` (through `saveTranslations`)
  and `POST /api/translations/duda/refresh`.
- **Quote matching** (`quoteProductMatcher()`) also recognises Duda's translated names, so
  baskets filled on `/ar/` keep their product pictures. A translated name is used only when it
  identifies exactly ONE product.
- **Tests:**
  - `npm run i18n:test` (also in pre-push) covers hashing, the pass-through rule, every
    validator rule, locale normalisation and the harvest parsers. The parsers run on a
    captured `/ar/` fixture in `backend/scripts/fixtures/`.
  - `smoke.mjs` checks `?lang=ar` live.

**Phase 3 — the mass translation (imported 2026-10-06):**
- **870 English strings × 6 languages = 5,220 `Translation` rows**, `origin MT`,
  `engine "claude-code"`, 0 rejected:
  - 90 descriptions
  - 333 list items
  - 139 spec labels
  - 288 spec values
  - 20 logo texts
- **Workflow:**
  - `npm run i18n:export-sources` writes the English to `migration/i18n/sources.json`
    (gitignored).
  - Claude Code translated it, one agent per language, into
    `migration/i18n/<locale>/part-NN.json` (`[{h, k, t}]`).
  - `npm run i18n:import -- --locale X` dry-runs every translation through the validator. With
    `--confirm` it saves through `saveTranslations()`.
  - The ENGLISH always comes from `sources.json`, never from the part files, so a translation
    can only attach to the text it was made for.
- ⚠️ **The validator cannot see a translation attached to the WRONG English** unless a number
  happens to differ. One agent found four of its own spec values paired with their neighbours'
  English, caught only because "460" went missing.
  - So every language also had a separate review pass, entry by entry, for mis-pairing, changed
    meaning and wrong language. It found **0 mis-pairings and 4 fixes**:
    - Arabic: a stray English "& Worklights"
    - German: "Emergency response units" had become "emergency vehicles"
    - Spanish: "Coil frost protection" had become battery frost protection
    - Spanish: an invented "A" (for height) in a HEPA filter size
  - **Repeat that review for any future bulk translation.**
- The translators kept every number as a digit. "3 Phase" written as "triphasé" or an Arabic
  dual drops the "3", and the validator refuses it. A few Arabic entries therefore read
  "مرحلتين (2)": deliberate, safe, and a native reviewer may want to polish them.
- **English source defects the translators flagged.** They are typos in the HUB content, worth
  fixing in the editor, and a fix needs no re-translation because translate-on-save picks it up:
  - spelling: "Made in Britan", "East fit", "retardent", "staps", "mutliple", "temerature",
    "powere", "sir supply", "aire powered", "ono the flange", "inclued"
  - a stray "n" in "inhalable n dust"
  - garbled words in the SA ENDURE High Capacity Dust Extraction description
  - a `<strong>` that opens mid-word: "range o<strong>f"
  - "2850 lumens (180°C)"
  - "30 Pa C"
  - "ATX | Ceag | Stahl"

**Phase 4 — translate-on-save (Chrome's on-device translator):**
- `frontend/src/lib/translator.ts` wraps Chrome's Translator API (Chrome 138+, Edge 148+,
  desktop only). `frontend/src/lib/translations.ts` is the ONE routine, `translateMissing()`,
  shared by the product editor and the Translations page. It fetches what is missing, translates
  it, and saves it as `MT`/`"chrome"`, every 25 strings.
- **The editor:** saving a changed description, specs, benefits or applications opens
  **"Saving for multi-languages…"** (`TranslationProgressModal`) after the English is saved, and
  translates that product's missing strings into all six languages.
  - "Skip for now" is always safe.
  - Any other browser gets a toast pointing at the Translations page.
- **Measured on Chrome 154 (2026-10-06), and each one shaped the code:**
  - ⚠️ **`Translator.create()` needs a user activation to download a pack, and Chrome downloads
    only ONE pack per click.** French downloaded; German and Spanish in the same click were
    refused (`NotAllowedError`). A pack already on the computer needs no click.
    - The translators therefore start synchronously inside the Save click (`startTranslators()`,
      before any `await`).
    - A refused language waits at **"needs-click"** with a **Download** button in the dialog.
      That click is the permission, and `retry()` must stay synchronous inside it.
    - This happens once per language, per computer.
  - ⚠️ **It translates brand names and re-cases marks.** Chinese turned "SA CYCLONE" into
    "SA 旋风", Arabic turned "Endure" into a verb, "SA FLEXIHEAT" came back as "SA FlexiHeat",
    and "99.98" as "99,98". The server rightly refuses each of these.
    - It ignores `translate="no"`: it translated inside the span and mangled the attribute.
    - Code-like placeholders survived in all six languages. So `protectTerms()` swaps every
      mark, code, brand and decimal for `X1Q`, `X2Q`… before translating, and swaps them back
      case-insensitively, since Portuguese returned "x1q". `restoreMarks()` re-cases anything
      left over.
    - ⚠️ Both skip "SA" and the shouted English the validator allows. Otherwise French "sa"
      becomes "SA" and French "air" becomes "AIR".
  - **It accepts HTML and keeps simple tags**, with better grammar than splitting the sentence
    (it translated "trolley" as "tram" without the rest of the sentence). But it rewrote
    `href="/product/x"` as `href="/ product/x"` and `&amp;` as "& amp;".
    - So `translateHtml()` sends each block whole, with attributes stripped and entities as
      plain characters.
    - It then restores exactly the English's attributes by element order.
    - It falls back to translating text node by text node if the tags changed.
  - **Result on a real sample (49 strings × 6 languages): 291/294 pass the server's validator.**
    The three refused are real omissions: Arabic dropped "zone 1 & 2", and Portuguese dropped a
    product name and a "2500". They stay English and show on the Translations page.
- **Translations page** (`/translations`, under Products in the sidebar):
  - Filters: language, type and status (Missing / Machine / Edited / Kept in English), plus a
    search over the English, the translation and product names.
  - Clicking a row edits it. The edit is saved as `STAFF`, so no machine run overwrites it, and
    an unsafe edit is refused with the reason.
  - **"Translate missing (N)"** runs the same Chrome routine for the whole site.
  - **CSV export and import** let a human translator work in a spreadsheet:
    - Only the Key and Translation columns are read; the English comes from the Hub.
    - ⚠️ Unchanged rows are skipped, or re-importing an untouched export would turn every
      machine translation into a staff one.
  - The **Names from Duda** tab (`GET /api/translations/duda`) shows Duda's copied names beside
    the English, flags any whose English changed since, and has "Refresh from Duda".
- `GET /api/translations/sources` also returns `products` (dudaId → name) for the "used on"
  column.
- **Tests:** `npm run i18n:test` covers masking, `restoreMarks` and `translateHtml` (via jsdom)
  against translators that keep the tags, behave like Chrome and drop every tag. All 90 real
  descriptions must pass the validator; this part is skipped in a clone without
  `sources.json`.
- **Not covered by translate-on-save:**
  - A description written in `/products/new`: it is translated the next time the product is
    saved, or by "Translate missing".
  - Logo text edited on the Logos page: use "Translate missing".

**What a translated page shows today:**
- Interface text, and Duda's product names and category titles, in the page's language.
- Descriptions, specs, benefits, applications and logo text, from the phase 3 import and from
  translation on save.
- Anything refused or not yet translated stays in English.
- A language appears on the site only when the client adds it in Duda; the Hub already holds
  all six.

## Category mode — the compatible carousel on static pages

The Industries pages are ordinary static pages, not dynamic category pages, so there is no
page context to resolve. The same carousel renders there from a **category** chosen in the
widget's content panel.

**One renderer, one item shape.** `compatibleSection()` is fed `{name, slug, url, imageUrl}`
by both sources, which is what makes the layouts identical by construction rather than by two
designs being kept in step. Only the `heading` differs, and it is a parameter.

⚠️ **The carousel builds its cards with `productCard()` — the SAME function the listing grid
uses** (2026-09-30). It previously had parallel markup and CSS for the same object, which is
how the button ended up uppercase in one and sentence case in the other. `.saeh-cp-card` now
carries ONLY the carousel's layout (`flex:0 0 100%;scroll-snap-align:start`, plus the
breakpoint `flex-basis` rules); every visual rule comes from `.saeh-pl-card`. **Anything
visual added back to `.saeh-cp-*` is a second copy waiting to drift** — `widget:test` asserts
no `.saeh-cp-name`/`-body`/`-shot`/`-btn` rule exists. The compatible payload has no
`categoryIds` or `certs`, and `productCard()` already omits both sections when they are
empty.

- `GET /public/products/by-category?category=<slug>` — the carousel payload. 404s an unknown
  category, which the widget treats as "nothing to show" and collapses; a content problem,
  not an error.
- ⚠️ **Matched on the MIRRORED slug, never derived.** Duda does not slugify titles the way
  you would guess — before the URLs were tidied it rendered "Oil & Gas" as `oil---gas`.
- ⚠️ **`singlePage` is the switch, NOT the presence of a category.** One left selected from
  earlier experimentation must not quietly take over a product page. Covered by `widget:test`.
- `POST /public/categories/options?parent=<slug>` feeds Duda's dynamic dropdown, so an
  Industries widget offers only industries. Its 30s cache is a `Map` **keyed by parent** — a
  single shared entry would serve the wrong branch for 30 seconds, a wrong answer
  indistinguishable from a right one in the editor.

### Shim

`data.config` carries `singlePage`, `productCategory` and `heading`; pass them as IIFE
parameters exactly as `section` is, and read the values RAW (see the content-panel warning
above).

## Tags — retired 2026-09-29

`Tag`, `TagGroup` and `ProductTag` are **gone**, along with `/tags`, `routes/tags.ts`,
`TagsSection`, `PUT /api/products/:id/tags`, `GET /public/products/by-tag` and
`POST /public/tags/options`. Nothing had been assigned (0 `ProductTag` rows), so the drop
migration lost no content.

Categories replaced them because Duda's navigation widget picks categories natively, they
nest, and they already carry SEO fields the Hub edits — so the client builds the megamenu
from a list instead of hand-typing URLs. Running both would have meant two vocabularies for
one job, two pickers in the editor and two places to look.

⚠️ **Anything in Duda still configured against a tag is broken** and must be re-pointed at a
category: the dropdown's Fetch URL becomes `/public/categories/options?parent=<slug>` and the
content-panel variable becomes `productCategory`.

## The tabbed accordion (`section: "tabs"`)

The product page's main widget: Overview / Technical Specs / Key Benefits / Applications.

- **One set of buttons serves both layouts.** DOM order is header,panel,header,panel… — accordion-native — and a `min-width:721px` media query uses flex `order` to lift the headers into a tab row above the panels. This avoids the usual trick of duplicating headers (a tablist for desktop plus per-panel headers for mobile), which ships every label twice to assistive tech and to search engines.
- ⚠️ **Disclosure semantics (`aria-expanded` + `aria-controls`), NOT `role="tab"`.** Tab roles promise keyboard and layout behaviour that would be a lie in accordion mode, and one element cannot honestly be both.
- **A panel with no content is never built, so its button never exists** — an empty tab is impossible rather than merely hidden. All four empty ⇒ returns null ⇒ the mount collapses.
- Content reuses the standalone designs exactly: `specsTable()` and `itemList()` were split out of `specsSection()`/`listSection()` so the tab bodies are the same markup minus the redundant `.saeh-h` heading.
- ⚠️ **The Overview panel is the ONLY place this widget renders HTML** rather than `textContent`, and it goes through **`safeProse()`** — an allowlist rebuild inside an inert `<template>`, never `innerHTML` (2026-10-02). The description is staff-authored and stored as written (the editor has an HTML tab), so a `<script>` typed there reaches the row intact.
  ⚠️ **This used to say `/public/products/content` sanitises it with `stripCruft`. It did not**: that was reverted in `886748c` because importing `sanitize-html` crashed the function, and the comment left behind said the *widget* escaped it — while the widget still used `innerHTML`. Each side claimed the other was the protection. It was latent only because nothing but the import's own clean output had ever been written there; making dashboard edits reach the page (see the product editor section) would have armed it. **The widget is now the boundary, so any other consumer of `descriptionHtml` must sanitise too.** `widget:test` covers script, `onerror`, inline handlers, `javascript:`/tab-obfuscated/`data:` links, iframe, svg-script and style; all 94 real descriptions render byte-identically through it.
  ⚠️ **Never import `services/descriptionHtml.ts` from server code** — it pulls in `sanitize-html`, which makes the WHOLE function fail at load on Vercel (`FUNCTION_INVOCATION_FAILED` on every route, the widget included) while running fine under tsx. It has happened twice: the second time (2026-10-02, ~3 minutes) via `stripAnchors`, which now lives alone in the import-free `services/anchors.ts`. **This is now checked automatically** — `scripts/check-api-bundle.mjs` fails the Vercel build (and the pre-push hook) if `sanitize-html` or `descriptionHtml.ts` enters the API's import graph, and the post-deploy smoke test hits the API and the widget. See "Deploy safety checks".

`npm run widget:test --workspace=backend` covers the widgets (515 checks as of 2026-10-06 — the resources list, its search, headings, the request form and the languages included), including the spec table's three row kinds and per-group striping, plus 32 behaviours of the accordion (tab set, empty-tab omission, switching, ARIA wiring, identity resolution order, editor placeholder, `clean()`, and that the legacy mounts and `"all"` still behave). `npm run widget:sync-css --workspace=backend` regenerates the dashboard's copy of the widget CSS — run it after ANY change to `injectStyles()`, because that copy has silently drifted twice.

## 3D Model Viewer

Each product may have one interactive `.glb` 3D model, uploaded per-product on the product editor (a `Model3DSection` in the unified save flow — see below), attached via `HubProduct.glbAssetId` → `MediaAsset` (kind `"model"`).

- **Storage**: `product-models` bucket, PUBLIC (unlike gated downloads, a 3D model is never gated — the live widget needs to load it unauthenticated). `backend/src/routes/media.ts` classifies an upload as kind `"model"` by its **`.glb` file extension** AND a claimed type in `ALLOWED_MODEL_MIME` (`model/gltf-binary` or `application/octet-stream` — browsers report GLB inconsistently), and the bucket's own allowlist enforces the same at upload. It used to go by extension alone with no bucket allowlist — see the storage note under "Live facts". Models get a higher upload size ceiling (50MB vs. 25MB for images/files) since textured GLBs can be large — **50MB, not the 150MB previously documented**: a bucket limit cannot exceed the Supabase project's global upload ceiling, which is 50MB, so 150MB was never actually achievable (see the storage section).
- **Admin write path**: `PUT /api/products/:id/model3d` body `{ mediaAssetId: string | null }` — validates the asset is kind `"model"`, sets/clears `HubProduct.glbAssetId`. Null clears it. Never touches the underlying `MediaAsset` (stays in the Media Centre, same pattern as Logos/Downloads). Included in `GET /api/products/:id/custom` as `model3d: {mediaAssetId, filename, url} | null`.
- **Media Centre delete-guard**: `media.ts`'s usage/reference checks also treat a `MediaAsset` referenced by `HubProduct.glbAssetId` as in-use (409 on delete), alongside Logo/Download.
- **Editor integration**: `model3d` is a full section in the unified save flow (`SectionKey`, `EditorSnapshot.model3d: Model3DDraft`, `project()` in `normalize.ts`) — **not** an immediate-apply pattern. Uploading/picking a file via `MediaPicker` (extended to accept `kind="model"`) stages the id into the draft; the actual PUT only fires on Save, like every other section. `Model3DSection.tsx` renders a live `<model-viewer>` preview (`Model3DPreview.tsx`, lazy-loads the `@google/model-viewer` web component from jsDelivr) so staff can confirm the right file was uploaded before saving.
- ⚠️ **The `model-viewer` script is pinned (`@4.3.1`) AND integrity-checked** (`MODEL_VIEWER_SRI`, sha384) — the only third-party script the widget puts on the live site. The pin stops an upgrade reaching visitors; the hash stops a compromised CDN serving other bytes under the same URL. A mismatch fails silently (no viewer), like a network error. **Change the version and the hash together**: `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.
- **Public rendering**: `GET /public/products/content` includes `model3dUrl: string | null` (a plain public URL — no signing needed, unlike gated downloads). The widget's `3d-viewer` section (`ALL_SECTIONS`/`VALID` in `widget.js`) lazy-loads the same `model-viewer` script only when a mount actually needs it, and renders a **generic, de-branded** viewer (rotate/zoom, auto-spin toggle, AR button, reset view) — deliberately stripped of the bespoke per-model hotspot callouts/exact camera framing from the one-off Claude-generated `lev-3d-viewer.html` reference snippet this feature was built from, since those numbers (exact hotspot 3D coordinates, body bounding box) are measurements unique to one specific model and don't generalize to an arbitrary future GLB upload. `model-viewer`'s own default auto-framing is used instead of custom camera math.

## Quote Requests / basket flow (separate from product-content widgets)

SAEquip has **no native pricing/checkout** for these products — instead there's a custom "request a quote" flow, built as **three separate Duda Widget Builder custom widgets** (edited directly in Duda's Widget Builder UI, NOT in this repo):
- **"SAEquip - Add to Quote"** — per-product button, reads selected variation options + product SSR data off the page, writes to a shared client-side store (`window.SAEquipQuote`, localStorage-backed).
- **"SAEquip - Quote Basket Header"** — site-header count + hover mini-cart, reads the same store.
- **"SAEquip - Basket Page"** — full basket list + the quote request form. On submit, POSTs JSON to this backend's `POST /public/quotes` (replaced the old `quote-mailer.php` on a separate PHP/Plesk host — same request/response contract `{ok:true}`/`{ok:false,error}` so the widget JS didn't need a rewrite, just its `ENDPOINT` constant updated). On success it clears the basket and shows an **in-page thank-you** with "Retrieve Basket" (restores the submitted items) and "Back to Home". (This line used to say it redirected to a Thank You page; the widget code — copied into `3-widgets-in-duda.md` — shows otherwise.)

⚠️ **The basket form collects what the WordPress quote form did** (2026-10-02): First Name, Last Name, Company Name, Email, Telephone (all required — WordPress's set), then When do you need this equipment? (Urgently / Within the next week / … / Pricing exercise only / Unsure — WordPress's own options), Address, Country (WooCommerce's 250 names) and Postcode, all optional, plus Message. `POST /public/quotes` accepts BOTH that and the earlier single-`name` form — the widget is pasted into Duda by hand, so the backend had to accept the new shape before the widget sent it, and keep the old one working during the changeover. The current form is recognised by the split name, and only then are company and telephone required. `QuoteRequest.name` is still written ("First Last") so older readers keep working. The basket widget sends `elapsedMs` and the `website` honeypot (confirmed in its code), so requiring both server-side is now possible.

**Each basket line is matched to its catalogue product** (`services/quoteProducts.ts`) for a picture and a link to the product editor on `/quotes`. The widget sends only name and SKU, so the match is by NAME (Duda refuses duplicate titles, case-insensitively) with SKU only as a fallback when exactly one product carries it — 4 SKUs are shared. The product id and thumbnail are SNAPSHOTTED onto `QuoteRequestItem` when the quote arrives, with no foreign key, so a quote keeps its picture after a rename or delete; quotes from before that are matched when shown. A failed lookup never costs the customer the quote. There is no price column: SAEquip quotes prices, so the basket never carries one.

⚠️ **A dashboard tab left open across a deploy keeps running the OLD code** until it is refreshed — the new quote fields "not showing" on 2026-10-02 was exactly that (they were stored correctly).

⚠️ **The `/quotes` CSV export guards against formula injection** — every cell is typed by the public, and a "name" of `=HYPERLINK(…)` would have run when staff opened the file. It had no guard until 2026-10-02 (the products export did).

Backend side (`backend/src/routes/quotes.ts`, `backend/src/services/email.ts`): stores every submission (`QuoteRequest`/`QuoteRequestItem`) regardless of email config, so nothing is ever lost. Email notification via Resend is **fully optional** — `isEmailConfigured()` requires all three of `RESEND_API_KEY`, `QUOTE_NOTIFY_FROM`, `QUOTE_NOTIFY_TO`.

⚠️ **Resend is NOT being set up** (decided 2026-09-30). These will feed SAEquip's own CRM at a later date, so `/quotes` shows **no email banner, badge or column**: `emailSent` is `false` on every row, and a column of "No" reads as a fault rather than a setting nobody chose. The *backend* email path is left in place and inert — it costs nothing and stays ready if the CRM work ever wants it. **The mail code is not what protects the data**: storage happens before and independently of any send, which is what makes leaving email off safe. A send failure never blocks/fails the visitor's submission. Honeypot (`website` field) and a bot-timing check (`elapsedMs < 1500ms`) are checked before validation, matching the legacy script's anti-spam behavior.

## Quote-request abuse surface (audited 2026-09-10)

`POST /public/quotes` is one of only two unauthenticated endpoints that WRITE (the other is the download lead form; the rest of `/public/*` is read-only). What holds, and what does not:

**Holds**
- Every string is `.max()`-bounded; `items` caps at 100. Prisma parameterises, so no SQL injection. The notification is `text:` only, so no HTML injection into the email, and `/quotes` renders as text, so no stored XSS into the dashboard.
- Storage happens **before and independently of** email, and a send failure is caught — a broken mailer cannot lose a submission. Verified at the time: 7 stored requests, all `emailSent: false`, none lost. (Those 7 were later lost in the 2026-09-29 database wipe — see "Prisma migrations" — which is a backups problem, not a mailer one.)
- Both form-post limiters are **Postgres-backed** (see the note in `public.ts`). Measured before: 30 concurrent posts let **12** through a nominal 10/min, because more than one serverless instance served the burst. After: 9. A second **hourly** cap (30) catches the slow drip a per-minute window is blind to.
- `options` is a bounded flat map (string keys, scalar values, ≤40 pairs). It was `z.any()` — unbounded JSON into a JSON column, ×100 items.
- `name`/`company`/`phone` are stripped of CR/LF and control characters, so switching the mailer to SMTP cannot reintroduce header injection.

**Does NOT hold — know these**
- ⚠️ **The `elapsedMs` timing check is skipped when the field is ABSENT.** `Number(undefined)` is `NaN`, `Number.isFinite(NaN)` is false, so the guard passes. It only catches a bot that bothers to send a small value. Making it required would need confirmation that the live basket widget sends it — the widget lives in Duda, not this repo.
- ⚠️ **The honeypot only catches bots that fill it in.** A cheap filter, not a control.
- ⚠️ **Origin filtering is bypassed by omitting the header.** `publicCors` 403s a *disallowed* Origin, but the check is `if (origin && …)` — no Origin at all skips it, which is the default for curl and every non-browser client. It stops a malicious website posting on a visitor's behalf; it is no barrier to a script.
- ⚠️ **Rate limits are IP-keyed**, so a distributed source defeats them. **Vercel Firewall** rate-limit rules run before the function is invoked and are the right layer for that; application code cannot solve it.
- **No CAPTCHA and no duplicate detection.** The same person can submit the same basket repeatedly.

**If spam becomes real**, in order of effort: a Vercel Firewall rule per IP; then requiring `elapsedMs` and the honeypot field to be *present* (needs the widget confirmed); then Turnstile/hCaptcha in the basket widget, which is the only one that actually distinguishes a human.

## Duda REST API

Base URL `https://api.duda.co/api`, HTTP Basic auth (`DUDA_API_USER`/`DUDA_API_PASS`). SAEquip's `site_name` is **`8a8f03b5`**, live on **`saequip.multiscreensite.com`** — see "Site migration" below; the former `099434f3` is retired and nothing should read from it. **Path pattern includes a `multiscreen` segment that's easy to miss** — omitting it 404s (`RESTEASY003210`): `/sites/multiscreen/{site}/ecommerce/store`, `.../ecommerce/products`, `.../ecommerce/products/{id}` (see `backend/src/services/duda.ts`). Duda's product `custom_fields` are deliberately unused (see the Duda-vs-Hub split above) — don't reintroduce writes to them.

### Site migration: `099434f3` → `8a8f03b5` (2026-09-07)

The Hub now reads and writes **only** `8a8f03b5`. The old site is retired; `GRANTABLE_SITES` in `dudaEditorProvision.ts` no longer allows it, and editor access on it was revoked.

⚠️ **The DOMAIN moved with the migration, and this is a trap.** `saequip.multiscreensite.com` originally belonged to `099434f3`. After the cutover the new site was renamed in Duda from `saequip-2` to `saequip` and republished, so **`saequip.multiscreensite.com` now serves `8a8f03b5`** and the retired site sits on `saequip-3.undefined`, unpublished. Confirmed against the API (`GET /sites/multiscreen/{site}` → `site_default_domain`):

| Duda site | Domain | Status |
|---|---|---|
| **`8a8f03b5`** (live, `DUDA_SITE_NAME`) | **`saequip.multiscreensite.com`** | PUBLISHED |
| `099434f3` (retired) | `saequip-3.undefined` | UNPUBLISHED |

**Never infer the domain from the site id, or vice versa** — this doc previously claimed `8a8f03b5` was `saequip-2.multiscreensite.com`, which was true only at creation. Acting on that stale pairing produced a recommendation to drop `saequip.multiscreensite.com` from `WIDGET_ALLOWED_ORIGINS`, which would have broken the live widget on every product page. Ask the API.

**The thing that made this cheap: `8a8f03b5` was DUPLICATED from `099434f3`, so product ids carried over byte-identically** — same `dudaProductId` (`01KW9R473XZGWZWC5206EPYAWB`), same SKU, same slug, same option ids. Products are normally per-site in Duda, so the obvious expectation was that every `HubProduct` row (keyed on `dudaProductId`) would need re-keying to new ids; **it didn't**, and the existing row kept its attached 3D model. Verify before assuming this holds for any *future* site move — a site created fresh rather than duplicated would genuinely need re-keying. **Variation ids DO differ** between the sites, but nothing persists those.

Changing sites means `DUDA_SITE_NAME` in env (default in `backend/src/env.ts`) plus `WIDGET_ALLOWED_ORIGINS` gaining the new domain — and both must be set in the Vercel project's environment variables, not just locally. Everything configured *inside* Duda is per-site and does **not** carry over even in a duplicate: widget embeds on the product template, the `.productDescription` Head-HTML CSS, and the three quote/basket Widget Builder widgets all need re-doing on the new site.

### Verified write surface + behaviours (probed live, 2026-07-27/28)

Run `npm run duda:spike-options -- --confirm` to re-derive any of this; `npm run --silent duda:snapshot -- <productId>` dumps a product read-only for a pre-write backup.

- **Options are STORE-LEVEL / shared across the whole catalog**, not per-product: `GET|POST /ecommerce/options`, `GET|PUT|DELETE /ecommerce/options/{id}`, `POST /ecommerce/options/{id}/choices`, `DELETE .../choices/{choiceId}`. Create body is `{name, type:"TEXT"|"COLOR", choices:[string]}` with no product id.
- **A product CAN expose a subset of a shared option's choices**, via `PATCH /products/{id}` with `options: [{id, choices:[{id}]}]`. Adding a choice to a catalog option does **not** propagate to products already using it. Caveat: the product page's "+ value" auto-selects the new value for that product, so saving afterwards *does* grow its variation set. Any check gating a choice delete must use a **fresh** usage sweep (`getOptionUsage({ fresh: true })`), since a page-load snapshot goes stale the moment a product saves.
- **Variations are auto-generated as the cartesian product** of the attached choices. There is no variations collection endpoint (`/variations` 400s); only `PATCH /products/{id}/variations/{vid}` for `sku`/`price_difference`/`quantity`/`status`/`images`. Regeneration is synchronous. **Variation array order is not stable — never rely on index.**
- **Deleting an in-use option or value requires orchestration, and IS possible.** The API refuses directly (`"Can't remove choice that is connected to variations"`) but Duda's own admin UI allows it behind a warning, because it detaches from the affected products first. `backend/src/services/optionCascade.ts` does the same — and better, since it routes the detach through `updateOptionsPreservingVariations()` so SKUs on surviving combinations are kept. Routes take `?force=true` (values) / `?confirm=true` (options); without it they 409 with the affected-product count so the UI can warn. Don't conclude from the bare 400 that the operation is impossible.
- **An option must always keep ≥1 value** — `"Option should have at least 1 choices"`. Deleting the last value means deleting the option.
- ⚠️ **Changing a product's own attached option set DESTROYS all variation data.** Duda regenerates every variation with new ids and blanks each `sku` (to `null`) and `price_difference` (to `"0.0"`) — including for combinations that still exist. `backend/src/services/productOptions.ts` works around this by snapshotting the data and re-applying it after the change, reporting what was restored vs genuinely dropped. **Never call `duda.updateProductOptions()` directly from a route** — go through `updateOptionsPreservingVariations()`. (An early probe wrongly suggested VARIATION ids were stable; it only changed the shared *catalog* while the product kept its subset, so nothing regenerated. Variation ids are NOT stable; choice ids are — see below.)
  ⚠️ **Old and new variations are matched by projecting both onto the options present BEFORE AND AFTER, by choice ID, and data moves only one-to-one** (2026-10-02). It used to compare whole combinations, so **detaching or attaching a ONE-value option lost every SKU** although `a1+b1 → a1` is unambiguous — measured on throwaways. Anything ambiguous is dropped and reported, never guessed: attaching a two-value option turns `a1` into `a1+d1` and `a1+d2` (copying would mint duplicate SKUs), and detaching one merges several variations into one. Choice ids on a variation are the catalogue's ids and survive regeneration (verified). Duda also refuses two options with the same name ("Option name should be unique per catalog").
  ⚠️ **A restore that FAILS is now reported** — the editor used to read only `restored`/`dropped` and ignore `failed`, so a blanked SKU read as success. **The store-wide cascades** (`optionCascade.ts`) catch per product: one failure no longer throws away the report for the products already rewritten, and the catalogue entry is KEPT (502 with `catalogDeleted: false`) rather than deleted half-way. Their success toasts now say when combinations lost data — they used to report only "updated N products". **`PUT /api/options/:id` keeps the current type when none is sent**; it defaulted to TEXT, which would have turned a COLOR option into a TEXT one on rename.
- **`options` comes back as `null`, not `[]`,** for a product with none attached — brand-new products included. `normalizeProduct()` in `services/duda.ts` coerces this (and the other collections) at the boundary; without it, opening a newly-created product crashes on `product.options.length`.
- `sku` on a freshly generated variation is `null`, not `""`.
- **Images**: `PATCH /products/{id}` with `images` re-hosts any publicly-reachable URL onto Duda's CDN (`irp.cdn-website.com`), so `/sites/multiscreen/resources/{site}/upload` is unnecessary. Already-hosted URLs come back byte-identical across repeat PATCHes. The array is **full replacement** and `images[0]` is the thumbnail.
- **All product array fields are full replacement** ("must pass all data when making any changes to this property"). `services/duda.ts` therefore keeps `images`/`options`/`variations` out of `DudaProductUpdate` and gives each its own explicit method, so a scalar edit can never wipe a collection.
- Create/delete: `POST /ecommerce/products` (minimum `{name, prices:[{price}]}`; `seo.product_url` is auto-slugged from the name) and `DELETE /ecommerce/products/{id}`.
- ⚠️ **A catalogue enforces TWO case-insensitive uniqueness rules on products**, both discovered during the WordPress import: the **slug** (`400 {"message":"Duplicate product url …"}`) *and* the **title** (`400 {"message":"Products in catalog can't have duplicate titles"}`). So two products whose names differ only in case — "Compact Filtration Unit" vs "COMPACT FILTRATION UNIT" — genuinely cannot coexist; one must be renamed. `DudaProductCreate` has no `seo` field either, so the slug can't be pre-set at create time to dodge the first error. The workaround that does *not* work: creating under a suffixed name and then PATCHing the real title back with an explicit unique `seo.product_url` — that trips the title rule and leaves an orphan product behind.
- **Categories** live at `/ecommerce/categories` (GET, POST) and `/ecommerce/categories/{id}` (GET, PATCH, DELETE). They come back **FLAT with a `parent_id`** — the tree is derived, not nested — and top-level rows use the sentinel string `"ROOT"`, not null. The list shape is only `{id, title, parent_id, products_count}`; `description`, `image` and `seo` come from the single-category GET. `backend/src/routes/categories.ts` derives depth/ordering server-side so every consumer agrees, and guards against re-parenting a category under its own descendant.
- ⚠️ **A category's `seo` is FULL REPLACEMENT on PATCH**, exactly like a product's. PATCHing `seo` without `url` blanks the page URL and Duda rejects with `"Category page url cannot be blank"`. The categories route merges the incoming `seo` over the current value so partial edits work.
- `GET /products?category_id=…` appears to **ignore the filter** (it returned a product whose `categories` array is empty). Don't rely on it for category membership.
- `quantity` is **write-only** — accepted on PATCH, never returned on read.
- **`GET /products` clamps `limit` to 200** regardless of what you ask for, so paging is required now `max_products` is 1000 (`duda.listAllProducts()`).
- Store limits live at `GET /ecommerce/store` → currently `max_products:1000, max_variations_per_product:300, max_options:20, max_choices_per_option:50`. **`max_options:20` is per-CATALOG and did NOT rise with the plan upgrade — it will be the binding constraint once options roll out across the catalogue** (1 of 20 used today: Hire/Purchase, on EX Heater only).

## Website Editor — Duda editor SSO (security-sensitive)

The `/website` page (top of the sidebar) lets a staff member SSO straight into the Duda **editor** for the live site. An SSO link **is a bearer credential** — whoever holds the URL becomes that Duda account — so the design is built around that:

- **Only client accounts, never the agency account.** The API credentials belong to the agency-level partner account (`sharon@kangaroouk.com`), whose dashboard spans **~871 sites** across all Kangaroo clients. SSO'ing as that account would be a catastrophic blast radius. Each staff member gets their own Duda **customer** account granted access to one site.
- **The DB mapping IS the authorization.** `requireAuth` only proves "valid Supabase token + allowed email domain", and `ALLOWED_EMAIL_DOMAINS` spans both kangaroouk.com and saequip.com — far too coarse to gate credential minting. `DudaEditorAccount` (staff→Duda account, keyed on Supabase `staffUserId`) + `DudaEditorSiteAccess` (per-user, per-site allowlist) decide access. No row → 403. Fail closed; never fall back to a shared account.
- **Three things the client must never control**: `account_name` (derived server-side from the verified JWT), `target` (hardcoded `EDITOR` in `services/dudaSso.ts` — the API also accepts `RESET_SITE`/`RESET_BASIC`/`SWITCH_TEMPLATE`, so a client-supplied target would be a site-wipe vector), and the site (validated against that user's allowlist). The zod body schema is `.strict()`, so smuggled `accountName`/`target` keys are rejected outright, not ignored.
- ⚠️ **Never `next(err)` a Duda error from the SSO route.** The shared error handler in `index.ts` echoes `DudaApiError.body.slice(0, 500)` to the caller and `console.error`s the whole object — and a Duda SSO response body contains a **live one-time login token**. `routes/websiteEditor.ts` catches `DudaApiError` locally and logs the status only. Same reason there is no url/token column on `DudaSsoAudit`.
- **Rate limited per user, not per IP** — a per-person budget is the right shape for credential minting, and it avoids depending on proxy headers at all. The limiter uses `keyGenerator: req => req.user?.id` and a **Postgres-backed store**, because an in-memory counter gives each serverless instance its own budget (see the Vercel section).
- ⚠️ **A staff member who is already a Duda STAFF user needs a SEPARATELY NAMED customer account.** Duda refuses a per-site grant to a non-customer account — `400 InvalidInput "Only customers may be granted access to specific sites"` — because a STAFF account sits under the agency partner account and already reaches the whole ~871-site portfolio, so an SSO link for it would not be scoped to one site at all. `josh@kangaroouk.com` is `account_type: STAFF`, so its editor access uses the customer account **`josh+saequip@kangaroouk.com`** (plus-addressing delivers to the same mailbox). Pass `--duda-account <name>`; the script now refuses any non-CUSTOMER account with that explanation rather than letting Duda's 400 through.

  This is why `DudaEditorAccount` has separate `staffEmail` and `dudaAccountName` columns. ⚠️ **Anything looking a mapping up must query `staffEmail`, and anything calling Duda must use `dudaAccountName`.** `--check` and `--revoke` both got this wrong: they queried `dudaAccountName` with the login address, so `--check` reported "no access" for a fully granted account, and **`--revoke` would have asked Duda about an account that never held the grant, taken `ResourceNotExist` as "nothing to revoke", and deleted the Hub mapping while the real customer account kept all 11 permissions on the live site** — the same silent-revoke failure recorded below, reached through a different door.

- **Provisioning is CLI-only, deliberately.** Creating Duda accounts and granting permissions are the privilege-escalating operations; as an HTTP route, any allowed-domain session could self-provision. Use `npm run duda:editor-provision --workspace=backend -- --email <staff> --supabase-user-id <uuid> --confirm` (also `--check` read-only, and `--revoke`). `GRANTABLE_SITES` in that script hard-limits which sites can be granted — the retired `099434f3` is deliberately absent. The allowlist check runs **after** the revoke branch on purpose: a retired site is exactly when you still need to take access away.
- ⚠️ **`--check` takes `--duda-account` too, and it matters MOST when there is no mapping** —
  which is exactly when you are asking whether Duda still holds a grant the Hub has lost.
  Without it the check falls back to the LOGIN address, and Duda answers "does not have
  access" for a staff login whatever the customer account holds. That is the **third** door
  onto the same wrong answer this script has produced before, and it was live: after the
  2026-09-29 database wipe the first check reported no access while
  `josh+saequip@kangaroouk.com` still held all 11 permissions. The account actually queried
  is now always printed.
- ⚠️ **Wiping the Hub's DB does NOT revoke anything on Duda.** The mapping rows are the
  Hub's authorization, not Duda's: after the wipe `/website` 403'd while the grant was
  untouched on Duda's side. Restoring was re-running `duda:editor-provision --confirm` — no
  Duda change needed, and `update_site_permissions` being full replacement makes the
  re-grant idempotent. The mirror of the offboarding trap below: deleting rows here leaves
  editor access alive.
- ⚠️ **A revoke must be verified, never assumed.** Revoke is `DELETE .../permissions`; the plausible-looking `DELETE /accounts/{name}/sites/{site}` 404s. The script originally logged a 404 as "may already be revoked", so a wrong path printed a success tick while the account kept all 11 permissions on the site — caught only by asking Duda directly. It now hard-fails on any 404 that isn't an explicit `ResourceNotExist`, then re-reads the permissions to confirm the grant is actually gone.

### Verified account-scoped Duda paths (probed live, `npm run duda:probe-sso`)

| Path | Status |
|---|---|
| `GET /accounts/{name}` | ✅ works |
| `GET /accounts/sso/{name}/link?target=EDITOR&site_name={site}` | ✅ works — returns `{url}` |
| `GET\|POST\|PUT\|DELETE /accounts/{name}/sites/{site}/permissions` | ✅ works — grant, read, replace **and revoke** all on this one path |
| `DELETE /accounts/{name}/sites/{site}` | ❌ **404 `RESTEASY003210`** — no such route (see the revoke trap below) |
| `GET /sites/multiscreen/{site}` | ✅ works — site metadata for the page |
| `GET /accounts/{name}/sites` | ❌ **404 `RESTEASY003210`** — no such route; ask per-site instead |

### Permission set (least privilege)

Granted: `EDIT`, `ADD_FLEX`, `LIMITED_EDITING`, `PUBLISH`, `REPUBLISH`, `BLOG`, `SEO`, `SEO_OVERVIEW`, `STATS_TAB`, `SITE_COMMENTS`, `CONTENT_LIBRARY`.

Withheld on purpose: **`E_COMMERCE`** (product editing stays in the Hub — a second source of truth would hit the no-optimistic-concurrency stale-overwrite problem), **`DEV_MODE`** (arbitrary JS injection into a live page; also how the widget embeds are managed, so Kangaroo keeps it), **`RESET`** (wipes the site), `CUSTOM_DOMAIN`, `BACKUPS`, `USE_APP`, `CLIENT_MANAGE_FREE_APPS`, `MANAGE_CONNECTED_DATA`, `EDIT_CONNECTED_DATA`, `CONTENT_LIBRARY_EXTERNAL_DATA_SYNC`, `INSITE`, `AI_ASSISTANT`. Duda requires `PUBLISH` to travel with `REPUBLISH` + `LIMITED_EDITING`; `update_site_permissions` is **full replacement**.

### Two limits to remember

- **The Duda session outlives the Hub session.** Once SSO'd, the user holds an independent Duda cookie; signing out of the Hub does not end it. This is why the permission set matters more than session hygiene.
- **Offboarding is NOT automatic.** Deleting a Supabase user does *not* revoke Duda access — run `duda:editor-provision -- --email <staff> --revoke --confirm`, or you get orphaned editor access outliving the Hub account.

## Users, password resets and 2FA

### Accounts

- **Public signup is disabled**; `ALLOWED_EMAIL_DOMAINS` gates who can sign in at all (`requireAuth`).
- ⚠️ **There is NO role model.** Every authenticated user has identical access — any signed-in user can edit any product. "Admin account" currently means nothing more than "an account". The `/users` page says so rather than implying a hierarchy that doesn't exist. Adding roles is unbuilt work.
- ⚠️ **`auth.admin.listUsers()` does NOT return `factors`** — the key is absent from every row, not merely empty. Only `getUserById()` includes them, and the difference is silent: it reads as "nobody has MFA". It made the Users page show Two-factor **Off** for an account with a verified TOTP factor, `users:create --check` report "not enrolled", and — the dangerous one — **`users:mfa` would have told an admin there were no factors to delete, for the one person who cannot get in without that reset.** Everything that needs factors now goes through `services/supabaseUsers.ts` (`listUsersWithFactors`, `findUserWithFactors`, `hasVerifiedFactor`), which re-fetches each user. That is an N+1, accepted deliberately: the staff list is a handful of people, the calls run in parallel, and the alternative is a page that lies about a security control.
- **`/users` is READ-ONLY** apart from triggering a reset email: `GET /api/users` (`listUsersWithFactors`, filtered to allowed domains, joined against `DudaEditorAccount`) and `POST /api/users/password-reset`.
- ⚠️ **Account creation is CLI-only, deliberately** — same reasoning as `duda:editor-provision`. `requireAuth` proves only "valid token + allowed domain", and that domain list spans two companies, so an HTTP route would let any signed-in session mint itself more accounts or delete a colleague's:

  ```
  npm run users:create --workspace=backend -- --email <addr> --check
  npm run users:create --workspace=backend -- --email <addr> --confirm
  npm run users:create --workspace=backend -- --email <addr> --reset --confirm
  ```

  ⚠️ **The password is read from a hidden prompt or `STAFF_PASSWORD`, never a flag.** Argv is readable by every process via `ps` and lands in shell history. The script also **refuses weak passwords** (min 12 chars, mixed case, digit, symbol, and it rejects the word-plus-digits shape) unless `--force`.

- ⚠️ **`POST /api/users/password-reset` must never return the link.** It uses `resetPasswordForEmail`, which mails the token; `generateLink` would hand a live recovery credential back to the caller — the same class of mistake as echoing a Duda SSO URL. Rate limited 10/hour **per authenticated user** via the Postgres store, because in-memory counters are per-instance on serverless.

### Password reset (app side — built)

`/forgot-password` → `supabase.auth.resetPasswordForEmail`, and `/reset-password` handles the emailed link. Both are outside the auth guard on purpose; `/reset-password` only works while the recovery link's short-lived session exists, and **signs the user out afterwards** so they make one clean sign-in with the new credential (and, once MFA is on, go through the second factor rather than riding a session that skipped it). The request page **always reports success**, so it can't be used as a membership oracle for the staff directory. `frontend/src/lib/passwordPolicy.ts` mirrors the CLI's rules — a UX aid, not the enforcement point.

### ⚠️ Supabase dashboard settings — REQUIRED, and not code

None of the above is secure until these are set, and none of them can be done from this repo:

1. **Custom SMTP** (Authentication → Emails). Supabase's built-in sender is capped at a handful of emails per hour and is explicitly not for production — without it, reset emails silently don't arrive.
2. **Leaked-password protection** and a **minimum length of 12+** (Authentication → Policies). This is the real enforcement point; the client-side checks are cosmetic.
3. **Enable MFA / TOTP** (Authentication → Multi-Factor). Nothing in the app can enrol a factor until this is on.
4. **Reduce the access-token TTL** from the default hour if the threat model warrants it, and keep refresh-token rotation on.
5. ⚠️ **Site URL and the redirect allowlist** (Authentication → URL Configuration). Both matter, and getting them wrong fails *silently*:
   - **Site URL** must be the deployed origin (`https://sa-equip-backend.vercel.app`), not the `http://localhost:3000` default. Supabase discards a `redirectTo` it cannot use and falls back to the Site URL — observed symptom: a reset link landing on `http://localhost:3000/#access_token=…`.
   - **Redirect URLs** must include `https://sa-equip-backend.vercel.app/reset-password` (add `http://localhost:5173/reset-password` for local work). A `redirectTo` outside the allowlist is not an error; it is ignored.

   Two related traps, both fixed in code but worth knowing: `POST /api/users/password-reset` used to interpolate the `Origin` header unchecked, so a request without one produced the *relative* `/reset-password` — unusable, hence the Site URL fallback. It now builds `redirectTo` only from THIS dashboard's own origin and otherwise omits it (see "Verified live" below). And `/reset-password` needs `onAuthStateChange` as well as `getSession()`, because the recovery token arrives in the URL **fragment** and is exchanged asynchronously — a lone `getSession()` races that and reports "link expired" on a good link.

   ⚠️ **A recovery link is effectively a one-time login**: whoever opens it holds a real session. That is why it must land on `/reset-password`, which changes the password and then signs out, rather than on the app root where the holder is simply logged in.

### 2FA (TOTP) — built 2026-09-10

Four parts, and the last is the one that makes it real:

1. **`/security`** — the signed-in user enrols their own authenticator (`mfa.enroll` → QR + secret → `mfa.challenge` → `mfa.verify`). Enrolment can only happen in the browser against that user's session: there is no admin API to enrol on someone's behalf, and there shouldn't be, since the secret must reach their app and nobody else's. Cancelling mid-enrolment unenrols the half-finished factor.
2. **Login challenge** — `signIn()` returns `mfaRequired` by reading `mfa.getAuthenticatorAssuranceLevel()` (`nextLevel === "aal2"` only when a verified factor exists), and `Login.tsx` collects the code. ⚠️ The `if (user) <Navigate to="/">` guard is suppressed while the code is outstanding: the password step already creates a real session, so the redirect would otherwise fire and skip the challenge.
3. **`mfa_required` handling** — `apiJson` signs out and returns to `/login` on that response, because every request will fail identically until a code is entered.
4. ⚠️ **Server-side enforcement in `requireAuth`** — a user with a **verified** factor must present an `aal2` token, or the API returns `403 mfa_required`. Supabase challenges factors entirely in the browser and an unchallenged session still carries a valid `aal1` token, so **without this check 2FA is decorative** — a caller could enrol, ignore the prompt and keep using the API. `getUser()` validates the token but does not expose `aal`, so it is read from the already-verified JWT payload; `assuranceLevel()` decodes without verifying and is only safe because verification has already happened. Never point it at an unvalidated token.

**Opt-in per user, deliberately.** Only an enrolled *and verified* factor raises the bar, so this cannot lock out staff who haven't set MFA up. An `unverified` factor is ignored — enrolment leaves one behind until the first code is confirmed, and honouring it would lock the user out mid-enrolment. Requiring MFA for everyone would be a separate, announced change.

⚠️ **The lockout escape hatch is CLI-only**: `npm run users:mfa --workspace=backend -- --email <addr> --check | --reset --confirm`. There is no bypass code, because a bypass is a second password. This is the most privilege-escalating operation in the repo — it removes a security control from someone else's account — so it must never become an HTTP route, and the request should be confirmed out-of-band. Encourage a second enrolled device instead.

**Dashboard prerequisite**: MFA/TOTP must be enabled under Authentication → Multi-Factor, or `mfa.enroll()` fails.

### Verified live (2026-10-02, throwaway accounts, all deleted)

- **Public signup is OFF**: `signUp` with the anon key for an allowed-domain address →
  "Signups not allowed for this instance". If this ever changes, any outsider could
  register `anything@saequip.com` and get full access — there is no role model behind it.
- **2FA is enforced server-side, end to end**: an account with a verified TOTP factor gets
  `403 mfa_required` for a fresh password-only (`aal1`) session and `200` for `aal2`, and
  `auth.getUser(token)` — what `requireAuth` reads — DOES carry `factors` (unlike
  `admin.listUsers()`). The test computes real TOTP codes, so re-running it is cheap.
- **Revocation is immediate**: after a global sign-out, or deleting the user, their still-unexpired
  access token is refused at once — `getUser` checks the session, not just the signature.
- **Outsiders and look-alikes are refused** (`@example.com`, `@evil-saequip.com` → 403).
- Every `/api/*` route answers 401 to a forged token; nothing admin is mounted outside the
  authenticated router.

⚠️ **The reset link's return address is built only from THIS dashboard's origin** (or localhost
in development). `POST /api/users/password-reset` used to accept any well-formed `Origin`, so
the only thing keeping `https://evil.example/reset-password` out of a colleague's reset email
was Supabase's redirect allowlist — one wildcard there would hand a live recovery link to the
owner of that page. The allowlist remains the second check. On Vercel the request host is
read from `Host` and the proxy-set `X-Forwarded-Host`; anywhere else only `Host`. ⚠️ Not
exercised live (it would send a real email): **confirm once that a reset sent from `/users`
lands on `/reset-password`**, not the site root.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full annotated list. Highlights:
- Backend **requires**: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL_DOMAINS`, `DUDA_API_USER`, `DUDA_API_PASS`. `WIDGET_ALLOWED_ORIGINS` must include every domain allowed to call `/public/*` (Duda domains + the frontend origin + localhost for dev) — CORS rejects anything not listed, no trailing slashes.
- Backend **optional**: `RESEND_API_KEY` + `QUOTE_NOTIFY_FROM` + `QUOTE_NOTIFY_TO` (all-or-nothing for email).
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. ⚠️ **`VITE_API_BASE_URL` must stay UNSET in production** — that is what makes the API resolve same-origin. It only falls back to `http://localhost:4000` under `import.meta.env.DEV`. Setting it in Vercel silently points the dashboard elsewhere. (Any `VITE_*` value is baked in at build time, so a change needs a redeploy, not a restart.)

## The product editor (unified save)

`frontend/src/pages/ProductDetail.tsx` is a full two-way editor: title, SKU, type, status, stock, price, SEO, description, images, the 3D model, plus all other Hub content. `frontend/src/components/product/` holds the machinery:

- **Options & variations**: `OptionsSection` handles per-product attach/detach and choice selection (safe — can't affect another product); `VariationsSection` annotates the generated rows and **locks while Options are dirty**, because option ids regenerate on save so anything typed first would target dead ids. `VariationCountMeter` shows current → projected against `max_variations_per_product` and blocks over it client-side. Catalog creation is kept out of the unified save (`POST /ecommerce/options` isn't idempotent — a retried save would duplicate options and eat the 20-slot cap).
- **`useProductEditor.ts`** owns two copies of one `EditorSnapshot` — `baseline` (last server-confirmed truth) and `draft` — loaded in one `Promise.all`. Every section is a controlled component; there are **no per-section Save buttons**, just `ProductSaveBar`.
- **Dirty detection** (`normalize.ts` `project()`) strips cosmetic row ids before comparing. New rows use `crypto.randomUUID()` with no server counterpart, so comparing ids directly would report a section dirty forever after a save. Logo ids compare sorted so toggle order isn't a change. **If you add a slice, add it to `project()` or it will never look dirty.**
- **Save builds its task list from the dirty map only.** Never PUT a clean section: specs/benefits/applications are delete-all-then-recreate, so a no-op PUT is a real destructive round-trip against live data. Tasks run sequentially and each banks its confirmed slice into *both* baseline and draft, so earlier work survives a later failure; failures are per-section and leave that section dirty (keeping the guard armed). Retrying the same save converges, because every sub-operation is a full replacement or idempotent.
- **`seo` is sent whole** whenever any sub-field changed — dropping `seo.product_url` would break the public widget's slug detection.
- **Variations send only the CHANGED rows.** `PUT /variations` makes one Duda call per row it is sent, and a product can have 300, so sending every row on each save risked a timeout for an edit to one SKU.
- **A gallery save refreshes `HubProduct.thumbnailUrl`** (`PUT /images` calls `syncHubProduct`), so a new primary image reaches the compatible carousel on other products' pages without waiting for this product to be reopened.
- The unsaved-changes guard (`hooks/useUnsavedChangesWarning.ts`) needs the **data router**: `useBlocker` calls `useDataRouterContext()` and throws under `<BrowserRouter>`. That's why `App.tsx` exports `createBrowserRouter`. It also pairs a `beforeunload` listener, which `useBlocker` does not cover.
- ⚠️ **Paragraph spacing is a WYSIWYG contract, and as of 2026-09-09 the value is 12px — set by US, not by Duda.** The description now renders through the widget's **Overview tab**, so `.saeh-prose p + p{margin-top:12px}` in `widget.js` is the authority, and `RichTextEditor.tsx` + `RichHtml.tsx` match it. **Change one, change all three** or the editor stops being trustworthy.

  ⚠️ **Use `mt-[12px]`, never `mt-3`.** Tailwind's spacing scale is rem-based and `html` is `font-size:110%`, so `mt-3` (0.75rem) resolves to **13.2px** in the dashboard while the widget renders a literal 12px. Same trap as the old `1em` one: only absolute px on both sides keeps them equal.

  This flipped three times, and the history explains why:
  1. A 16px gap existed on the OLD site (`099434f3`) as CSS in Duda's **Head HTML**, scoped to a wrapper class Josh added — `.productDescription p:not(:last-child){margin-bottom:16px}` — because Duda's theme API exposes **no** margin/spacing property (checked: `paragraph` only takes font/colour/letter-spacing). Per-site config, so it did **not** survive the move to `8a8f03b5`.
  2. 2026-09-08: rather than re-add it, Josh made the Hub match Duda's flush rendering (`[&_p]:my-0`). Accurate, but a paragraph break then looked identical to a line break while editing, so staff typed **blank lines** to see the structure — which would have shipped real empty `<p>` elements to the live page and produced genuine double gaps.
  3. 2026-09-09: the accordion's Overview tab took over rendering the description, so the spacing became ours to set. 12px everywhere, and the editor can show paragraph structure honestly.

  **Duda's own CSS, for the record** (measured from the live site's stylesheets, not assumed): `p.rteBlock{margin:0}` and `.dmNewParagraph[data-version] p{margin-top:0;margin-bottom:0}`. So Duda's *native* description element really does render flush — but note its **admin edit panel** shows comfortable paragraph gaps, which is authoring CSS and NOT what visitors see. Don't calibrate the Hub against that panel; it's what prompted the blank-line workaround.

  Note the IMPORT's sanitiser (`services/descriptionHtml.ts`) converts a sentence-boundary `<br>` into a paragraph break and drops empty paragraphs. ⚠️ It runs only on the WordPress import — an editor save is stored exactly as authored (tiptap's own output, or whatever was typed in the HTML tab), and the public page is protected by the widget's `safeProse()`, not by this.
- Description is a **tiptap WYSIWYG with an HTML tab** (`DescriptionSection`). Tiptap normalises markup it parses, so `RichTextEditor` reports only genuine user edits — opening a product and changing nothing leaves the stored HTML untouched — and says so when its parse would reformat legacy markup, pointing at the HTML tab.
- ⚠️ **The description lives in TWO places and a save writes both, differently** (fixed 2026-10-02). `HubProduct.descriptionHtml` is what the live page shows (the widget's Overview tab), and **nothing wrote it after the Stage 2 import** — so a description saved in the editor reached Duda and never the page, looking saved while staying invisible. `PATCH /api/products/:id` (and `POST` on create) now stores the authored HTML on the Hub and sends Duda `stripAnchors()` of it, because Duda's API refuses `<a href>` with an HTML 403 and the editor has a **Link** button, which would have failed the whole Details save. The editor LOADS the Hub copy (`/custom` → `descriptionHtml`, falling back to Duda's for a product the Hub never wrote), and re-baselines on the `hubDescriptionHtml` the PATCH echoes — re-baselining on Duda's link-free copy would read as an unsaved change. Measured before the fix: 95/96 identical, the 96th differing only by EX Heater's links, so no edit had been lost yet. Verified end-to-end on a throwaway product.
- ⚠️ **The URL slug is validated on both sides** — non-blank, `^[a-z0-9-]+$`, ≤200. It is the live page URL. Repeated hyphens are allowed because Duda renders `&` as `---` and one live slug is exactly that; all 96 pass.
- Product images upload to Supabase for a public URL, then Duda ingests them **on save** (hence the "Pending upload" badge). There is deliberately no local `ProductImage` mirror: once Duda re-hosts an image the product no longer references Supabase, so deleting the Media Centre original can't break a live gallery.

## Prisma migrations — baselined (twice)

The database had **no `_prisma_migrations` table** until 2026-07-28 (schema applied without migration tracking), so `migrate deploy` failed with `P3005`. The five pre-existing migrations were baselined with `prisma migrate resolve --applied`.

⚠️ **It was missing AGAIN on 2026-09-29** — `P3005` returned, and a query confirmed no `_prisma_migrations` in any schema, only Supabase's own `auth`/`realtime`/`storage` ones. All 14 migrations' effects were verified present in the DB (tables and columns checked one by one) before re-baselining them. So the previous "state is now consistent — don't re-baseline" was wrong, and something between then and now dropped the history without dropping the schema — most likely a `prisma db push` or a reset. **Check `_prisma_migrations` exists before concluding migration state is sound**; the schema being correct says nothing about it.

### ⚠️⚠️ NEVER pass a real database URL to `--shadow-database-url`

On 2026-09-29 this command **wiped the production database**:

```
prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "<DIRECT_URL from .env>"   # ← production
```

A shadow database is scratch space that Prisma **drops and recreates** as part of its normal operation. Pointing it at production emptied all 19 application tables. The command then failed on an unrelated error (`P3015`, a missing `migration.sql`), so the output gave no hint that anything had been destroyed — the damage was found minutes later when a row count came back zero.

Everything except the quote requests was rebuilt from Duda, the gitignored `migration/` files and the surviving Storage objects (see `logos:rebuild` below). **7 real customer quote requests were lost permanently**: there are no backups on this Supabase tier, email was never configured so no notification copies exist, and the quote route logs no submission contents.

### The runtime role cannot do DDL (added 2026-09-29)

`DATABASE_URL` now connects as **`saequip_app`**, a role holding
`SELECT/INSERT/UPDATE/DELETE` on `public` and nothing else — no `CREATE`, `DROP`,
`TRUNCATE` or `ALTER`, and no ownership. `ALTER DEFAULT PRIVILEGES` covers tables and
sequences a future migration adds, so the app does not break the next time one lands.

**`DIRECT_URL` keeps the `postgres` owner credential and is used ONLY by migrations.**
That split is the whole point: documentation did not stop a production wipe, and a role
that cannot execute DDL would have. Verified after the change — the app reads and writes
normally, while `DROP TABLE`, `TRUNCATE`, `CREATE TABLE`, `ALTER TABLE` and
`DROP SCHEMA public` are all refused.

⚠️ **Vercel's `DATABASE_URL` must be updated to match**, or production still runs as the
owner. Nothing runs migrations at deploy time (`buildCommand` is the API bundle check,
`prisma generate` and the frontend build), so the restricted role is safe there.

⚠️ **A `.env` copy taken before a credential change is not matched by the `.env` gitignore
rule.** `.env.backup*` is now ignored explicitly; one such file was a `git add -A` away
from committing a live database password.

### The guard hook

`.claude/settings.json` registers a PreToolUse/Bash hook running
`.claude/hooks/block-destructive-db.sh`, which refuses the destructive migration commands
outright. Enforced by the harness rather than by anyone's judgement, which is the point —
the warning above is the layer that had already failed.

⚠️ **It strips heredoc BODIES before matching, and that is load-bearing.** The first
version matched the raw command string, so it blocked the very commit whose message
explained the incident, and then blocked the command that would have replaced it. A guard
you cannot write about is one people route around. Real invocations are still caught; the
same words in a `<<'EOF'` body are prose. Seven cases cover both directions — edit the
script and re-run them rather than loosening the pattern.

**The safe way to generate a migration here** is what the rest of this section already says: `migrate diff --from-schema-datasource` (read-only against the live DB) or `--from-migrations` with **no** shadow URL at all, then apply with `migrate deploy`. If a shadow database is genuinely needed, it must be a throwaway database that exists for nothing else.

### `npm run logos:rebuild --workspace=backend`

Rebuilds the `Logo` catalogue and its `MediaAsset` rows from the files in the `product-media` bucket. Logos are uploaded by hand through the dashboard, so unlike product images they have no importer — and `--logos` cannot run without them, because it resolves each CSV token to a Logo **by the media asset's filename**. `LOGOS` in that script is copied from `SA_LOGO_FILES`/`CERT_LOGO_FILES` in `dudaImportProducts.ts`; if the two drift the import fails loudly rather than badging products with the wrong certification. Dry run by default, idempotent, and it picks the largest file when a name has several uploads (`resolveLogoCatalogue()` aborts on ambiguity, so only one may become a Logo).

`Lead` deliberately has a **nullable `downloadId` with `onDelete: SetNull`** plus `productName`/`productSku`/`downloadTitle` snapshot columns written at capture time, so deleting a product **preserves** captured leads (a null `downloadId` means "product since deleted"). Don't restore the cascade. `QuoteRequest`/`QuoteRequestItem` were never at risk — they hold denormalised snapshots with no FK to `HubProduct`.

## Deployment — Vercel (live since 2026-09-08)

Live on Vercel Pro since 2026-09-08 at `https://sa-equip-backend.vercel.app` (a custom domain is still to be added). Config is the single root `vercel.json`; the per-workspace `frontend/vercel.json` and `backend/vercel.json` were removed when the projects were consolidated.

**ONE Vercel project**, Root Directory = **repo root**, serving both surfaces from one origin:
- `api/index.ts` (repo root, not `backend/` — Vercel only picks up functions from a root `api/`) re-exports the Express app. `vercel.json` rewrites `/api/*` and `/public/*` to it, so Express still owns all routing.
- `frontend/dist` is the static output; every other path rewrites to `index.html` for the client-side router.
- The `.js` specifier in `api/index.ts` resolving to `backend/src/index.ts` is correct for this ESM TS setup and bundles cleanly (verified with esbuild, which Vercel's Node builder uses).

Same-origin buys two things that were previously footguns: **no CORS between dashboard and API**, and **`VITE_API_BASE_URL` is no longer baked in at build time** — `API_BASE` is now empty (relative) in production and only falls back to `http://localhost:4000` under `import.meta.env.DEV`, where the two really are separate origins.

### ⚠️ The security cost of one project, and what mitigates it

Vercel has **no build-time/runtime split for environment variables**, so in a single project the *frontend build runs with the backend's secrets in scope* — the Supabase service-role key (which bypasses every RLS policy), the Duda credentials, the database URL.

Nothing leaks today, and three things keep it that way: Vite only inlines `VITE_`-prefixed vars, no frontend file references `process.env`, and `envPrefix: ["VITE_"]` is pinned in `vite.config.ts` with a comment saying why. But that is three conventions deep, so **`scripts/assert-no-secrets.mjs` runs after every frontend build** and fails it if any non-`VITE_` secret value appears in `dist` (it reports the variable name and file, never the value, and also checks the password component of the DB URLs separately). Verified by deliberately leaking the service-role key via a `define:` block — the build failed as intended.

⚠️ **Residual risk that cannot be mitigated in this shape**: a compromised package anywhere in the *frontend's* dependency tree could read `process.env` during the build and exfiltrate those secrets over the network. The scanner catches inlining, not exfiltration. Only running the frontend build in an environment that never holds those secrets prevents it — i.e. a separate Vercel project, or the "one domain, two projects" variant where the frontend project rewrites `/api/*` to the backend project's URL. Accepted deliberately in exchange for the simplicity above; revisit if the frontend dependency tree grows or the threat model changes.

Related: **Preview deployments inherit the same env vars**, so anyone who can open a PR can run build scripts against production secrets. Prefer leaving `SUPABASE_SERVICE_ROLE_KEY` and `DUDA_API_PASS` unset on Preview (preview functions degrade, nothing leaks).

### Deploy safety checks (added 2026-10-02)

Three layers, each catching what the one before cannot. Added after a deploy that took the
whole API and the live widget down for ~3 minutes.

1. **In the Vercel build** — `scripts/check-api-bundle.mjs` runs FIRST in `buildCommand`. It
   bundles `api/index.ts` with esbuild (packages external) and fails the build if the
   function's import graph contains a denylisted package (`sanitize-html`, `@napi-rs/canvas`,
   `pdfjs-dist`, `jsdom`) or file (`services/descriptionHtml.ts`, anything under `scripts/`),
   printing the import chain that pulled it in. **A failed build leaves the previous deployment
   live**, which is the point. A denylist rather than "load it and see" because the original
   failure does not reproduce locally — `sanitize-html` crashes the function at load on Vercel
   only. Proven by re-introducing that exact import: the check failed with the chain
   `routes/duda.ts → services/descriptionHtml.ts → sanitize-html`.
2. **Before every push** — `.githooks/pre-push`: the bundle check, `tsc` for both workspaces
   (Vercel's build typechecks neither), `scripts/check-doc-refs.mjs` (every function this file
   names as `name()` must still exist in the code), and `widget:test`. ~12s. Enabled per clone with
   `git config core.hooksPath .githooks`; run on demand with `npm run check`; skip once,
   deliberately, with `git push --no-verify`.
3. **After every deploy** — `.github/workflows/post-deploy-smoke.yml` waits until
   `/api/health` reports the pushed commit (`VERCEL_GIT_COMMIT_SHA`), then runs
   `scripts/smoke.mjs` against production: the function loads, the admin API still 401s a
   forged token, the widget is served with a stamped marker, content and catalogue return with
   the right CORS header, `Vary: Origin` is present, a foreign origin is refused, and the
   dashboard loads. Read-only, no credentials. A failure — or a commit that never goes live,
   i.e. a failed build — fails the run and GitHub emails the pusher. `npm run smoke` runs it by hand.

**Add a check to `smoke.mjs` when something breaks in a way it would have caught**, and a
package or file to the bundle check's denylist when one is found to break the function.

### Live facts

- URL: `https://sa-equip-backend.vercel.app` (project name is a leftover; it serves BOTH the dashboard and the API). Custom domain not yet added.
- Widget script for Duda embeds: `https://sa-equip-backend.vercel.app/public/widget.js`
- ⚠️ **`WIDGET_ALLOWED_ORIGINS` gates the live widget, and getting it wrong is a silent outage**: the script still loads, but its data fetch 403s and every product page renders no Hub content. It must list the Duda EDITOR origin *and* every domain the site is served on. Current value:
  `https://my.duda.co,https://saequip.multiscreensite.com,https://saequip.com,https://www.saequip.com`
  Verify after any change by sending each origin as a request header — a rename once left only `my.duda.co` in place, which took the live widget down while the dashboard looked fine.
- **Bucket limits are no longer applied at startup.** Run `npm run storage:ensure --workspace=backend` after any deploy that changes `MAX_BYTES` or the mimetype allowlists; `npm run media:verify-upload --workspace=backend` checks the upload path still works.
- ⚠️ **Every bucket has a MIME allowlist, and it is the real enforcement.** Uploads go browser → Supabase, and the content type the bucket records is whatever the browser's form part says, so the API's own classification (from the claimed type and filename) is advisory. `product-models` had **none** (2026-10-02) while being PUBLIC, and a model is recognised by its `.glb` name — so a signed-in session could have uploaded an HTML page named `x.glb` and had it served as a web page from the storage domain. It now allows `model/gltf-binary` (what browsers send — all 3 stored models) and `application/octet-stream` (what an unaware browser sends, and what browsers download rather than render). Verified on throwaway objects: `text/html` and `image/svg+xml` refused with 415, both GLB labels accepted.
  ⚠️ **SVG stays allowed in `product-media`, knowingly.** An SVG can carry script, but it only runs when the file's URL is opened directly, on the Supabase storage origin — not the dashboard's, and Supabase auth uses bearer tokens, not cookies, so there is nothing ambient to steal. Every place the Hub shows a logo uses `<img>`, where SVG script never runs. Revisit if an SVG is ever rendered inline.
- **Duda now points at Vercel** — checked 2026-10-02: the live EX Heater page loads `sa-equip-backend.vercel.app/public/widget.js`, and a quote request arrived on 2026-10-01, so the basket widget posts here. (This line used to say they still pointed at the deleted Railway backend.) ⚠️ The `.vercel.app` hostname IS therefore baked into Duda's shims: **adding a custom domain later means editing every shim and the basket widget's `ENDPOINT`**, and the old hostname should keep working until they are.

### What the serverless model forced to change

- ⚠️ **A request body cannot exceed 4.5MB on Vercel** — a platform limit, not a plan setting. That is far below the 25MB file ceiling, so **uploads no longer go through the API at all**: the browser mints a signed URL, PUTs straight to Supabase and then confirms. See the upload section in `services/storage.ts` / `lib/upload.ts`. This was the blocking issue for the whole move.
- **`app.listen()` is skipped when `process.env.VERCEL` is set**, and `src/index.ts` exports the app; the repo-root `api/index.ts` re-exports it as the function handler and `vercel.json` rewrites `/api/*` and `/public/*` to it (everything else is the static dashboard), so Express owns all API routing. The same module runs unchanged as a normal server locally.
- **`ensureBuckets()` moved out of startup** into `npm run storage:ensure`. On serverless the module is evaluated on every cold start, so leaving it there added several Supabase round trips to a user's request, forever re-doing idempotent work.
- ⚠️ **`trust proxy` is now conditional on `process.env.VERCEL`.** It must stay OFF anywhere the app is reachable directly, because there it lets a caller spoof `X-Forwarded-For` and walk past an IP-keyed limit; on Vercel the header is set by their proxy, and *not* trusting it makes every IP-keyed limiter bucket the whole internet together.
- ⚠️ **`binaryTargets = ["native", "rhel-openssl-3.0.x"]`** in `schema.prisma`. Functions run on AWS Lambda; without the RHEL query engine in the bundle Prisma dies at cold start with "Query engine library for current platform could not be found".
- **`regions: ["dub1"]`** (Dublin) — Supabase is `eu-west-1`. A US region reintroduces the transatlantic latency that once made the public content endpoint ~5s.
- **`includeFiles: "backend/src/public-widget/**"`** ships the widget assets into the function bundle. `routes/public.ts` no longer trusts a single relative path: Vercel's bundler need not preserve the `src/` layout next to the compiled module, so `resolveWidgetDir()` tries several candidates and logs loudly at startup if none has `widget.js` — a missing widget is a deploy fault and shouldn't first surface as a 500 when Duda asks for the script.

### ⚠️ The edge cache and CORS (fixed 2026-10-02)

`/public/catalogue`, `/by-category` and `/products/content` are cached at Vercel's edge
(`s-maxage` / `stale-while-revalidate`), and **the edge keys on Origin only when the
response says `Vary: Origin`**. `publicCors` used to set it only when a request HAD an
Origin, so anything without one — curl, a monitor, a crawler — stored a copy with no
`Access-Control-Allow-Origin`, which the edge then served as a HIT to the live site, the
Duda editor and saequip.com. Browsers reject that, so the listing grid and carousels could
fail for up to a minute whenever a no-Origin request was first to the cache. Measured
before the fix: MISS with no Origin, then HIT with no CORS header for all three origins.
`Vary: Origin` is now on every public response. **Verify CORS with a cache-busting query
string** (`?z=$RANDOM`), or the answer is whatever the edge happened to cache.

### Hidden products and the status mirror (fixed 2026-10-02)

`HubProduct.status` mirrors Duda's `ACTIVE`/`HIDDEN`, written by `syncHubProduct` like
name/sku/slug/thumbnail. The public listings — the catalogue grid, the category carousels
and each product's compatible carousel — read the Hub, never Duda, so before this a HIDDEN
product was listed and linked like a live one. A product created in the Hub **starts
hidden**, deliberately, and would have appeared in every category it was ticked into.
Latent rather than live when found: all 96 were ACTIVE. `/public/products/content` still
serves a hidden product by its own slug/id, so staff can lay out its page in Duda's editor
before publishing.

- ⚠️ **Filter with `LISTABLE` (`services/hubProduct.ts`), never `{ status: { not: "HIDDEN" } }`.**
  That compiles to `status <> 'HIDDEN'`, which SQL evaluates as NULL — false — for a row
  never synced, and would silently drop every such product from the site.
- ⚠️ **Hiding or un-hiding a product IN DUDA does not reach the Hub until it syncs** —
  opening it in the dashboard, saving it there, or `npm run hub:sync-mirror --workspace=backend -- --confirm`.
  That script walks Duda itself (one paged list call), so unlike `--sync-hub` it covers
  products created after the WordPress import; dry run by default, it prints each field it
  would change and any Hub row whose Duda product is gone.

### Rate limiting is split on purpose

- **The SSO limiter is Postgres-backed** (`middleware/pgRateLimitStore.ts`). `express-rate-limit`'s default store is in-process memory, which is useless on serverless: each of many short-lived instances keeps its own counter, so "10 per minute" becomes "10 per minute *per instance*" and resets on every recycle. That is unacceptable for the one route that **mints a live Duda credential**. The increment is a single atomic `INSERT … ON CONFLICT` because read-then-write loses hits under exactly the concurrency serverless makes normal (verified: 20 concurrent hits all counted).
- **The CONTENT limiter stays in-memory**, and is best-effort only — a DB write per page view is the wrong trade on the one endpoint that has to stay fast. ⚠️ The two **form-post** limiters (lead, quote) are **Postgres-backed** (`PgRateLimitStore`), as the quote-abuse section describes; this line used to say all three were in-memory, which was out of date. Real protection for those belongs at the edge — **Vercel Firewall rate-limit rules**, which run before the function is even invoked and are therefore both cheaper and actually effective.

## Deployment gotchas (Railway) — HISTORICAL, Railway was deleted 2026-09-08

Kept because two of these are platform-independent and still bite: `prisma generate` must run before `tsc`, and the region must match Supabase's `eu-west-1`. The rest is Railway-specific and no longer applies.

- **`prisma generate` must run before `tsc`.** Backend `package.json` has `postinstall: prisma generate` and `build: prisma generate && tsc` — without this, Railway's fresh install builds against an empty `@prisma/client` and every model type "doesn't exist."
- **Migrations with warnings**: `prisma migrate dev` refuses to run non-interactively when a migration could be destructive (new `@@unique`, dropped column, etc.), and even `--create-only` bails. Workaround: `prisma migrate diff` → apply via `prisma migrate deploy`.
- **The frontend is a static SPA and must be *served*, not run in dev mode.** `frontend/package.json`'s `start` script is `serve -s dist -l tcp://0.0.0.0:${PORT:-4173}` — critically bound to **`0.0.0.0`**, not `localhost` (Railway's proxy can't reach `127.0.0.1` inside the container → 502). Railway's **Custom Start Command** must be explicitly set to `npm run start --workspace=frontend` (it silently defaults to running the `dev` script otherwise, which binds Vite to `5173` and never responds).
- **Railway's domain "Target Port" must match what the app actually listens on** (the `$PORT` Railway injects) — a mismatch here is a second, independent way to get a 502 even after the app itself is listening correctly.
- **Widget static assets must ship in the compiled build**: `backend/scripts/copy-widget.mjs` (a `postbuild` step) copies `src/public-widget/` into `dist/public-widget/`; the route resolves the path via `import.meta.url` (backend is ESM — `__dirname` isn't available) so it works from both `src` (dev, `tsx`) and `dist` (prod, `node`).
- **Region matters for latency**: Supabase is in `eu-west-1`. If a Railway service ends up in a US region, every DB query pays transatlantic round-trip latency — this once made the public content endpoint take ~5s. Keep backend region aligned with the Supabase region.
- **The public content endpoint must never call Duda's API on the request path** — it was built to be a pure Supabase read (single query with nested `include`s) specifically because per-request Duda calls made it slow and put public traffic against Duda's rate limits. Don't reintroduce a Duda call into `/public/products/content`.

## Verification / testing policy — important, learned the hard way

⚠️ **EX Heater's `dudaProductId` changed on 2026-09-07.** The hand-built product was deliberately deleted and re-imported from the CSV (10 images instead of 2), so it is now **`01M1XRCFGGHYEJ0QGGXCJ3582N`**, not `01KW9R473XZGWZWC5206EPYAWB`. The slug (`ex-heater`) and SKU (`SAPH18440`) are unchanged. Its 3D model had to be re-attached by hand: `glbAssetId` lives on the `HubProduct` row, and deleting a product hard-deletes that row — the `MediaAsset` itself survives (no cascade), so the sequence is *record the asset id → delete → re-import → re-attach*. Anything quoting the old id is stale.

**EX Heater** (slug `ex-heater`) is a **live product** Josh populates for real, not a fixture. Multiple early verification passes accidentally wrote test data to it or risked wiping it via replace-whole-set endpoints (specs/benefits/applications use delete-all-then-recreate semantics).

**Rule going forward: every verification/test must use a dedicated throwaway product (create hidden → test → delete), never the live EX Heater** — and never run a replace-whole-set write against real data without snapshotting first. Read-only checks against EX Heater are fine.

⚠️ **A throwaway PRODUCT is not enough when the write is scoped by something else.** On
2026-09-30 a verification of `PUT /api/categories/:id/products` used a throwaway product
correctly — and still destroyed real data, because that route replaces **the whole product
list of a CATEGORY**. Calling it with `[]` to prove "removing from a parent clears the
subtree" cleared *every* product in Site Challenges, including the one real assignment, not
just the throwaway. It went unnoticed because Duda still showed `products_count: 1` from the
last sync, so the tree looked right while the edit page and the public widget were empty.

**Ask what the endpoint's unit of replacement is, and make a throwaway of THAT.** For a
category-scoped write that means a throwaway category as well as a throwaway product. Where
a throwaway is impractical, snapshot the affected rows first and restore them.

(Recoverable only because `duda:sync-categories` had already pushed to Duda, so Duda held
the surviving copy of a Hub-owned fact. That is luck, not a backup — the sync is one-way and
the next run would have overwritten it.)

## WordPress → Duda catalogue migration (started 2026-09-07)

The ~96-product legacy catalogue is being moved off the WordPress/WooCommerce site in **stages**, driven by a WooCommerce CSV export rather than by hand.

**Every content stage is done** (as of 2026-10-02): 1) title + SKU + images, 2) descriptions, 3a) benefits + applications, 3b) specs, 3c) logos, 3d) compatible products, 3e) downloads — each below. **Still to do: the Hire/Purchase option**, which goes through the options code in "Verified write surface" (attaching a two-value option drops existing variation SKUs, by design — they cannot be split unambiguously).

- `npm run duda:import-products --workspace=backend` — **dry run by default**: parses, reports data defects, HEAD-checks every image URL, writes nothing. `--confirm` to import, `--verify` for read-only reconciliation, `--retry-failed` to resume, `--rollback --confirm` to undo, `--batch N` (default 10), `--limit`/`--only` to scope.
- `backend/src/services/wooImport.ts` is the **pure** parse/map half (no network, DB or fs) so later stages reuse one source of truth; `backend/src/scripts/dudaImportProducts.ts` owns all side effects.
- Working files live in the gitignored `migration/`: the export, `ledger.json`, `images/` (local archive), and per-run reports. **The export must never be committed** — it contains the private/draft products and pricing.

### Facts that shaped it

- **Published-only filter is `Type != "variation" AND Published == "1"`** → exactly 96 products (93 `simple` + 3 `variable`). WooCommerce encodes `Published` as `1`/`0`/`-1` = publish/draft/**private**, and the 386 `variation` rows are child rows of variable products, not products — importing them would create phantom duplicates.
- **The idempotency key is the WordPress post `ID`, not SKU.** SKU is unusable as identity here: 3 of the 96 have none, and 4 SKUs are reused across 9 products (`SAFU/RF` ×3, `SAFD`, `SPTR`, `SAPVES` ×2 each — e.g. `SPTR` is on both "EX 3.8KVA Transformer" and "EX 400VA Transformer"). These import anyway and are reported as a fix-list.
- ⚠️ **`POST /ecommerce/products` is not idempotent**, so `ledger.json` (WP id → Duda id) is written *immediately on create, before images* — a crash between the two must never leave a created product invisible to the next run, or it gets created twice.
- ⚠️ **EX Heater is in the CSV** (wp#7481 / `SAPH18440`) and already existed in Duda, hand-curated with a 3D model. A deny-list alone can't protect it: a fresh run has no ledger entry for it, so it would create a *second* "EX Heater" and only notice afterwards. `adoptExisting()` therefore reconciles the CSV against `listAllProducts()` **by SKU before any create**, adopts matches into the ledger, and marks deny-listed ones done so their galleries are never overwritten. Same mechanism recovers a lost ledger without doubling the catalogue.
- `--rollback` deletes only rows it **created** — never `adopted` ones, which point at products the migration didn't own.
- **Name collisions are resolved by suffixing the SKU**, not by preserving the title. Duda forbids duplicate titles *and* duplicate slugs (see the Duda REST API section), so `COMPACT FILTRATION UNIT` (SAECFU) imported as `COMPACT FILTRATION UNIT (SAECFU)` / `compact-filtration-unit-saecfu` alongside `Compact Filtration Unit` (SACFU). `verify` recognises that shape as a deliberate, accepted difference rather than a defect, and reports it for a human to name properly. Only 1 of 96 products needed this.
- **`--sync-hub --confirm` is the repair pass for `HubProduct` rows.** An *adopted* product skips the create branch that normally calls `syncHubProduct`, so it lands in Duda with no Hub row — and without one the public widget can't resolve it by slug and Stages 2-3 have nothing to attach content to. `verify` now checks every selected product has a Hub row *with a non-null slug* and names any that don't.

### Images: Duda takes its own copy (verified)

`duda.updateProductImages()` → `PATCH /products/{id}` with `{images:[{url}]}` makes **Duda fetch each URL server-side and re-host the file on its own CDN** (`irp.cdn-website.com/{site}/dms3rep/multi/…`, transcoded to `.webp`). Proven on EX Heater, whose gallery holds one image still carrying its original WordPress filename (ingested from a `saequip.com` URL) alongside one with our Supabase `images/{uuid}-{name}` shape.

**Consequence: the source URL only has to be reachable at the instant of the PATCH.** Duda never hot-links, so after ingest the catalogue depends on neither WordPress nor our Supabase. Stage 1 therefore hands Duda the `saequip.com` URLs directly and lets it pull all 381 references (329 unique, ~29MB).

- ⚠️ **Ingest must finish before `saequip.com` is repointed at Duda**, or every source URL dies. The importer HEAD-checks each URL immediately before use and refuses to write a product with a dead image rather than creating a gappy live gallery.
- **Galleries are imported verbatim, duplicates included — this is a decision, not an oversight.** 23 of the 96 products list the same image twice in the CSV (WooCommerce repeats the featured image inside the gallery; EX Heater has `SA_Flexiheat_heater_sideangle.png` at positions 1 and 5). Josh reviewed this on 2026-09-07 and chose to leave them, since de-duplicating means Duda re-fetching ~140 images and orphaning the replaced copies on its CDN. **Don't "fix" it unasked** — remove individual images by hand in the product editor instead.
- **Products with no image in WordPress get `frontend/public/saequip-no-image.jpg`** (5 of 96). Duda ingests by *fetching a URL*, so a repo file can't be handed over directly — it's uploaded once to the public `product-media` bucket at the fixed path `images/saequip-no-image.jpg` (the same Supabase staging route the dashboard's own uploader uses) and that URL is given to Duda, which re-hosts its own copy per product. It also gets a `MediaAsset` row via `--media-centre`, so it's reusable from `MediaPicker`. `--no-fallback` opts out.
- **The verification that matters is "no image still references a non-Duda host."** Every batch is re-read and asserted to be entirely on `irp.cdn-website.com`; a batch that wholly fails stops the run instead of pressing on through 96 products.
- **Product photos DO belong in the Media Centre** — `--media-centre --confirm` uploads all 329 unique images to `product-media` under `images/wp/<uploads-relative-path>` and creates a `MediaAsset` row each (`uploadedBy: "wordpress-import"`). This matches how the dashboard has always behaved: `ImagesSection`'s dropzone posts to `POST /api/media`, so a gallery image added by hand already becomes "staging plus a reusable Media Centre original" that `MediaPicker` can re-attach to another product. The bulk import initially skipped this, on the reasoning that 329 product shots would bury the 9 certification logos in the logo picker — **wrong call**: it left 373 live images with no Media Centre presence and diverged from the editor's own behaviour. Picker noise is a filtering problem, not a reason to withhold the assets. The pass is additive and idempotent (deterministic `storagePath`, keyed off the unique constraint) and **never touches Duda** — Duda holds its own re-hosted copy, which is exactly why deleting a Media Centre original can't break a live gallery.
- **`GET /api/media` is PAGINATED and searchable** (`?kind=&q=&sort=&page=&pageSize=`), returning `{items, total, page, pageSize, pageCount}` — **not an array**. `q` matches filename or alt case-insensitively; `sort` is `recent|oldest|name|name-desc|largest|smallest`; `pageSize` defaults to 24 and caps at 100. Both consumers go through the shared `useMediaLibrary` hook (`frontend/src/lib/useMediaLibrary.ts`) so the page and the picker cannot drift — the picker previously fetched the whole library unpaginated and rendered every result, so picking one image cost 341 `<img>` tags and 341 resolved URLs.
- ⚠️ **"Used N×" counts distinct PRODUCTS, and opens the list of them** (2026-10-02). `services/assetUsage.ts` is the one source for both the pill and its popup: `productCounts()` (one `COUNT(DISTINCT)` query over logo links, downloads and `glbAssetId`, scoped to the page's ids — 128ms for the whole 485-asset library) and `assetUsage()` / `logoProducts()` behind `GET /api/media/:id/usage` and `GET /api/logos/:id/products`. It used to count referencing ROWS, so a logo image counted its one `Logo` entry — "Made in UK" read "used 1×" while on 47 products. Once a count opens a list, the two must be the same number. `UsagePill` (`components/UsagePill.tsx`) is shared by the Media Centre and the Logos page; it fetches only when opened, and each product links to its editor.
  - ⚠️ **Product gallery images are still NOT counted, and cannot be.** A product image is uploaded only to give Duda a URL to fetch; once Duda re-hosts it the product points at `irp.cdn-website.com` and nothing links back, so an imported product photo reads **"Unused"** even while it is on a live page — Josh's chosen wording, with a tooltip saying why. Safe: deleting it cannot break a gallery, Duda holds its own copy. **Proper gallery tracking would need a join table written on save plus a backfill; not built.**
  - ⚠️ **A catalogue logo carried by no product reads "Unused" but cannot be deleted.** `Logo.mediaAssetId` has no `onDelete`, and the delete guard checks the logo entry separately from products — otherwise the bucket object would be removed first and then the row delete fail on the FK, leaving a logo pointing at nothing. The 409 carries `{count, logos}` so the message can say which. Verified on a throwaway asset + logo.
- ⚠️ **The kind tabs were missing "3D Models".** The filter type was `"" | "image" | "file"` and the label fell through to "Files" for anything not an image, so the 3 `.glb` models had no tab and the Files tab — which matches **0** assets, the library being all images and models — looked like where everything had landed. Split at the time: 341 images, 3 models, 0 files (2026-10-02: 356 images, 3 models, 126 files).
- ⚠️ **`GET /api/media` used to run 3 count queries PER asset.** Invisible at 5 assets; the import took the library to 335 and made one page load ~1,000 queries (measured 7.1s, concurrent). Now one grouped query per page builds the usage counts (see the bullet above). Supabase is in eu-west-1, so per-query latency dominates — the same trap that once made the public content endpoint take ~5s. **Any per-row query in a list endpoint is a bug waiting for the catalogue to grow.**
- `updateProductImages` takes an opt-in `timeoutMs` because Duda fetches images *during* the request — the importer scales it to gallery size (a 14-image product is a genuinely slow call). `services/duda.ts` has no retry/backoff of its own, so the importer adds bounded retry on 429/5xx/timeout plus inter-product and inter-batch pacing.

### Stage 2 — descriptions (done 2026-09-08)

`npm run duda:import-products --workspace=backend -- --descriptions --confirm` writes a sanitised description to **both** Duda's native `description` and `HubProduct.descriptionHtml`, and `/public/products/content` now returns `descriptionHtml`. Both, because Duda's field is what the product template renders while the public endpoint is a pure Supabase read that must never call Duda — so a widget-rendered "Overview" tab needs the Hub's own copy. That leaves the connected-data and widget routes equally open. (Since 2026-10-02 the product editor writes both copies too — see "The product editor".)

**One description field, not two.** WooCommerce has `Short description` + `Description`; Duda has one. Measured across the 96: 49 shorts are contained verbatim in the long text, 24 products have only a short, 2 have neither — so collapsing is safe for 75. But **21 shorts carry text the long one doesn't**, and `composeDescription()` sorts them: 11 are paraphrases (dropped, they'd only repeat), 1 is a call-to-action from the WP page template (dropped — "select an option below" points at controls Duda hasn't got), and **9 are prepended as the opening paragraph**. That last group matters: 5 carry sales disclaimers ("available for purchase only", "options for UK hire and sale may vary") that exist *nowhere else*, and SATL100/SG/CR5 and SEFU/RF-DU/BD2 share only 14% of their words with the long text. Collapsing naively would have silently dropped all of it.

**`services/descriptionHtml.ts` is the sanitiser** — pure, no network/DB, so Stage 3 can reuse it. It fixes six measured defects: line breaks double-encoded as a real newline plus a literal `\n` (252 of them, which would render as visible `\n` text); 114 of 164 fields not wrapped in block tags at all (WordPress builds paragraphs at render time via `wpautop`); 157 non-breaking spaces; `class="p1"`/`class="page|section|layoutArea|column"`/`title="Page 1"` editor and PDF-converter cruft; stray inline styles including one `color:#ffffff` that would have been invisible white-on-white text; and a `[video]` WordPress shortcode that would have rendered as literal text.

⚠️ **Two ordering traps in that pipeline, both found by auditing all 164 fields rather than spot-checking:**
- **Sanitise before paragraphing.** One field (SACDES/SACBDS) is wrapped in `<div class="page">`, so paragraphing first sees a block element and passes it through — then unwrapping the divs leaves the text with no paragraphs at all.
- **Split on every block tag, not just `<p>`.** Splitting on `<p>` alone leaves a trailing `<hr>`/`<h5>` glued to the preceding paragraph, which stops it looking like a list item and cut three of SAVK's four identical kit blocks out of the list conversion while the fourth converted.

Also: `<br>` are all paste artifacts, so they become a paragraph break after a full stop and a plain space mid-sentence (a hard break mid-phrase re-wraps in the wrong place at every width); runs of 3+ short paragraphs become `<ul>` lists (kit contents, 2 products); `https://saequip.com/product/x` links become root-relative `/product/x` (Duda uses the same URL pattern, so they survive the domain move); other saequip.com links are unwrapped to plain text since they'd 404 at cutover. Curly quotes, en dashes, ° and ³ are deliberately kept — correct punctuation, not corruption.

⚠️ **Duda's API rejects `<a href>` in a description with a `403` and an HTML error page** (not its usual JSON error) — a WAF in front of `api.duda.co`. Probed against a throwaway product: `<p>`, `<strong>`, `<ul>`, `<h5>`, `<hr />`, `&amp;`, curly quotes and 2,000 characters all pass; `<a>` with no href passes; `href` on a `<span>` passes; the literal text "href=" passes. **Only `<a href="…">` is blocked**, absolute or relative. So `stripAnchors()` produces a link-free copy for Duda while the Hub keeps the linked HTML for the widget. One product (EX Heater) is affected; the import reports it.

Minor: **Duda normalises `<hr />` to `<hr>`** on write, so any exact-string comparison of a sent vs stored description must normalise that or it reports false mismatches.

⚠️ **Never put a literal U+00A0 in source.** `normaliseWhitespaceChars` strips non-breaking spaces via a ` ` escape, deliberately: a literal one is invisible in review, indistinguishable from a normal space, and turns the line into a silent no-op if retyped. A verification regex written with a literal space instead of U+00A0 reported "non-breaking space" in all 94 live descriptions when the real count was zero.

### Stage 3a — key benefits + applications (done 2026-09-08)

`npm run duda:import-products --workspace=backend -- --lists --confirm` writes both into the Hub as `ProductTextItem` rows. **Hub-only — these never go to Duda.** Result: **512 benefits across 59 products, 325 applications across 56**, all 837 items verified to match the CSV exactly, in order, with dense `sortOrder` 0..n-1.

⚠️ **The two ACF field names are ASYMMETRIC and it is not a typo.** Benefits repeat the plural (`key_benefits_repeat_N_key_benefits_repeat__value`); applications use a SINGULAR inner name (`applications_repeat_N_application_repeat__value`). Assuming symmetry silently yields zero applications.

⚠️ **Both are replace-whole-set** (delete-all-by-kind then recreate), mirroring `PUT /api/products/:id/benefits`, so a blind re-run is destructive. The import therefore refuses two things: a product whose CSV list is **empty** is skipped rather than written (writing an empty set would delete what's there, and "the CSV is silent" ≠ "this product should have none"), and a product that **already has items** is skipped unless `--force`, so a second run cannot quietly overwrite a staff member's hand edits.

Stored as **plain text, not HTML** — the widget renders them with `textContent` and never injects markup, so `sanitisePlainText()` decodes entities rather than escaping them. Two things it fixes that would otherwise have shipped:

- **38 items contained `&amp;`**, which would have displayed literally as the five characters "&amp;" on the live page. Note the source is inconsistent — one SAF35 benefit has a raw `&` while its sibling is encoded — which is safe because sanitize-html normalises every ampersand first, so exactly one decode pass handles both. (No double-encoded `&amp;amp;` exists in the export.)
- **6 items contained the `ﬁ` ligature** (U+FB01) from a PDF paste — `"Oil reﬁneries"` and `"Conﬁned spaces"` on SPTR, PNER and PNEL. A single codepoint that merely looks like "fi": it breaks text search, sorts oddly, and renders as a missing-glyph box in fonts without it. Normalised to real letters, along with the other ﬀ/ﬂ/ﬃ/ﬄ ligatures.

`°`, `³`, en dashes and curly quotes are deliberately kept — this data is full of "-40°C" and "2560m3/hr".

### Stage 3b — technical specs (done 2026-09-10)

`npm run duda:import-products --workspace=backend -- --specs --confirm` writes `SpecRow` rows into the Hub. **Hub-only — specs never go to Duda.** Result: **691 rows across 50 products**, every row verified against the CSV in order, with dense `sortOrder` 0..n-1.

⚠️ **A spec table has THREE row kinds, and the blanks are what distinguish them.** This is how the source catalogue already encodes it, not a convention invented here:

| `label` | `value` | Renders as |
|---|---|---|
| set | set | an ordinary spec |
| **blank** | set | another LINE of the spec above — 225 of the 691 rows (EX Dehumidifier's PROTECTION has six) |
| set | **blank** | a sub-heading inside the table — 4 rows ("SYSTEM INCLUDES", "Filter System") |

Both blank is invalid, and **the first row can never have a blank label** (nothing above it to continue) — enforced in the zod body and mirrored client-side. The previous schema required *both* sides, which made the multi-line and sub-heading shapes unrepresentable; relaxing it is what lets the imported tables round-trip through the editor.

⚠️ **`specRows()` cannot use `acfRepeater()`.** That helper reads ONE field and drops blanks, which is right for the single-column benefit/application repeaters and destroys this one: here a blank title is *meaningful* and the two columns must stay index-aligned, so dropping blanks silently re-parents every continuation line to the wrong spec. Note the field names are symmetric here (`technical_specs_repeat_N_technical_specs_repeat__title|value`), unlike the asymmetric applications repeater.

**The editor renders GROUPS, the API stores FLAT rows.** `SpecTableEditor` derives groups on every render via `groupSpecRows()` and rebuilds the flat list through `flattenSpecGroups()` on every edit — one source of truth, no local state to drift from the baseline after a save, and the two functions round-trip exactly (a group keeps the id of the row that carried its label). "+ Add line" adds a value line to a spec; there is deliberately no "+ Add sub-heading" button — removing a spec's last line makes one (see `heading` below); drag reorders whole groups, so a continuation line can never be orphaned by dragging.

⚠️ **`SpecRowDraft.cont` is a frontend-only flag and must not be inferred from an empty label.** If grouping keyed off emptiness, a user clearing a label would silently merge that whole group into the one above and their lines would jump up the page. `cont` carries the boundary explicitly, so a blank label stays an ordinary validation error. It is excluded from `project()`, so it cannot affect dirty detection, and the save maps `label: r.cont ? "" : r.label.trim()`.

⚠️ **`SpecRowDraft.heading` is the same rule for sub-headings, and it was learned the same way** (2026-10-02). Sub-headings WERE inferred from an empty value, so an empty line vanished: **"+ Add Row" made a spec with no value box**, "+ Add line" on it did nothing, clearing a value to retype it removed the box mid-edit, and clearing the first line of a multi-line spec deleted it. `heading` is read from stored data on load and set only when the user removes a spec's LAST line; an empty line is a validation error naming the spec (`specsProblem()`). Verified: all 50 stored tables (691 rows) round-trip unchanged and none newly fail validation.

**Accordion content is 15px `#878787`**, with the spec table's left column near-black (`#111`) so the label still leads the eye across the row. Set on the shared `.saeh-prose`/`.saeh-table`/`.saeh-list` rules rather than scoped under `.saeh-tab-p`: those three designs render **only** inside the accordion in production, so scoping would create a second treatment of the same content with nothing keeping the two in step — the drift that left a dot bullet on Applications. ⚠️ `#878787` on white is ~3.6:1, under WCAG AA's 4.5:1 for body text — a deliberate brand choice, noted so it is not read as an oversight (`#767676` is the darkest grey that clears AA). The downloads section and its lead form are not accordion content and keep 16px.

**Rendering** (`specsTable()` in `widget.js`): one `<tr>` per LINE with the label cell filled only on a group's first line — the shape printed spec sheets use, and what the front end showed on WordPress. ⚠️ **Striping is per GROUP via an explicit `.saeh-alt` class, NOT `tr:nth-child(even)`.** Row-parity striping predates multi-line specs and turns a six-line group into alternating bands that read as six unrelated specs; parity has to follow the data, and CSS cannot see where a group starts. Continuation rows need no border special-casing — the default per-cell bottom border already draws the full-width rule under every line. A leading blank label starts its own group rather than being dropped: showing the value beats deleting content on a page nobody is watching.

**Labels are title-cased at parse time by `titleCaseSpecLabel()`.** 113 of the 158 distinct labels were ALL CAPS; 388 rows changed, 0 values touched.

⚠️ **CSS cannot do this** — `text-transform:capitalize` only upper-cases each word's first letter and leaves the rest, so on `CERTIFICATION` it is a no-op. And it is done in the DATA, not at render time, so the dashboard editor and the live page agree — the same reason the paragraph-spacing contract exists. Two conservative preservation rules keep it from mangling the catalogue: a token containing a **digit** is kept verbatim (`440VAC`, `100PSIG`, `1M`, `30CM` — measurements whose casing can't be inferred), and a token in `SPEC_LABEL_ACRONYMS` keeps its canonical form (`LED Life`, `1 X EX Air Mover`). Letter RUNS are capitalised rather than space-separated tokens, which is what makes `MIN/MAX PRESSURE` → "Min/Max Pressure" and `POWER (WATTS)` → "Power (Watts)". **Only entirely-upper-case labels are touched** — 45 are already deliberately mixed ("Free Airflow (with 30cm Connectors)") and title-casing those would capitalise "with".

**Two source defects fixed** (`sanitisePlainText` now strips both):
- **32 spec values began with an apostrophe** — the spreadsheet text guard, typed so Excel doesn't read `-40°C` as a formula. `stripSpreadsheetTextGuard()` removes it, deliberately narrowly: only `'` followed by `-` or a digit, which is every one of the real cases. A blanket "strip a leading quote" would eat real punctuation from `'best in class' rating`.
- ⚠️ **The same guard had already shipped in Stage 3a** — `'-50°C to +50°C operating temperature` was live on EX LED Area Light and EX LED Tower Light. Repaired with `--lists --confirm --force --only 7993,8015`, snapshotted before and diffed after: exactly two lines changed, item counts unchanged. **A defect found in one stage's data is worth re-checking against the stages already imported.**

Also fixed: 10 `&amp;` entities (values render with `textContent`, so they would have shown literally) and 81 untrimmed cells. Zero ligatures, non-breaking spaces, newlines or HTML tags — and **zero angle brackets anywhere in the 691 cells**, checked before running them through `sanitize-html`, which would otherwise have silently eaten a value like `<40dBa`.

### Stage 3c — logos (done 2026-09-10)

`npm run duda:import-products --workspace=backend -- --logos --confirm` writes `ProductLogo` links. **Hub-only.** Result: **368 links across 96/96 products — 141 SA + 227 certification — all verified against the CSV with 0 mismatches.**

⚠️ **The two logo kinds come from completely different places in the export, and only one of them is a logo field at all.**

**Certification logos** — the `associated_logos` ACF repeater (`Meta: associated_logos_<n>_associated_logos_name`). **227 links across 53/96 products, 9 distinct values.** The other 43 products are accessories (trolleys, brackets, chargers, temperature limiters) with no certification of their own, which is correct rather than missing data.

| CSV value | Products |
|---|---|
| `madeinuk` | 47 |
| `zone-1-2` | 39 |
| `ATEX` | 38 |
| `UKEX` | 26 |
| `IECEx` | 26 |
| `zone-21-22` | 24 |
| `INMETRO` | 23 |
| `zone-0` | 3 |
| `zone-20` | 1 |

**SA range logos are NOT in that field — they are NOT in any logo field.** They have to be derived from the **`Categories`** column, which mixes SA ranges in with industry sectors. Verified per field: `Name` carries the range for only 3 of 96 products and `Tags` never does (tags are sectors only). **139 links across 94/96 products:**

| SA logo | Products | Derived from these exact categories |
|---|---|---|
| Rental | 51 | `Rental`, or any category ending `Rental` |
| Lumin | 34 | `SA Lumin` |
| Cyclone | 24 | `SA Cyclone`, `SA Cyclone Rental` |
| Endure | 14 | `SA ENDURE` |
| Powernet | 9 | `SA Powernet`, `SA Powernet Rental` |
| Flexiheat | 7 | `SA Flexiheat` |

⚠️ **Match categories EXACTLY, not by substring** — `SA Cyclone Rental` contains `SA Cyclone`, so a substring match double-counts Cyclone and silently inflates every range. Rental is orthogonal to the ranges (a product is both `SA Cyclone` and `Rental`), which is why 139 links cover 94 products.

Cross-check that the derivation is right: EX Heater derives `Flexiheat` + `Rental`, which is exactly the two SA logos on its live page.

**The 2 products with no SA range** are `SA LUMIN Tasklight Base Unit` and `SA LUMIN Tasklight Adjustable Floor Stand` — both named LUMIN but absent from the `SA Lumin` category. They are also the two SKU-less products on the fix-list, so the same pair needs a data decision either way.

⚠️ **The CSV token → Logo mapping is resolved on the MediaAsset FILENAME, not the label** (`CERT_LOGO_FILES` / `SA_LOGO_FILES` in the import script), with a label match only as a fallback. `Logo.label` is nullable and the API takes it as optional, so two logos arrived with a **NULL label** and were identifiable only by their file; labels also carry typos (`Made in Britan`) and get renamed in the UI. Anything resolving to zero or to more than one Logo is a **hard failure before any write** — a mis-resolved mark would badge products with the wrong certification, which on hazardous-area equipment is the worst thing to guess at.

⚠️ **`ATEX` → "EX logo" and `UKEX` → "UKCA" are Josh's explicit decisions (2026-09-10), not inferences.** They are not the same marks by definition — UKCA is the UK conformity marking, UKEX the UK explosive-atmospheres scheme — so do not "correct" this mapping by re-deriving it.

**The two Tasklight products** (`SA LUMIN Tasklight Base Unit`, `Adjustable Floor Stand`, wpId 13045/13050) are named LUMIN but sit outside the `SA Lumin` category, so derivation correctly finds nothing. `SA_RANGE_OVERRIDES` in `wooImport.ts` assigns them Lumin, per Josh. They are also the two SKU-less products on the fix-list.

### Stage 3d — compatible products (done 2026-09-11)

"Compatible Products & Accessories": **286 links across 75 products.**

⚠️ **This data is NOT in the CSV, and the near-miss is the important part.** `Meta: compatible_products` is empty for all 584 rows; `Meta: _compatible_products` holds only ACF's field key (`field_62aa62a4e4a17`) for 193 rows, which says the field exists and nothing about its value — ACF relationship fields store serialised post-ID arrays and this exporter dropped them.

⚠️ **WooCommerce `Cross-sells` is populated (29 products), resolves cleanly, and is the WRONG data.** It is a different, smaller set: EX Heater cross-sells 5 items against **6** live slides, EX Air Mover 5 against **8**. Importing it would have produced a wrong-but-entirely-plausible result that nobody would have questioned.

So the live WordPress pages were the only source: `npm run wp:scrape-compatible --workspace=backend` writes `migration/compatible-products.json`, and `-- --compatible --confirm` imports it. Splitting the two means the import no longer depends on a third-party site being up.

Traps the scraper had to handle:
- **Bound the extraction to the productSwiper's own `swiper-wrapper`.** A fixed-size window after the heading silently absorbed cards from the *next* carousel — it reported 6 items for a 5-item product and looked right.
- **13 of 96 WP slugs differ from Duda's**, because Duda re-slugged from the product NAME while WordPress kept historical slugs (`ex-splitter-box`, `-2` suffixes from re-created posts). Mapped by page title. `COMPACT FILTRATION UNIT` needs an explicit override: the import suffixed its Duda name to `(SAECFU)` to clear a duplicate-title collision, so its WP title now normalises onto the *other* product.
- ⚠️ **`--only` must never write the aggregate file.** It writes the whole map, so a scoped run replaces every link with the one or two it looked at — `--only nothing` truncated it to `{}` exactly once.

**`CompatibleLink` was rebuilt on HubProduct ids.** It previously held a `relatedSku` string with no relation, no foreign key and no cascade — and SKU cannot identify a product here: 3 of the 96 have none and 4 SKUs are shared by 9. The table was empty and unused, so it was replaced outright. Both sides cascade, because a link to a deleted product is meaningless. Self-links are dropped rather than rejected (5 existed in WordPress).

⚠️ **`HubProduct.thumbnailUrl` mirrors Duda's `images[0]`**, like `sku`/`name`/`slug` already do. The carousel must show a thumbnail for a product OTHER than the one on the page, and `/public/products/content` must never call Duda on the request path. A gallery saved in the Hub refreshes it at once (`PUT /images` calls `syncHubProduct`); a gallery changed in Duda's own admin stays stale until the product is opened or saved in the dashboard, or `npm run hub:sync-mirror --workspace=backend -- --confirm` runs (which covers every product, unlike the import's `--sync-hub`).

⚠️ **`--sync-hub` used to short-circuit on `slug` alone**, so the moment a new mirrored column was added it reported "96 already correct" and backfilled nothing. It now checks every mirrored field. **Add any future mirrored column to that check**, or the repair pass silently repairs nothing.

**Audited 2026-09-11, 0 findings.** All 76 scraped products compared against stored links in order (286 links, 0 order mismatches); no self-links, no duplicates, dense `sortOrder`, no dangling references; all 55 linked products have both a slug and a thumbnail, so every card can render. Both FK cascades and the unique constraint were proven on a **throwaway** product pair, per the repo's verification policy — deleting a product removes its inbound links as well as its outbound ones. Shape: 75/96 products have links, median 3, max 17 (`ex-led-vessel-entry-kit`). 182 of 286 links are one-way, which is a content choice rather than a defect — these were curated by hand in WordPress.

⚠️ **The carousel owns its own vertical padding** (8% mobile / 6% tablet / 3% desktop, top and bottom), so **Duda's element padding must be set to ZERO**. Not cosmetic: a product with no compatible items renders nothing and the mount collapses, but padding living on the Duda section would survive as a visible empty band — the exact thing collapsing is meant to avoid. Percentages resolve against container WIDTH, so the spacing scales with the layout.

The heading is an `h3` (`.saeh-cp-h`) — sentence case, centred, 20px above the cards. Deliberately **not** `.saeh-h`, which is the uppercase, left-aligned, yellow-ruled heading the in-page sections use. The section also joins the accordion in opting out of `.saeh-root`'s 920px cap; capped, its four cards filled only ~60% of a full-width Duda section.

**The carousel** is CSS scroll-snap, not a JS slider: card width is `calc((100% - gaps) / n)` at **1 / 3 / 4** up (mobile / 561px / 881px) — mobile is one full-width card, because a phone-sized card at 2-up leaves the product name and button too small to use, so the browser owns layout and a resize needs no recalculation. `flex:0 0 <w>` means cards never grow or shrink, which is what makes a short row keep its card width instead of stretching. Arrows and track are a **flex row**, not arrows absolutely positioned over the track: structurally they cannot overlap a card, and when hidden they occupy no space so the track simply widens. Card width is a percentage OF THE TRACK, so showing or hiding an arrow never changes how many cards fit — the measurement cannot oscillate. ⚠️ `justify-content:safe center` centres the cards when they fit and falls back to start when they overflow; plain `center` would centre an overflowing track too, putting the FIRST card out of reach and unscrollable.

⚠️ **On mobile (≤560px) the arrows move BELOW the track**, centred, so a card gets the full width rather than losing ~108px to two buttons and their gaps — nearly a third of a 375px row. Done with `flex-wrap` plus `order`, keeping the DOM order prev/track/next because that is the correct reading order for assistive tech.

⚠️ **Arrow visibility is CSS, not measurement.** `data-count` on `.saeh-cp` carries the card count, and media-query rules hide the arrows whenever that count fits the row — ≤1 mobile, ≤3 tablet, ≤4 desktop. Decided at parse time by the same breakpoints that set the card width.

This **replaced** a `scrollWidth`-vs-`clientWidth` measurement, and the reason matters: measuring is correct in principle but has to run after layout, and when it did not run the arrows stayed in their default state — two live arrows beside two cards with nothing to scroll, on the live site, while the editor looked fine. A rule that cannot run at the wrong time cannot be wrong. The cost is the breakpoints being stated twice (card width, and the hide rules); they sit adjacent for that reason. JS now only sets the `disabled` end-of-travel state, where running late is harmless.

### Stage 3e — downloads (done 2026-10-01)

**176 downloads across 59 products, 126 unique PDFs (98.5MB)**, now in the Hub's private
`product-files` bucket and linked per product in the order the old pages showed them. All
`gated: false`. Two steps, the same scrape-then-import split as compatible products:

```
npm run wp:scrape-downloads --workspace=backend       # → migration/downloads.json
npm run downloads:import --workspace=backend          # dry run
npm run downloads:import --workspace=backend -- --confirm
npm run downloads:import --workspace=backend -- --verify
```

⚠️ **The CSV cannot do this on its own.** `Meta: downloads_<n>_download_file` holds WordPress
**attachment IDs** (`13877`), not URLs, with no title or type. The six named fields
(`download_datasheet`, `_user_manual`, `_brochure`, `_iecex_cert`, `_ex_cert`, `_inmetro`) are
**empty for every product** — only their ACF field keys survive. So the live product page is
the source: each download is a Contact Form 7 block pairing a visible label with a hidden
`your-download` input holding the PDF URL. The page URL is fetched **by wpId** through
`/wp-json/wp/v2/product/<id>?_fields=link`, which sidesteps the 13 slug mismatches the
compatible scraper had to title-map.

⚠️ **The WP REST API is a cross-check, not the source.** `/wp-json/wp/v2/media/<id>` resolves
164 of the 176 references; the other 12 point at 6 attachments whose **metadata returns 401** to
anonymous requests, though **the files themselves download fine**. Its titles are raw filenames,
not what visitors saw. Every attachment it CAN resolve must appear on that product's page.

**Labels are a closed set**, mapped to stored titles and failing on anything unknown:
Datasheet 59, ATEX Certificate 27, User Manual 25, IECEx Certificate 24, UKEX Certificate 20,
INMETRO Certificate 19, Certificate 2. IECEx uses the scheme's own casing.

Traps the scraper had to handle, each of which a real result motivated:
- ⚠️ **A failed fetch must THROW, never read as "no downloads".** The read-only survey that
  preceded it had one page fetch fail transiently and come back empty — recorded as data, that
  silently drops 5 files. The scraper retries, then fails the product by name, and **writes
  nothing at all if any product failed**: a partial file would be read as the whole truth.
- **Bound each item to its own form.** Split on the `<li class="col-lg-6">` alone and the last
  item runs on into the compatible carousel 26KB later.
- **Anchor on the input's `value`.** `name="your-download"` also matches the CF7 wrapper's
  `data-name="your-download"`, so it occurs twice per download.
- `--only` never writes the aggregate file — the trap that once truncated the compatible map.

The import:
- **One MediaAsset per unique file** — 28 range certificates are shared by up to 5 products —
  at `files/wp/<uploads-relative path>`, the same deterministic scheme as `images/wp/`, kept
  with its year/month folders because two files can share a basename. Also archived to
  `migration/downloads/`, so the Hub no longer depends on WordPress for any of them.
- ⚠️ **Each file is checked before it becomes a row**: the `%PDF-` header, its byte count
  against the server's content-length, and the 25MB ceiling. A truncated compliance document
  would upload, list in the editor, and fail only when a buyer opened it.
- ⚠️ **An object that already exists is adopted only if its size matches.** The images
  importer treats "already exists" as success outright; here a stale object under the same
  path would otherwise be attached silently.
- A product whose files did not all upload is **skipped whole** — a partial set is worse than
  none. Rows resolve through the **ledger, never SKU**. `--force` replaces a populated
  product's set and snapshots its rows to `migration/` first.

`@@unique([hubProductId, mediaAssetId])` was added first — safe because no product repeated a
file and the Hub had no Download rows. It makes a re-run safe structurally, and it makes the
**file a natural key within a product**, which the editor's PUT relies on.

### Downloads in the product editor, and the PUT behind it

`DownloadsSection.tsx` — rename, type (and certificate scheme), drag to reorder, remove, add from the Media Centre. Joined to
the unified save (`SectionKey "downloads"`, `downloadsFrom()`, a `project()` case, `validate()`,
a save task). No gated toggle: every file is gated, and a new one is written `gated: true`.

`PUT /api/products/:id/downloads` takes `{items: [{mediaAssetId, title, kind, certScheme}]}` in display order — see "The resources widget" for the type rules.
- ⚠️ **Keyed on `mediaAssetId`, not row ids.** That is what makes it idempotent when a response
  is lost: a retry finds the rows the first attempt created by their file instead of
  re-creating them into the unique index. The unified save requires a retried save to converge.
- ⚠️ **A diff, not delete-all-then-recreate** (unlike specs). A surviving download keeps its
  id, because `Lead.downloadId` is `SetNull` — recreating every row on every save would detach
  every captured lead once gating returns. Deletes run before creates, so removing and
  re-adding a file in one save cannot trip the unique index.
- ⚠️ **`project()` compares only `{mediaAssetId, title, kind, certScheme}`.** The preview URL is re-signed on
  every response; had it leaked into the comparison the section would read "Unsaved" forever
  after any save. Proven: two loads of EX Heater carry different URLs yet project identically,
  and what a save banks equals what the next load reads.

⚠️ **Signing is caught per item** (`services/downloads.ts` `shapeHubDownload`). `/custom` loads
the WHOLE product editor and signed every download inside a `Promise.all`, so one object missing
from `product-files` would have stopped the editor opening at all. A file that cannot be signed
now comes back `url: null` and shows "File missing" on its own row.

### PDF previews (2026-10-01)

Every PDF in the Media Centre has a rendered **first-page preview** — the Media Centre grid,
the file picker and the product editor's downloads all show it, through one shared
`FilePreview` component (`components/ui/FilePreview.tsx`). Anything without a preview (Word,
Excel, ZIP, a GLB, or a PDF that has not been rendered) gets a `FileTypeIcon` labelled with its
format in the colours people already read files by (PDF red, Word blue, Excel green).

- **Stored, not rendered on view.** A Media Centre page shows 24 files and some PDFs are 13MB,
  so rendering live would download tens of MB per page. Previews are 480×680-max **WebP**,
  ~26KB on average — 4–6× smaller than PNG — so a full page loads about 600KB of them.
- `MediaAsset.thumbnailPath` → `thumbs/<assetId>.webp` in the **public** `product-media`
  bucket. Public so the admin grid is not signing 24 URLs per page load. Acceptable while
  downloads are ungated; note a gated file's first page would be reachable by its
  (unguessable) thumbnail path.
- **Two writers, one store.** `services/thumbnails.ts` `storeThumbnail()` is used by both
  `PUT /api/media/:id/thumbnail` and the backfill, so they cannot drift on where previews live.
  A replacement upserts, and a changed format removes the old object rather than orphaning it.
  Deleting an asset removes its preview too.
- **New uploads render in the BROWSER**, at upload time, in `lib/upload.ts` via
  `lib/pdfThumbnail.ts`. ⚠️ Not on the server: rendering needs a ~30MB native canvas, and the
  API is ONE function that also serves the whole dashboard and the public widget, so every cold
  start would pay for it. The browser already holds the bytes. pdf.js (~1.7MB with its worker)
  is imported **lazily**, only when a PDF is uploaded — verified absent from the main bundle.
  ⚠️ Best effort: the file is already stored when the preview runs, so a PDF pdf.js cannot
  parse must never turn into a failed upload; it falls back to the icon.
- **Imported files were backfilled** by `npm run media:pdf-thumbnails --workspace=backend`
  (dry run by default, `--confirm`, `--force` to re-render, `--only <assetId,…>`): 126/126,
  0 failures. It reads the local archive in `migration/downloads/` when present, the bucket
  otherwise. Run it again to cover any upload whose browser render failed.
- ⚠️ **Raw image bytes, not JSON.** `express.json()` runs globally with its 100KB default ahead
  of every route, so a base64 preview could be refused before reaching the handler — and base64
  adds a third besides. The route takes `express.raw` and **sniffs the bytes**: a browser that
  cannot encode WebP silently returns PNG from `canvas.toBlob`, so the client's type is not
  trusted, and the server accepts WebP, PNG or JPEG by their magic numbers.
- ⚠️ **The renderer lives in `scripts/lib/renderPdf.ts`, a module with no side effects.** It
  first lived in the backfill script, which runs `main()` on import — importing the renderer
  from there executed the whole script, including its `finally` that disconnects the shared
  Prisma client. And it must never be reachable from server code: `@napi-rs/canvas` and
  `pdfjs-dist` are backend **devDependencies** — now enforced on every build by
  `scripts/check-api-bundle.mjs`, which denylists both.
- pdf.js v6 dropped `isEvalSupported` and moved `destroy()` onto the loading task — the v4/v5
  examples you will find elsewhere do not compile against it.

⚠️ **`GET /api/media` now signs file URLs per item** (`urlOrNull`). It signed every file inside
a `Promise.all`, so one object missing from `product-files` would 502 the whole Media Centre
page — the same all-or-nothing failure fixed in `/custom`. Harmless at 0 files, not at 126.

### Audit of the downloads work (2026-10-01)

Code review across the whole run (scrape → import → PUT → editor → previews → export) raised
**10 findings; 9 fixed, 1 accepted.** Each was checked against reality before fixing:

| Finding | Reality | Fix |
|---|---|---|
| Two URLs sanitise to one storage path, and the second silently adopts the first's file | latent — the 126 map to 126 distinct paths | hard failure naming both, before any write; proven on a crafted pair |
| A literal `%` makes `decodeURIComponent` throw and abort the whole import | latent — no URL contains `%` | `safeDecode`; proven on a crafted file |
| An existing row at the path was adopted without checking it is the same file | latent | adopted only if its size matches |
| `MediaAsset.url` became nullable but was still typed `string` | real — 7 consumers | typed `string \| null`; images guarded before Duda fetches them; files show "File missing" |
| `FileTypeIcon`'s size override lost to its base on stylesheet order | real — width lost | default size only when none is passed |
| GET/POST/reorder/PATCH used a second, non-resilient download shaper | real | built on `shapeHubDownload` |
| An upload waited on the best-effort preview, forever if pdf.js hung | real | bounded at 8s; the render carries on in the background |
| The export dropped a top-level category assigned on its own | real | same leaf rule as the listing |
| A PDF that failed to parse never destroyed its pdf.js task | real, no impact (0 failures) | awaited inside the `try` |
| The export ran two count queries in a second round trip | real | one wave |

**Accepted, not fixed:** the editor's PUT removes a download without the `has_leads` 409 that
`DELETE /downloads/:id` still enforces. Revisited when gating returned (2026-10-05) and left:
`Lead.downloadId` is `SetNull`, and each request now snapshots the file name, title, product
and product id, so a request outlives its download with nothing lost but the link — Resource
Requests marks it "Since removed".

**Data, reconciled independently** of the import script: 176/176 rows match the old pages by
title, file and order, all ungated; 126/126 files present at the right size and
**byte-identical (SHA-256) to the archive**; 0 unlinked files, 0 duplicate (product, file), 0
previews on non-files, 0 leads.

**Security, probed live**: the three new admin routes return 401 with no credentials and with a
forged token; a private PDF returns 400 fetched directly, with or without a valid anon key; and
an anonymous LIST of either bucket returns nothing — `thumbs/` holds 126 objects yet lists
empty, so it is policy, not an empty folder, and preview paths are genuinely unguessable.

⚠️ **Supabase Storage has its own database connection pool, and a bulk script can exhaust
it.** ~380 *sequential* storage calls (info + download per file) failed partway with
"Too many connections issued to the database" — from Storage, not from Postgres directly.
Nothing the app does comes close (the busiest page signs 24), but **any script that walks the
buckets must pace its calls** and retry that specific error with backoff.

### ⚠️ Downloads are withheld from the public payload

`/public/products/content` returns **`downloads: []`** (since 2026-10-01). No public widget
shows downloads now, and serving them cost three things for nothing: every content request
signed every file URL on the public hot path; the signing ran inside `Promise.all`, so **one
missing object 502'd the product's whole payload** — tabs, logos, 3D and compatible with it;
and the legacy `data-section="all"` embed still includes downloads in its expansion, so the
import would have put 176 files on any live page carrying one. The key stays as an empty array
so widget code that reads it cannot throw.

⚠️ **Deploy the guard BEFORE running the import against production.** On 2026-10-01 the
import was run while the `downloads: []` change was only committed locally, so for ~15 minutes
the deployed endpoint signed and served all 176 files — the exact cost the change exists to
prevent. Harmless this time (no live widget renders downloads, and they are ungated anyway),
but the order generalises: when a data import changes what a public endpoint would serve,
push and confirm the endpoint change first, *then* write the data.

**The resources widget is that separate path** (2026-10-02): `/public/resources` carries no
file URLs and `/public/downloads/:id/file` signs one file per click — see "The resources
widget". The content endpoint still returns `downloads: []`, and the old `downloads` section in
`widget.js` (still in `ALL_SECTIONS`) should be removed in phase 2 rather than revived as-is.

### Notes for any further import from the export

Every content stage is imported (logos, downloads and the rest above). For anything else read
from the CSV: use `acfRepeater()` — ACF exports each repeater row as `Meta: <name>_<n>_<field>`
**plus** a `_`-prefixed mirror holding the internal field key, which must be ignored or every
value doubles.

Two expectation-setters: **`_wp_desired_post_slug` is empty for all 96** (Duda auto-slugs from the name instead, which has matched the WordPress slugs so far — but the public widget resolves by slug, so any redirect work needs the live sitemap while it's still up), and **Yoast SEO was barely populated** in WordPress (title on 4/96, meta description on 12/96) — so SEO titles and descriptions were authored rather than migrated. See the SEO section below.

### Product name casing (fixed 2026-09-11)

20 of the 96 product names were entirely upper case and are now sentence case, in **Duda** (the source of truth for `name`), via `npm run duda:fix-casing --workspace=backend -- --confirm`. Preview without `--confirm`.

⚠️ **Verified before writing: a case-only rename does NOT change Duda's auto-generated `seo.product_url`.** Probed on a throwaway product — created one SHOUTING, renamed it to sentence case, slug unchanged, deleted it. Had the slug tracked the name, this would have silently changed 20 public URLs and 404'd every link to them. **Re-probe before any bulk rename that changes words rather than just case** — that is a different question, and the answer may well differ.

⚠️ **Only ENTIRELY upper-case names are touched.** The other 76 are already styled, and a title-caser over them would capitalise the deliberate lower-case words in e.g. "Free Airflow (with 30cm Connectors)".

Acronyms are **learned from the catalogue, not hard-coded**: all-caps tokens inside already-styled names (the house style stating itself — `EX`, `LED`, `LEV`, `PU`, `PVC`, `KVA`) plus **every SKU**, because a product code in a name is a code. That second source is load-bearing: `COMPACT FILTRATION UNIT (SAECFU)` carries its SKU to clear a duplicate-title collision, and `SAECFU` appears in no styled name, so the first source alone produced "Saecfu". Tokens containing a digit are kept verbatim (`3.8KVA`, `400VA`).

Verified after: 0 products still upper case, 0 name drift between Duda and `HubProduct`, 0 slug drift.

## Categories (added 2026-09-11)

Product↔category assignment is **Hub-side**, edited from the product editor's right-hand column and from each category's own page.

⚠️ **Duda has no working product-side category assignment, and it fails SILENTLY.** `PATCH /products/{id}` with `categories` (or `category_ids`, in either the `["id"]` or `[{id}]` shape) returns **200 and changes nothing** — the product still reports `categories: []`. Probed on throwaways. The only path that works is `PATCH /categories/{id}` with `{products:[{id}]}` — note `[{id}]`, not `["id"]`, which 400s on shape — and that array is full-replacement.

So writing a product's categories to Duda would mean rewriting every affected category's entire product list on every save: N+M calls, and a race two editors lose silently, since Duda has no optimistic concurrency. **Josh chose Hub-side storage (2026-09-11).** The category LIST still comes from Duda, so names and nesting are always Duda's.

⚠️ **Re-probed 2026-09-29, and the earlier conclusion was too pessimistic.** Writing via
`PATCH /categories/{id}` with `{products:[{id}]}` is **visible in both directions**: the
category reports `products_count`, and the PRODUCT's own `categories` array then lists the
category. Verified on a throwaway category with two products, then deleted. So Duda's
storefront and its navigation picker *can* be driven from these links — the original
objection was only ever to doing the write on every product save, and it does not apply to
a batch sync — which is what `duda:sync-categories` does (live in Duda since 2026-09-30). Between
runs the two can differ, which is why the dashboard shows the Hub's own counts.

- `ProductCategory` stores `dudaCategoryId` with **no foreign key** — categories live in Duda, so a category deleted IN DUDA leaves a row pointing at nothing (one deleted through the Hub has its links removed — see "Deleting and moving a category").
- The product-side `PUT /api/products/:id/categories` **rejects unknown ids** rather than dropping them, so a stale editor tab cannot quietly save fewer than it displayed, and `project()` compares the set **sorted**, so ticking A then B is not a change against a baseline that loaded B then A.

(Tags, TagGroups and `/tags` were retired on 2026-09-29 — see "Tags — retired". Categories replaced them.)

### The category picker (`AssignPickList`)

- ⚠️ **`AssignPickList` never reorders as you tick** (changed 2026-09-30). Selected items used to be pinned to the top, which is fine for a flat list and wrong for a tree: a ticked child jumped above its own parent, so the indentation pointed at nothing and the row you just clicked moved out from under the cursor. Position is how you find a category again.
- **`AssignPickList` shows a thumbnail only when the caller supplies one** (`PickItem.imageUrl`).
  The categories picker has none, and a column of empty placeholders is worse than no column.
  ⚠️ The image goes INSIDE the `Checkbox` label, so the row stays one click target rather
  than the thumbnail becoming dead space beside the checkbox.
- **"Only show selected"** appears with the search, on the same `searchThreshold` — a list
  short enough to read whole needs neither. ⚠️ It is not reset when the last item is
  unticked: that leaves an empty list with the toggle still on, which is honest, whereas
  flipping it back would be the control changing itself under the cursor. The empty message
  distinguishes "nothing selected yet" from "nothing selected matches that search".
- ⚠️ **A child can never be selected without its parent, in BOTH directions** — ticking one ticks its ancestors, unticking a parent unticks everything beneath it. Half the rule leaves exactly the state it exists to prevent: tick a child, untick its parent, child orphaned. Driven by `PickItem.parentId`; items without one behave as a flat list. Anything in `selected` that is not in `items` (a category deleted in Duda) is carried through untouched, since dropping it would be an edit the user never made. The server enforces the same rule (`withAncestors()`), so it holds for every way in.
- ⚠️ **Top-level order is `TOP_LEVEL_ORDER` in `services/categoryTree.ts`** — Products, Site Challenges, Industries — applied through `categorySortKey()` by both the dashboard tree and the public listings. Duda has no `sortOrder` on a category and its own list order is creation order (newest first), which put Products last. Unlisted parents keep Duda's order after the listed ones, so renaming a parent demotes it rather than breaking the list. It never touches Duda: the megamenu's column order is still arranged in Duda's own menu editor.

### The category tree drives navigation (2026-09-29)

Three top-level parents — **Products**, **Industries**, **Site Challenges** — with the
product taxonomy adopted under Products and one child per former tag beneath the other two.
23 categories in total. Built by `npm run duda:seed-category-tree --workspace=backend`
(dry run by default, `--confirm` to write, `--verify` to print the live tree).

**Why categories rather than tags for the megamenu**: Duda's navigation widget picks
categories natively, so the client builds menus from a list instead of hand-typing URLs to
a collection-backed page, and every listing page is a real indexable URL with SEO fields the
Hub already edits.

⚠️ **The children were derived from the Hub's tags, not hardcoded**, so the names matched what
had been authored and each tag mapped to its category by title when tags were retired.

⚠️ **Category order within a parent is Duda's own list order, which is newest-first.** There
is no `sortOrder` on a category and the API exposes no way to set one, so the megamenu's
column order has to be arranged in Duda's menu editor. The Hub's own screens and listings use
`CategoryOrder` instead — see "Drag-reorder".

⚠️ **A category's slug CANNOT be derived from its title.** Measured across all 23: Duda
renders `&` as **three hyphens**, so "Oil & Gas" is `oil---gas`, not `oil-and-gas`. Nine of
the 23 are affected. Deriving them would have broken the listing widget's URL fallback on
exactly those categories, silently — the same shape as the `aviation` → `aviation-and-aerospace`
break. The slug also does not appear in `listAllCategories()` at all; only the
single-category GET carries it, which is why it is mirrored rather than fetched per request.

(Worth knowing separately: `/category/oil---gas` is a poor public URL for a commercial
landing page. The Hub's category editor can override `seo.url`.)

### `CategoryMirror` — the local copy of Duda's tree

`dudaCategoryId, title, slug, parentId, position`. Refreshed by `duda:sync-categories` from
the per-category GET it already makes. Exists so `/public/catalogue` is a pure Hub read:
building the tree on the request path would cost one Duda call per category, and the rule
that public endpoints never call Duda on the request path is what keeps them fast.

⚠️ Goes stale if a category is renamed or moved IN DUDA without re-running the sync, exactly
like `HubProduct.thumbnailUrl`. Creates, renames, moves and deletes made through the Hub write
the mirror themselves (`mirrorImage()` and the delete route).

### `GET /public/catalogue`

Every product with its `categoryIds`, plus the tree — **one response, filtered client-side
by the listing widget**. 96 products is ~25KB measured, and it buys instant filtering with
no round trip per checkbox. The product card shape is identical to `compatible` and
`by-category`, so one renderer serves the carousel and the grid. HIDDEN products are left out
(`LISTABLE`) and categories come in the dashboard's order (`categorySortKey`). Revisit only if the catalogue
reaches the thousands.

### `npm run duda:assign-product-types --workspace=backend`

Derives each product's **product type** from the WooCommerce export and writes `ProductCategory`
rows. Dry run by default. Result: **96/96 — 46 Lighting and Power, 39 Fume/Dust/LEV/Vapour,
11 Climate Control and Heating**, plus every product linked to the **Products** parent (192
links). Live in Duda since 2026-09-30.

⚠️ **Product types ONLY.** Industries and Site Challenges have no equivalent in the export —
"Welding Fume Control" appears nowhere in the source data — so those stay manual.

⚠️ **The Hub row is resolved through the LEDGER (wpId → dudaProductId), never by SKU.** SKU
cannot identify a product here: 3 of the 96 have none and 4 SKUs are shared by 9. The earlier
SKU-keyed version silently collapsed each pair onto one row, assigning one twin twice and the
other never, with nothing in the output to show it.

Two sources, in order:
- **The WooCommerce product category** (`Portable EX Lighting`, `Portable EX Heating`…) — 70
  products. Rental variants fold into the same type; hire-vs-purchase is not this axis.
- **The SA range**, for the 26 whose WooCommerce categories carry only industry sectors —
  Lumin/Powernet → Lighting, Cyclone → Fume, Flexiheat → Climate. It reuses `saRangeLogos()`
  rather than re-deriving the matching, which is also how the 2 SKU-less Tasklights get a type
  (through that function's existing overrides). `Rental` is ignored: it is orthogonal to the
  ranges and says nothing about what a product IS.

⚠️ **SA ENDURE is the one range that is NOT a product type** — it is the non-EX/general-industrial
line and spans both lighting (Worklamp, Tubelight) and extraction (Air Mover, LEV systems), so
its 11 products need an explicit `ENDURE_TYPE` entry keyed on wpId. An ENDURE product missing
from that map is a **hard failure**, not a keyword guess, so a new one must be classified
deliberately. Both branches also fail if a product maps to two types; none does today.

⚠️ **Every product is linked to the `Products` parent as well as its type.** The listing widget
does not need this — it already scopes a parent page to the parent plus its children — but
without it Duda's own `products_count` and storefront read 0 under Products.

The delete-then-recreate is scoped to the four categories this script owns, so an Industry or
Site Challenge ticked by hand is never cleared.

### `/categories/:id` — the category edit page

⚠️ **A PAGE, not a modal, and the image is why.** Choosing one opens `MediaPicker`, and a
picker inside a `Modal` is two independent overlays: **`Modal` closes on Escape and
`MediaPicker` has no Escape handler at all**, so Escape dismissed the form *underneath* the
open picker. Both are `z-50` and only `Modal` portals to `<body>`, so the picker also
rendered behind it. The layering was one line; the focus trap, the scroll lock
(`Modal` sets `body.style.overflow` and restores it on unmount) and the Escape ambiguity
were not. **The create modal survives** because it asks for a name and a parent and opens
nothing — it then navigates straight to the page.

70/30, matching the product editor. Left: info, products, subcategories. Right: image, SEO.

- **Category products** writes through `PUT /api/categories/:id/products` — Hub-side, like
  the product-side route, so `duda:sync-categories` still pushes it.
- ⚠️ **That write is scoped to the ONE category.** It adds and removes links for `:id` and
  touches nothing else the product is in; rewriting each product's whole set from here would
  silently clear the Industries and Site Challenges assigned from the product editor.
  Verified on a throwaway product.
- ⚠️ **`withAncestors()` (`services/categoryTree.ts`) now runs SERVER-SIDE on both routes.**
  "A product is never in a child without its parent" was enforced only by the editor's
  picker; with two ways in and stale tabs replaying old sets, a client-side-only rule holds
  for none of them. Removing a product from a parent also clears that parent's whole
  subtree — the other half of the same rule, which the category direction would otherwise
  break. The reverse is NOT true: a product may sit in a parent with no child, so removing
  it from a child leaves the parent alone.

### The Categories tree: image, drag-reorder, click-to-edit

- **Category image.** `PATCH /categories/{id}` with `{image:{url}}` makes Duda **fetch the
  file and re-host its own copy** on `irp.cdn-website.com`, exactly like a product image — so
  the Media Centre original can change or be deleted later without breaking the page. A bare
  string instead of `{url}` 400s.
- ⚠️ **A category image CANNOT be removed once set.** Probed 2026-09-30: `image: null` is
  accepted and silently ignored, and `{url:""}`, `{}` and `{url:null}` all 400. The UI
  therefore offers **Replace, never Remove** — a button that did nothing would be worse than
  its absence.
- The image is only re-sent when it **changed**. Re-sending the current URL makes Duda
  re-fetch and re-host the same file, orphaning the previous copy on its CDN.
- `CategoryMirror.imageUrl` exists so the list can show a thumbnail without a Duda call per
  row — `listAllCategories()` omits the image and only the single-category GET carries it.
  Written by `duda:sync-categories` and by the dashboard's own create/update, so it is fresh
  the moment someone sets one.
- **Clicking the title opens the category's edit page** (`/categories/:id`) — it is what you
  click when you mean "open this"; the ⋯ menu keeps the other actions.

### Deleting and moving a category (fixed 2026-10-02)

⚠️ **Duda does NOT delete subcategories with their parent.** Measured on throwaways: the
direct children are **promoted to the top level** (`parent_id` → `ROOT`) and grandchildren
stay under them. The delete confirmation used to say the subcategories were deleted, and the
Hub's mirror kept them under a parent that no longer existed. `DELETE /categories/:id` now
re-mirrors the promoted children as top level, clears their dragged positions (which ranked
them among their old siblings), and removes the deleted category's own product links, which
used to linger as "no longer in Duda". It still 409s without `?confirm=true` when there are
children, and the warning now says where they go.

⚠️ **A move (PATCH with a different `parent_id`) adds the NEW ancestors** to every product
in the moved subtree, so "never in a child without its parent" survives it. The old ancestors
are deliberately left — a product may sit there for its own reasons. ⚠️ **"Moved" is a
comparison with the parent before the write, not the presence of `parent_id`**: the edit page
sends it on every save, and treating every save as a move would wipe the category's dragged
position each time.

**Category slugs are validated** (`^[a-z0-9-]+$`, non-blank) server- and client-side. The
public listing matches the slug lower-cased against the mirror, so an uppercase one would
silently empty that category's page. All 23 pass.

**`/categories/:id` has the unsaved-changes guard** the product editor has — it had none.

### Drag-reorder, and why the page is no longer a `<table>`

⚠️ **Duda has NO ordering field on a category, and the probe is the point** (2026-09-30):
`position`, `order`, `sort`, `sort_order`, `index`, `rank`, `priority` and `display_order`
are **every one silently accepted** on PATCH and every one echoes back `null`. Duda ignores
unknown keys, so an attempt to store order there would look exactly like it had worked.
Order therefore lives in `CategoryOrder` (Hub-owned). It drives the dashboard **and the
Hub's own public listings** — the catalogue widget's filter list and the dropdown in Duda's
editor — but never Duda's storefront or the megamenu.

⚠️ **One ordering rule, `categorySortKey()` in `services/categoryTree.ts`**, used by both the
dashboard tree and `/public/catalogue` (dragged position → `TOP_LEVEL_ORDER` → Duda's list
order). The public side used to sort by the mirror's Duda position only, so a drag changed the
admin screen and nothing on the website — latent when fixed, since no category had been
dragged. The refactor was checked against the old code on live data: the dashboard tree is
identical, all 23 rows.

⚠️ **`CategoryOrder` is a separate table, not a column on `CategoryMirror`.** The mirror is a
read-through cache refreshed wholesale by `duda:sync-categories`; an order set by hand must
not be erased by a cache refresh.

⚠️ **The rule "a subcategory cannot move to another top-level category" is STRUCTURAL.** The
tree renders as two nested `SortableList`s, and each renders its own `DndContext` — so a drag
started among a parent's children can never land in the top-level list. The server also
rejects an id set that is not exactly that parent's children, but that is belt and braces for
a stale tab, not the mechanism.

⚠️ **That nesting is why the page is a grid, not a `<table>`.** A table gives one `<tbody>`
per sortable context, and a tree needs the parent row and its children in the same visual
sequence but different contexts — which multiple tbodies cannot express.

Ordering within a parent falls back, most specific first: a Hub position, then
`TOP_LEVEL_ORDER`, then Duda's own list order — expressed as a sort key, so the order is total
even across parents and anything with no rule keeps Duda's relative order.

### `npm run duda:category-seo --workspace=backend`

Fills every category's `seo.title` with its own name. Dry run by default; `--force` to
overwrite a human-set title. Applied 2026-09-30: **23/23, 0 failures, 0 slugs lost.**

⚠️ **A category's `seo` is FULL REPLACEMENT** — unlike a *product's*, which was probed and
found to merge. Sending `{title}` alone blanks `url` and Duda rejects with "Category page url
cannot be blank", so the current `seo` is read and merged, never assumed. `seo` also only
comes back from the single-category GET, so one read per category is unavoidable rather than
an N+1 that could be batched away.

### `npm run duda:sync-categories --workspace=backend`

Pushes `ProductCategory` rows into Duda, **one call per category** rather than per product,
because `PATCH /categories/{id}` takes the category's whole product list. Dry run prints the
diff; `--confirm` applies.

⚠️ **One-way, Hub → Duda.** Duda's copy is overwritten wholesale each run, so an assignment
made in Duda's own admin is lost at the next sync. Change them in the Hub — the product
editor's Categories panel or a category's own page.

Verified end-to-end on throwaway assignments, then reverted: staging two Hub assignments and
syncing made Duda report `products_count: 2` **and** made the product's own `categories`
array list the category; a second run was a clean no-op; removing the Hub rows and
re-syncing emptied both sides.

### Product editor layout

70/30 two-column (`lg:grid-cols-10`, 7 + 3). Left is the product; right is classification. **Grid, not flex**, so a long accordion opening on the left cannot drag the right column's panels down.

⚠️ **Details and Description are deliberately NOT collapsible** — they are what you came to edit, and hiding them behind a click buys the least valuable scroll at the cost of the most common task.

`AccordionCard` **unmounts** its body when closed rather than hiding it: these bodies are not cheap (the compatible picker fetches the whole catalogue, the 3D section mounts a `model-viewer`), and twelve open at once is what this change exists to avoid. It also **opens itself when a section becomes dirty or errors, and only on that transition** — always-open-while-dirty could never be collapsed again. A collapsed section still shows an **Error / Unsaved badge** in its header, because an editor that can hide a failed section without trace is how you lose work.

⚠️ **The section's error is printed ONCE, by the accordion.** Every section renders `SectionError`, which stays silent inside an accordion body (context, like `Card`); before that, each failing section showed the same sentence in two boxes, one above the other.

⚠️ **A section's `CardHeader` renders ONLY its actions inside an accordion.** The accordion header already carries the title, dirty badge, summary and description, so the section's own header repeated all of it — the same sentence twice, each with a bottom margin.

⚠️ **`AccordionCard` declares its own card chrome instead of using `<Card className="p-0">`.** `cn()` is a **plain string join, not tailwind-merge**, so `p-0` landed in the class list *alongside* Card's `p-5` and lost on stylesheet order — leaving 22px of padding wrapping every accordion, header included. **Any `w-*`/`p-*`/`text-*` passed to a UI component can silently lose to that component's own base class.** Either swap `cn` for `tailwind-merge` (one dependency, fixes it everywhere — but existing overrides that are currently no-ops would start applying, so it needs a pass) or express the intent as a real PROP, which is the only form that cannot lose.

⚠️ **This trap has now bitten six times**, so prefer a prop over a class the moment a component fights you:

| Override | Lost to | Fixed by |
|---|---|---|
| `w-56` on an `Input` | its `w-full` | sizing the wrapper |
| `hidden` attribute | a `flex` utility | — |
| `p-0` on `Card` (AccordionCard) | `p-5` | own chrome |
| `p-0` on `Card` (Categories, ProductOptions) | `p-5` | **`padded={false}` prop** |
| `border-0` on `Table` | nothing — landed on the wrong ELEMENT | removed |
| `h-9 w-7` on `FileTypeIcon` | its `h-10 w-8` — height won, **width lost** | default applies only when no size is passed |

That last one is a different failure and worth knowing separately: **`Table` draws its border on its WRAPPER div while `className` goes to the inner `<table>`**, so `border-0` was never going to reach it. And because `Table` is already a bordered, rounded surface, **a `Table` must not be wrapped in a `Card`** — that is a literal box inside a box, which is what it looked like on Users, ProductOptions and Categories. `Card padded={false}` is for flush content that has no chrome of its own, like the category tree's grid.

⚠️ **`Card`/`CardHeader` render bare inside an accordion, via React context** (`AccordionBodyProvider`). Every section renders its own Card, so nesting would draw a card in a card and print the title twice. The alternative was threading a `bare` prop through eight unrelated section components; the accordion already knows, so it tells them.

### SEO titles and descriptions (written 2026-09-11)

`npm run duda:seo-fill --workspace=backend -- --confirm` writes `seo.title` and `seo.description` for every product, generated from the product's own content. Preview without `--confirm`; `--force` to overwrite. **Existing values are never overwritten without it** — anything a human wrote beats anything generated.

Result: 96/96 both fields, **0 duplicate titles, 0 duplicate descriptions**, 0 descriptions outside 70-160 chars, 1 title over 60 (a 62-char product name, left whole).

⚠️ **A product's `seo` is NOT full-replacement — this was probed, not assumed.** Sending `{title}` alone preserves `product_url` *and* an existing `description`. That mattered enough to test on a throwaway first: `seo.product_url` is the slug the public widget resolves by and the live page URL, so a full-replacement field would have 404'd all 96. Note this **contradicts the defensive rule the editor follows** ("send `seo` whole whenever any sub-field changed") — the editor isn't wrong to be careful, but a bulk write doesn't need to be, and not sending `product_url` means it cannot change a URL by accident. Verified after: 0 products without a slug, 0 hub/Duda drift.

Rules the generator follows, each of which came from a bad first draft:
- **Title** is `{Name} | SAEquip`, dropping the brand when the name alone fills 60 chars. Product name first because it *is* the search term; long names are left whole rather than chopped, since Google elides more gracefully than a hard cut.
- **The product name must appear in the description**, matched on ≥70% of its significant words rather than as an exact substring. Exact matching produced "Trolley for EX Heater. Trolley for SA FLEXIHEAT EX Heater." — the name was there, just with the range name inserted mid-phrase.
- **Boilerplate sentences are skipped** ("Disclaimer:", "Please note", "Sales Team will confirm…") unless they are the entire description. Five products led their meta description with a caveat otherwise.
- **Short accessory copy gets a context sentence** rather than shipping an 40-char fragment.
- **A final de-duplication pass** disambiguates by SKU. Before the name rule, five products shared a description verbatim — several "Purchase Only" items with identical disclaimer text — which search engines treat as duplicate content.

### The products listing (`/products`)

Columns are Product / SKU / Status / **Categories** — price and variation count were
dropped (2026-09-30): both live on the product page, and neither is what you scan a
96-row list for now that assignment is the active work.

- ⚠️ **Category ids come from the HUB, never Duda's `categories` array on the product.**
  The Hub is the source of truth; Duda's copy is only as fresh as the last
  `duda:sync-categories` run, so reading it would show a listing that disagrees with the
  editor. One `findMany` for every product's links — a per-product query here is the trap
  that made `GET /api/media` take 7s after the import.
- **Titles are joined in the BROWSER** against `/api/categories`, which the page already
  needs for the filter dropdown. That keeps names fresh without a second Duda call inside
  the products route, and the categories fetch is a *soft* dependency — if it fails the
  table still renders and the column goes quiet.
- ⚠️ **A category that is the PARENT of another selected one is not shown.** Every product
  carries "Products" as well as its type, and printing both says nothing the child does
  not. A top-level category selected alone still shows.
- `ProductCategory.dudaCategoryId` has no foreign key, so a category deleted in Duda leaves
  rows pointing at nothing. Those collapse into one red "N no longer in Duda" chip.
- The filter's **parent matches everything beneath it**, so picking "Site Challenges" is not
  an empty result just because products sit on the leaves.
- ⚠️ **The categories tree's Products column is the HUB's count, not Duda's
  `products_count`.** The two differ by design between syncs — assignment happens in the Hub
  and `duda:sync-categories` is manual — and showing Duda's made the tree report a product
  the category page then could not find, because that page and the public widget both read
  the Hub. A small dot marks a category whose Duda count differs, so a pending sync is
  visible rather than silently wrong in whichever direction. One `groupBy` for every count,
  never one per category.
- ⚠️ **The filter and sort are `SelectMenu`, not a native `<select>`.** A browser draws an
  option list with OS chrome that no CSS reaches, so a 23-item category tree dropped an
  unstyled, unbounded list over the page. `SelectMenu` portals to `<body>` (any ancestor with
  `overflow` clips an absolute sibling, and no z-index fixes that), flips above when it will
  not fit below, caps at 320px and scrolls, and indents by `depth` so the tree survives a
  truncated label.
  ⚠️ **Its close-on-scroll listener must ignore scrolls from inside the list.** A
  capture-phase `scroll` handler sees the menu's own scrolling too, so without that check the
  list closes the moment you scroll it — the reason `DropdownMenu`'s simpler version cannot
  just be copied. The flip decision also uses the CAPPED height, or a 23-row list flips
  upwards for a height it will never have.
- ⚠️ **Fixed control widths only from `sm` up.** The three controls total ~530px, which ran
  clean off the side of a phone. Below `sm` the search takes the full row and the two menus
  split the next one (`flex-1 min-w-0`), so nothing overflows and nothing is squeezed to
  unusable. `SelectMenu`'s portal clamps its own width to the viewport for the same reason —
  its 200px minimum has to yield to the upper bound on a narrow screen, or the floor pushes
  the list off the edge it was meant to stay inside.
- ⚠️ **Toolbar controls use `size="xs"`** (32px box, 14px type). Pick a density rather than
  passing `text-small` through `className`: `cn()` is a plain string JOIN, so the override
  lands beside `fieldSizes`' own `text-body` and the winner is stylesheet order — the same
  trap as `w-56` on an Input and `p-0` on a Card.

### ⚠️ Duda product ids are ULIDs — that is the only creation date there is

`GET /products` returns **no date field**, and `HubProduct.createdAt` is when the Hub row was
written — for the whole catalogue that is the 2026-09-29 database rebuild, not the import.
So "Recently added" decodes the timestamp out of the id: a ULID's first 10 characters are a
48-bit millisecond value in Crockford base32.

Verified against `migration/ledger.json`, not assumed: for **95 of the 96** imported products
the decoded time is within ~200ms of the moment the importer recorded the create, and always
fractionally earlier. The single outlier is `COMPACT FILTRATION UNIT` at +76s — the product
that hit Duda's duplicate-title rule and was created on a retry — so it corroborates rather
than contradicts. `createdFromUlid()` returns null for anything that is not a ULID and the
route falls back to the Hub row.

### Loading states: skeletons on list pages, spinner elsewhere

`Skeleton` (`components/ui/Skeleton.tsx`) is **just the primitive**; each page composes its
own from the same `Table`/`Card`/grid components the real content uses, so the two cannot
drift. A generic "table skeleton" would have to be told the column widths anyway, and would
become a second place to keep them right.

⚠️ **A skeleton only earns its place if it occupies the SAME space the real thing will** —
the point is that nothing moves when the data lands, so a differently-sized placeholder is
worse than "Loading…" text, because it shifts the page as well as delaying it. The product
table's placeholder thumbnail is 100px because the real one is.

Applied on the list pages, which have a repeating structure to mimic: **Products**,
**Categories**, **Quotes**, **Media**, **Logos**.

⚠️ **A skeleton is for the FIRST load, never for paging.** `useMediaLibrary` exposes
`isInitialLoad` (`loading && data === null`) alongside `loading` for exactly this. Gating the
grid on `loading` unmounted it on every page click — the Media Centre dialog collapsed to the
height of a one-line "Loading…" and sprang back, taking the pager with it so the buttons
moved out from under the cursor. Swapping the tiles for skeletons is the same flash in a
different costume, because the grid still empties and refills. The current page stays
mounted and dims (`opacity-50 pointer-events-none`, `aria-busy`) until the next one lands. `Loader` (the spinner) deliberately stays
on **ProductDetail**, **ProductOptions** and **WebsiteEditor** — a single object with no
repeating rows has no shape to stand in for, so a skeleton there would be inventing one.

The container carries `aria-busy` + `aria-live` + a label; the blocks themselves are
`aria-hidden`, so the state is announced once rather than as a dozen grey rectangles.

## Known gaps / backlog (reviewed 2026-10-02)

- Resource Requests has **no delete** — a visitor asking for their data to be removed is a database job for now.
- The legacy catalogue is being bulk-migrated from WordPress — see the migration section above. Stages 1 (title/SKU/images), 2 (descriptions), 3a (key benefits + applications), 3b (technical specs), 3c (logos), 3d (compatible) and 3e (downloads) are done; **still to do: the Hire/Purchase option** (see the options notes — attaching a two-value option drops existing variation SKUs). `/products/new` remains the path for genuinely new one-off products.
- **Opening a product makes ~4 Duda reads** (the product, and `/custom` plus both logo lists each `ensureHubProduct`). Correct, just slower than one; worth trimming if Duda rate limits ever bite.
- **New categories get no SEO title** — `duda:category-seo` was a one-off over the 23 that existed; set one on the category's page.
- **The post-deploy GitHub workflow's first run is unconfirmed from here** (no `gh` CLI) — the same commands were run locally against production and passed; check the repo's Actions tab once.
- **Downloads are public only through the resources widget** (Datasheets / User Manuals / Certificates pages). A product page still shows none — `/public/products/content` returns `downloads: []`; see Stage 3e for why.
- **Every download is gated** (2026-10-05) — no per-file toggle. The `gated` column stays per file, so one could be added to the editor.
- Widget visual styling is functional but not deeply brand-tuned.
- ⚠️ **`/widgets` is routed but deliberately NOT in the sidebar** (2026-09-30). It documents the embed snippets and is Kangaroo's reference, not something SAEquip staff should change — reachable by URL, invisible in the menu. Same treatment as `pages/UIShowcase.tsx`, which is unrouted for the same reason.
- No optimistic-concurrency check: because array writes are full replacement, a stale dashboard tab can overwrite edits made in Duda. Mitigated only by the "loaded HH:MM / refresh" control in the product header.

## ⚠️ Nullability drifts silently between backend and frontend

`res.json()` accepts anything and `apiJson<T>()` **casts** rather than validates, so a frontend interface in `frontend/src/lib/types.ts` is only a *claim* about a payload — TypeScript cannot check it against the route that produces it. When the two disagree, nothing fails at build time; it fails at runtime in the browser.

This bit for real: `sku` was typed `string` in `DudaProduct` (backend), `ProductSummary`/`ProductDetail` (frontend), `OptionUsage.products` and `DangerZoneSection`'s `DeletePreview` — but **Duda returns `sku: null` for a product without one**, exactly as it does for a freshly generated variation (`DudaVariation.sku` was already correctly `string | null`). It stayed hidden while EX Heater was the only product; the WordPress import brought in 3 SKU-less products and `p.sku.toLowerCase()` in the `/products` search filter crashed the whole page with *"Cannot read properties of null"*.

So: when a route starts returning a value that can be null, **fix the type in every mirror, not just the crash site** — correcting the backend type is what surfaces the other call sites (it found the `optionUsage.ts` one). And prefer `(x ?? "")` over `x!` at the point of use, because these types can't be trusted to stay accurate.

## Working conventions

- Ask before bundling unrelated pending changes into a commit the user has asked to be scoped narrowly — a batch of unrelated uncommitted UI tweaks sitting in the tree is not an invitation to sweep them into the next requested commit. Check `git status` before assuming recent chat history is fully reflected in `git log`.
- Prefer small, single-purpose commits matching one requested feature/fix at a time.

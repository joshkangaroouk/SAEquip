# SAEquip Product Hub

## What this is

An internal admin dashboard for SAEquip (industrial/hazardous-area equipment) that manages everything about a product that **Duda's native e-commerce store can't handle natively**: logos/certifications, technical spec tables, benefit/application lists, and gated downloadable datasheets. It also owns the **quote request** flow (a custom "add to quote" basket system, replacing native Duda checkout/pricing for these products).

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
- `Download` + `Lead` — per-product (not shared like logos) file attachments, each referencing a `MediaAsset`. `gated: true` (default) withholds the file URL until a visitor submits a lead form; `Lead` rows capture name/email/company per download.
- `MediaAsset` — the shared "media centre" library backing `Logo`, `Download`, and a product's 3D model. `kind` is `"image" | "file" | "model"`.
- `HubProduct.glbAssetId` — a product's **interactive 3D model** (`.glb`), one per product (not a shared catalog like Logos). See "3D Model Viewer" below.
- `CompatibleLink` — schema exists, **no editor built**, feature parked.
- `DudaEditorAccount` + `DudaEditorSiteAccess` + `DudaSsoAudit` — staff→Duda-account mapping, the per-site SSO allowlist, and an append-only audit of editor-access requests. See "Website Editor" below.
- `QuoteRequest` + `QuoteRequestItem` — see Quote Requests section below.

## Product identity / widget-to-backend detection method (confirmed)

The public widget (`backend/src/public-widget/widget.js`) determines which product it's rendering for like this, checked in order:
1. A `data-slug="..."` attribute on the mount `<div>`, if present.
2. Otherwise, parses `window.location.pathname` against `/\/product\/([^\/?#]+)/` — i.e. the Duda product page URL pattern `/product/<slug>`.

That slug is sent to `GET /public/products/content?slug=...` (the endpoint also accepts `?sku=` or `?dudaId=` for flexibility, but the live widget uses slug detection). `HubProduct.slug` is backfilled automatically from the Duda product's `seo.product_url` whenever a product is opened in the admin dashboard — so it stays in sync without manual entry.

## The embeddable widget

Single script (`GET /public/widget.js`, served by the backend, cached ~5 min) handles both:
- **Full embed** (legacy/simple): `<div id="saequip-product-hub"></div>` — renders every section.
- **Section-scoped embeds** (used in production, so sections can be placed independently anywhere on the Duda product template): `<div class="saequip-hub" data-section="sa-logos"></div>`, repeated per section (`sa-logos | cert-logos | specs | benefits | applications | downloads`). All mounts on a page share **one** memoized fetch per slug regardless of how many section-embeds/script copies exist. Renders inline (no iframe), so each mount auto-sizes — but note in Duda's **HTML/Embed element** you still need the **"auto height" toggle** enabled or Duda's own container clips it.
- Vanilla JS, no framework, fails silently on any error (never breaks the host page).
- **An empty section removes its own footprint.** Duda offers no way to hide an element conditionally, and hiding just the mount is not enough — Duda's HTML/Embed element is a wrapper with its own padding and min-height, so an empty widget still left a visible gap. `collapseMount()` hides the mount and then walks UP at most 4 levels, hiding each ancestor **only while that ancestor contains nothing but our mount** — so a column that also holds a heading is never touched, and the worst case is a smaller gap rather than missing page content. It fires on all four empty paths: no API/slug, an unknown `data-section`, an unknown product or failed fetch, and (the common one) a product with no content for the requested section. `data-collapse="false"` on a mount opts out. Gated downloads render an inline lead-capture form (name/email/company + honeypot) that posts to `/public/downloads/:id/lead` and returns a short-TTL signed URL on success.

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

⚠️ **`api.scripts.renderExternalApp` does NOT work for this widget — the shim loads the script and calls `init` itself.** Identical for all four widgets except `section`:

```js
(function (el, section, inEditor) {
  // Stamped SYNCHRONOUSLY, before any async work.
  el.setAttribute('data-saeh-section', section);

  var SRC = 'https://sa-equip-backend.vercel.app/public/widget.js?v=17';
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
- The `?v=` is a cache-buster; `/public/widget.js` is served with `max-age=300`. **Bump it whenever the widget changes** or Duda serves the cached copy.
- The shared promise on `window.__saehLoader` means all four widgets on a page fetch the script **once** between them.
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
| `SAEquipHubWidget.version` | whether Duda is serving a cached copy — but **not** that `renderExternalApp` ran, since a legacy HTML/Embed on the page loads the same script |
| `__saequipHub.lastInit` | `undefined` ⇒ Duda never called `init`, so the fault is in the shim, not the widget |
| `__saequipHub.inits` | every init on the page, in order — `lastInit` alone is overwritten by whichever of the four widgets ran last |
| `$$('[data-saeh-section]').map(e => e.getAttribute('data-saeh-section'))` | which section each widget container actually asked for, in document order. This is how you check a widget is wired to the section it's named after — `buildSection` is a plain string switch, so a widget showing another widget's content means the wrong `section` string is in that widget's JS |
| `__saequipHub.lastInit.argKeys` | what shape Duda actually passed |
| `__saequipHub.lastInit.refFrom` | `props` / `dmAPI` / `url` / `none` — which identity source won |
| `__saequipHub.pageDataTimedOut` | `true` ⇒ Duda's `pageData()` hung and the URL slug was used

### Both entry points are live at once, deliberately

`widget.js` exports `init`/`clean` for `renderExternalApp` **and** still scans the DOM for `.saequip-hub` mounts, so the existing HTML/Embed placements keep working until the Widget Builder route is proven on real product pages. Both funnel through one `renderInto()`, so they cannot drift.

The one behavioural difference: **an empty widget collapses on the live site but NOT when `inEditor` is true**, where the container is left exactly as Duda rendered it so any placeholder stays visible and the element stays selectable.

## The tabbed accordion (`section: "tabs"`)

The product page's main widget: Overview / Technical Specs / Key Benefits / Applications.

- **One set of buttons serves both layouts.** DOM order is header,panel,header,panel… — accordion-native — and a `min-width:721px` media query uses flex `order` to lift the headers into a tab row above the panels. This avoids the usual trick of duplicating headers (a tablist for desktop plus per-panel headers for mobile), which ships every label twice to assistive tech and to search engines.
- ⚠️ **Disclosure semantics (`aria-expanded` + `aria-controls`), NOT `role="tab"`.** Tab roles promise keyboard and layout behaviour that would be a lie in accordion mode, and one element cannot honestly be both.
- **A panel with no content is never built, so its button never exists** — an empty tab is impossible rather than merely hidden. All four empty ⇒ returns null ⇒ the mount collapses.
- Content reuses the standalone designs exactly: `specsTable()` and `itemList()` were split out of `specsSection()`/`listSection()` so the tab bodies are the same markup minus the redundant `.saeh-h` heading.
- ⚠️ **The Overview panel is the ONLY place this widget injects HTML** rather than `textContent`. That is safe *because* `/public/products/content` runs `descriptionHtml` through `stripCruft` on the way out — the dashboard's description editor is a raw-HTML textarea saved with a bare `z.string()`, so a `<script>` typed there reaches the row intact and must be neutralised at the public boundary. Verified against 8 XSS vectors. **Do not point `innerHTML` at any other field.**

`npm run widget:test --workspace=backend` covers 109 checks across the widgets, including the spec table's three row kinds and per-group striping, plus 32 behaviours of the accordion (tab set, empty-tab omission, switching, ARIA wiring, identity resolution order, editor placeholder, `clean()`, and that the legacy mounts and `"all"` still behave). `npm run widget:sync-css --workspace=backend` regenerates the dashboard's copy of the widget CSS — run it after ANY change to `injectStyles()`, because that copy has silently drifted twice.

## 3D Model Viewer

Each product may have one interactive `.glb` 3D model, uploaded per-product on the product editor (a `Model3DSection` in the unified save flow — see below), attached via `HubProduct.glbAssetId` → `MediaAsset` (kind `"model"`).

- **Storage**: `product-models` bucket, PUBLIC (unlike gated downloads, a 3D model is never gated — the live widget needs to load it unauthenticated). `backend/src/routes/media.ts` classifies an upload as kind `"model"` by its **`.glb` file extension**, not mimetype — browsers report GLB inconsistently (often `application/octet-stream`), so extension is the only reliable signal. Models get a higher upload size ceiling (50MB vs. 25MB for images/files) since textured GLBs can be large — **50MB, not the 150MB previously documented**: a bucket limit cannot exceed the Supabase project's global upload ceiling, which is 50MB, so 150MB was never actually achievable (see the storage section).
- **Admin write path**: `PUT /api/products/:id/model3d` body `{ mediaAssetId: string | null }` — validates the asset is kind `"model"`, sets/clears `HubProduct.glbAssetId`. Null clears it. Never touches the underlying `MediaAsset` (stays in the Media Centre, same pattern as Logos/Downloads). Included in `GET /api/products/:id/custom` as `model3d: {mediaAssetId, filename, url} | null`.
- **Media Centre delete-guard**: `media.ts`'s usage/reference checks also treat a `MediaAsset` referenced by `HubProduct.glbAssetId` as in-use (409 on delete), alongside Logo/Download.
- **Editor integration**: `model3d` is a full section in the unified save flow (`SectionKey`, `EditorSnapshot.model3d: Model3DDraft`, `project()` in `normalize.ts`) — **not** an immediate-apply pattern. Uploading/picking a file via `MediaPicker` (extended to accept `kind="model"`) stages the id into the draft; the actual PUT only fires on Save, like every other section. `Model3DSection.tsx` renders a live `<model-viewer>` preview (`Model3DPreview.tsx`, lazy-loads the `@google/model-viewer` web component from jsDelivr) so staff can confirm the right file was uploaded before saving.
- **Public rendering**: `GET /public/products/content` includes `model3dUrl: string | null` (a plain public URL — no signing needed, unlike gated downloads). The widget's `3d-viewer` section (`ALL_SECTIONS`/`VALID` in `widget.js`) lazy-loads the same `model-viewer` script only when a mount actually needs it, and renders a **generic, de-branded** viewer (rotate/zoom, auto-spin toggle, AR button, reset view) — deliberately stripped of the bespoke per-model hotspot callouts/exact camera framing from the one-off Claude-generated `lev-3d-viewer.html` reference snippet this feature was built from, since those numbers (exact hotspot 3D coordinates, body bounding box) are measurements unique to one specific model and don't generalize to an arbitrary future GLB upload. `model-viewer`'s own default auto-framing is used instead of custom camera math.

## Quote Requests / basket flow (separate from product-content widgets)

SAEquip has **no native pricing/checkout** for these products — instead there's a custom "request a quote" flow, built as **three separate Duda Widget Builder custom widgets** (edited directly in Duda's Widget Builder UI, NOT in this repo):
- **"SAEquip - Add to Quote"** — per-product button, reads selected variation options + product SSR data off the page, writes to a shared client-side store (`window.SAEquipQuote`, localStorage-backed).
- **"SAEquip - Quote Basket Header"** — site-header count + hover mini-cart, reads the same store.
- **"SAEquip - Basket Page"** — full basket list + the quote request form. On submit, POSTs JSON to this backend's `POST /public/quotes` (replaced the old `quote-mailer.php` on a separate PHP/Plesk host — same request/response contract `{ok:true}`/`{ok:false,error}` so the widget JS didn't need a rewrite, just its `ENDPOINT` constant updated). On success it clears the basket and redirects to a Duda "Thank You" page (`THANK_YOU_URL` constant in that widget) rather than showing an inline message.

Backend side (`backend/src/routes/quotes.ts`, `backend/src/services/email.ts`): stores every submission (`QuoteRequest`/`QuoteRequestItem`) regardless of email config, so nothing is ever lost. Email notification via Resend is **fully optional** — `isEmailConfigured()` requires all three of `RESEND_API_KEY`, `QUOTE_NOTIFY_FROM`, `QUOTE_NOTIFY_TO`; until set, `emailSent` stays `false` and the admin `/quotes` page shows a banner explaining notifications aren't active yet. A send failure never blocks/fails the visitor's submission. Honeypot (`website` field) and a bot-timing check (`elapsedMs < 1500ms`) are checked before validation, matching the legacy script's anti-spam behavior.

## Quote-request abuse surface (audited 2026-09-10)

`POST /public/quotes` is one of only three unauthenticated endpoints. What holds, and what does not:

**Holds**
- Every string is `.max()`-bounded; `items` caps at 100. Prisma parameterises, so no SQL injection. The notification is `text:` only, so no HTML injection into the email, and `/quotes` renders as text, so no stored XSS into the dashboard.
- Storage happens **before and independently of** email, and a send failure is caught — a broken mailer cannot lose a submission. Verified: 7 stored requests, all `emailSent: false`, none lost.
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
- ⚠️ **Changing a product's own attached option set DESTROYS all variation data.** Duda regenerates every variation with new ids and blanks each `sku` (to `null`) and `price_difference` (to `"0.0"`) — including for combinations that still exist. `backend/src/services/productOptions.ts` works around this by snapshotting data against an order-independent choice signature and re-applying it after the change, reporting what was restored vs genuinely dropped. **Never call `duda.updateProductOptions()` directly from a route** — go through `updateOptionsPreservingVariations()`. (An early probe wrongly suggested ids were stable; it only changed the shared *catalog* while the product kept its subset, so nothing regenerated.)
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
- Store limits live at `GET /ecommerce/store` → currently `max_products:1000, max_variations_per_product:300, max_options:20, max_choices_per_option:50`. **`max_options:20` is per-CATALOG and did NOT rise with the plan upgrade — it's the binding constraint across ~86 products.**

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
- **`/users` is READ-ONLY** apart from triggering a reset email: `GET /api/users` (Supabase admin `listUsers`, filtered to allowed domains, joined against `DudaEditorAccount`) and `POST /api/users/password-reset`.
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

   Two related traps, both fixed in code but worth knowing: `POST /api/users/password-reset` used to interpolate the `Origin` header unchecked, so a request without one produced the *relative* `/reset-password` — unusable, hence the Site URL fallback; it now validates the origin and omits `redirectTo` rather than sending a malformed one. And `/reset-password` needs `onAuthStateChange` as well as `getSession()`, because the recovery token arrives in the URL **fragment** and is exchanged asynchronously — a lone `getSession()` races that and reports "link expired" on a good link.

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
- The unsaved-changes guard (`hooks/useUnsavedChangesWarning.ts`) needs the **data router**: `useBlocker` calls `useDataRouterContext()` and throws under `<BrowserRouter>`. That's why `App.tsx` exports `createBrowserRouter`. It also pairs a `beforeunload` listener, which `useBlocker` does not cover.
- ⚠️ **Paragraph spacing is a WYSIWYG contract, and as of 2026-09-09 the value is 12px — set by US, not by Duda.** The description now renders through the widget's **Overview tab**, so `.saeh-prose p + p{margin-top:12px}` in `widget.js` is the authority, and `RichTextEditor.tsx` + `RichHtml.tsx` match it. **Change one, change all three** or the editor stops being trustworthy.

  ⚠️ **Use `mt-[12px]`, never `mt-3`.** Tailwind's spacing scale is rem-based and `html` is `font-size:110%`, so `mt-3` (0.75rem) resolves to **13.2px** in the dashboard while the widget renders a literal 12px. Same trap as the old `1em` one: only absolute px on both sides keeps them equal.

  This flipped three times, and the history explains why:
  1. A 16px gap existed on the OLD site (`099434f3`) as CSS in Duda's **Head HTML**, scoped to a wrapper class Josh added — `.productDescription p:not(:last-child){margin-bottom:16px}` — because Duda's theme API exposes **no** margin/spacing property (checked: `paragraph` only takes font/colour/letter-spacing). Per-site config, so it did **not** survive the move to `8a8f03b5`.
  2. 2026-09-08: rather than re-add it, Josh made the Hub match Duda's flush rendering (`[&_p]:my-0`). Accurate, but a paragraph break then looked identical to a line break while editing, so staff typed **blank lines** to see the structure — which would have shipped real empty `<p>` elements to the live page and produced genuine double gaps.
  3. 2026-09-09: the accordion's Overview tab took over rendering the description, so the spacing became ours to set. 12px everywhere, and the editor can show paragraph structure honestly.

  **Duda's own CSS, for the record** (measured from the live site's stylesheets, not assumed): `p.rteBlock{margin:0}` and `.dmNewParagraph[data-version] p{margin-top:0;margin-bottom:0}`. So Duda's *native* description element really does render flush — but note its **admin edit panel** shows comfortable paragraph gaps, which is authoring CSS and NOT what visitors see. Don't calibrate the Hub against that panel; it's what prompted the blank-line workaround.

  Note the sanitiser (`services/descriptionHtml.ts`) converts a sentence-boundary `<br>` into a paragraph break and drops empty paragraphs — now visible on the page again, and load-bearing rather than merely cosmetic.
- Description is a **raw-HTML two-pane editor, not a WYSIWYG** — a WYSIWYG normalises markup on load, so merely opening a product would silently rewrite Duda's legacy WordPress HTML. The preview is DOMPurify-sanitised; the textarea is what saves.
- Product images upload to Supabase for a public URL, then Duda ingests them **on save** (hence the "Pending upload" badge). There is deliberately no local `ProductImage` mirror: once Duda re-hosts an image the product no longer references Supabase, so deleting the Media Centre original can't break a live gallery.

## Prisma migrations — baselined

The database had **no `_prisma_migrations` table** until 2026-07-28 (schema applied without migration tracking), so `migrate deploy` failed with `P3005`. The five pre-existing migrations were baselined with `prisma migrate resolve --applied`. Migration state is now consistent — don't re-baseline.

`Lead` deliberately has a **nullable `downloadId` with `onDelete: SetNull`** plus `productName`/`productSku`/`downloadTitle` snapshot columns written at capture time, so deleting a product **preserves** captured leads (a null `downloadId` means "product since deleted"). Don't restore the cascade. `QuoteRequest`/`QuoteRequestItem` were never at risk — they hold denormalised snapshots with no FK to `HubProduct`.

## Deployment — moving to Vercel (in progress, 2026-09-08)

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

### Live facts

- URL: `https://sa-equip-backend.vercel.app` (project name is a leftover; it serves BOTH the dashboard and the API). Custom domain not yet added.
- Widget script for Duda embeds: `https://sa-equip-backend.vercel.app/public/widget.js`
- ⚠️ **`WIDGET_ALLOWED_ORIGINS` gates the live widget, and getting it wrong is a silent outage**: the script still loads, but its data fetch 403s and every product page renders no Hub content. It must list the Duda EDITOR origin *and* every domain the site is served on. Current value:
  `https://my.duda.co,https://saequip.multiscreensite.com,https://saequip.com,https://www.saequip.com`
  Verify after any change by sending each origin as a request header — a rename once left only `my.duda.co` in place, which took the live widget down while the dashboard looked fine.
- **Bucket limits are no longer applied at startup.** Run `npm run storage:ensure --workspace=backend` after any deploy that changes `MAX_BYTES` or the mimetype allowlists. `npm run media:verify-upload --workspace=backend` checks the upload path still works.
- ⚠️ **Still outstanding on the Duda side**: the widget embeds on the product template and the three quote/basket Widget Builder widgets still point at the deleted Railway backend, so the live product pages are missing their Hub content until those URLs are repointed. Add a custom domain first, or the `.vercel.app` hostname gets baked into Duda's templates.

### What the serverless model forced to change

- ⚠️ **A request body cannot exceed 4.5MB on Vercel** — a platform limit, not a plan setting. That is far below the 25MB file ceiling, so **uploads no longer go through the API at all**: the browser mints a signed URL, PUTs straight to Supabase and then confirms. See the upload section in `services/storage.ts` / `lib/upload.ts`. This was the blocking issue for the whole move.
- **`app.listen()` is skipped when `process.env.VERCEL` is set**, and `src/index.ts` exports the app; `backend/api/index.ts` re-exports it as the function handler and `vercel.json` rewrites every path to it, so Express still owns all routing. The same module runs unchanged as a normal server locally.
- **`ensureBuckets()` moved out of startup** into `npm run storage:ensure`. On serverless the module is evaluated on every cold start, so leaving it there added several Supabase round trips to a user's request, forever re-doing idempotent work.
- ⚠️ **`trust proxy` is now conditional on `process.env.VERCEL`.** It must stay OFF anywhere the app is reachable directly, because there it lets a caller spoof `X-Forwarded-For` and walk past an IP-keyed limit; on Vercel the header is set by their proxy, and *not* trusting it makes every IP-keyed limiter bucket the whole internet together.
- ⚠️ **`binaryTargets = ["native", "rhel-openssl-3.0.x"]`** in `schema.prisma`. Functions run on AWS Lambda; without the RHEL query engine in the bundle Prisma dies at cold start with "Query engine library for current platform could not be found".
- **`regions: ["dub1"]`** (Dublin) — Supabase is `eu-west-1`. A US region reintroduces the transatlantic latency that once made the public content endpoint ~5s.
- **`includeFiles: "backend/src/public-widget/**"`** ships the widget assets into the function bundle. `routes/public.ts` no longer trusts a single relative path: Vercel's bundler need not preserve the `src/` layout next to the compiled module, so `resolveWidgetDir()` tries several candidates and logs loudly at startup if none has `widget.js` — a missing widget is a deploy fault and shouldn't first surface as a 500 when Duda asks for the script.

### Rate limiting is split on purpose

- **The SSO limiter is Postgres-backed** (`middleware/pgRateLimitStore.ts`). `express-rate-limit`'s default store is in-process memory, which is useless on serverless: each of many short-lived instances keeps its own counter, so "10 per minute" becomes "10 per minute *per instance*" and resets on every recycle. That is unacceptable for the one route that **mints a live Duda credential**. The increment is a single atomic `INSERT … ON CONFLICT` because read-then-write loses hits under exactly the concurrency serverless makes normal (verified: 20 concurrent hits all counted).
- **The three public limiters (content/lead/quote) stay in-memory**, and are best-effort only. A DB write per page view is the wrong trade on the one endpoint that has to stay fast. Real protection for those belongs at the edge — **Vercel Firewall rate-limit rules**, which run before the function is even invoked and are therefore both cheaper and actually effective.

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

## WordPress → Duda catalogue migration (started 2026-09-07)

The ~96-product legacy catalogue is being moved off the WordPress/WooCommerce site in **stages**, driven by a WooCommerce CSV export rather than by hand.

**Stage 1 (title + SKU + images) is the only stage built so far.** Deliberately nothing else: no descriptions, no SEO metadata, no options/variations, no Hub content. Later stages: 2) descriptions, 3) specs/benefits/applications/logos, then a Hire/Purchase option.

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
- ⚠️ **"used N×" does NOT count product gallery images, and cannot.** `usageIndex()` counts logos, downloads and 3D-model attachments — the three kinds where a Hub URL *is* the live reference. A product image is uploaded only to give Duda a URL to fetch; once Duda re-hosts it the product points at `irp.cdn-website.com` and nothing links back, so an imported product photo legitimately reads 0 even while it is on a live page. That is safe (deleting it cannot break a gallery — Duda holds its own copy) but it was being *displayed* as "used 0×", which reads as "unused". The UI now shows "no Hub links" for images with an explanatory tooltip, and "unused" only for files/models. **Proper gallery tracking would need a join table written on save plus a backfill; not built.**
- ⚠️ **The kind tabs were missing "3D Models".** The filter type was `"" | "image" | "file"` and the label fell through to "Files" for anything not an image, so the 3 `.glb` models had no tab and the Files tab — which matches **0** assets, the library being all images and models — looked like where everything had landed. Actual split: **341 images, 3 models, 0 files.**
- ⚠️ **`GET /api/media` used to run 3 count queries PER asset.** Invisible at 5 assets; the import took the library to 335 and made one page load ~1,000 queries (measured 7.1s, concurrent). Now 3 `groupBy` queries build a usage index (106ms, verified identical counts for all 335). Supabase is in eu-west-1, so per-query latency dominates — the same trap that once made the public content endpoint take ~5s. **Any per-row query in a list endpoint is a bug waiting for the catalogue to grow.** Note the route still returns every asset unpaginated; fine at 335 rows, worth revisiting if the library grows much larger.
- `updateProductImages` takes an opt-in `timeoutMs` because Duda fetches images *during* the request — the importer scales it to gallery size (a 14-image product is a genuinely slow call). `services/duda.ts` has no retry/backoff of its own, so the importer adds bounded retry on 429/5xx/timeout plus inter-product and inter-batch pacing.

### Stage 2 — descriptions (done 2026-09-08)

`npm run duda:import-products --workspace=backend -- --descriptions --confirm` writes a sanitised description to **both** Duda's native `description` and `HubProduct.descriptionHtml`, and `/public/products/content` now returns `descriptionHtml`. Both, because Duda's field is what the product template renders while the public endpoint is a pure Supabase read that must never call Duda — so a widget-rendered "Overview" tab needs the Hub's own copy. That leaves the connected-data and widget routes equally open.

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

**The editor renders GROUPS, the API stores FLAT rows.** `SpecTableEditor` derives groups on every render via `groupSpecRows()` and rebuilds the flat list through `flattenSpecGroups()` on every edit — one source of truth, no local state to drift from the baseline after a save, and the two functions round-trip exactly (a group keeps the id of the row that carried its label). "+ Add line" adds a value line to a spec; "+ Add sub-heading" adds the blank-value kind; drag reorders whole groups, so a continuation line can never be orphaned by dragging.

⚠️ **`SpecRowDraft.cont` is a frontend-only flag and must not be inferred from an empty label.** If grouping keyed off emptiness, a user clearing a label would silently merge that whole group into the one above and their lines would jump up the page. `cont` carries the boundary explicitly, so a blank label stays an ordinary validation error. It is excluded from `project()`, so it cannot affect dirty detection, and the save maps `label: r.cont ? "" : r.label.trim()`.

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

⚠️ **`HubProduct.thumbnailUrl` mirrors Duda's `images[0]`**, like `sku`/`name`/`slug` already do. The carousel must show a thumbnail for a product OTHER than the one on the page, and `/public/products/content` must never call Duda on the request path. Consequence: a product whose gallery changes keeps a stale thumbnail until its next sync (opening it in the dashboard, or `--sync-hub`). Refresh with `npm run duda:import-products -- --sync-hub --confirm`.

⚠️ **`--sync-hub` used to short-circuit on `slug` alone**, so the moment a new mirrored column was added it reported "96 already correct" and backfilled nothing. It now checks every mirrored field. **Add any future mirrored column to that check**, or the repair pass silently repairs nothing.

**Audited 2026-09-11, 0 findings.** All 76 scraped products compared against stored links in order (286 links, 0 order mismatches); no self-links, no duplicates, dense `sortOrder`, no dangling references; all 55 linked products have both a slug and a thumbnail, so every card can render. Both FK cascades and the unique constraint were proven on a **throwaway** product pair, per the repo's verification policy — deleting a product removes its inbound links as well as its outbound ones. Shape: 75/96 products have links, median 3, max 17 (`ex-led-vessel-entry-kit`). 182 of 286 links are one-way, which is a content choice rather than a defect — these were curated by hand in WordPress.

⚠️ **The carousel owns its own vertical padding** (8% mobile / 6% tablet / 3% desktop, top and bottom), so **Duda's element padding must be set to ZERO**. Not cosmetic: a product with no compatible items renders nothing and the mount collapses, but padding living on the Duda section would survive as a visible empty band — the exact thing collapsing is meant to avoid. Percentages resolve against container WIDTH, so the spacing scales with the layout.

The heading is an `h3` (`.saeh-cp-h`) — sentence case, centred, 20px above the cards. Deliberately **not** `.saeh-h`, which is the uppercase, left-aligned, yellow-ruled heading the in-page sections use. The section also joins the accordion in opting out of `.saeh-root`'s 920px cap; capped, its four cards filled only ~60% of a full-width Duda section.

**The carousel** is CSS scroll-snap, not a JS slider: card width is `calc((100% - gaps) / n)` at **1 / 3 / 4** up (mobile / 561px / 881px) — mobile is one full-width card, because a phone-sized card at 2-up leaves the product name and button too small to use, so the browser owns layout and a resize needs no recalculation. `flex:0 0 <w>` means cards never grow or shrink, which is what makes a short row keep its card width instead of stretching. Arrows and track are a **flex row**, not arrows absolutely positioned over the track: structurally they cannot overlap a card, and when hidden they occupy no space so the track simply widens. Card width is a percentage OF THE TRACK, so showing or hiding an arrow never changes how many cards fit — the measurement cannot oscillate. ⚠️ `justify-content:safe center` centres the cards when they fit and falls back to start when they overflow; plain `center` would centre an overflowing track too, putting the FIRST card out of reach and unscrollable.

⚠️ **On mobile (≤560px) the arrows move BELOW the track**, centred, so a card gets the full width rather than losing ~108px to two buttons and their gaps — nearly a third of a 375px row. Done with `flex-wrap` plus `order`, keeping the DOM order prev/track/next because that is the correct reading order for assistive tech.

⚠️ **Arrow visibility is CSS, not measurement.** `data-count` on `.saeh-cp` carries the card count, and media-query rules hide the arrows whenever that count fits the row — ≤1 mobile, ≤3 tablet, ≤4 desktop. Decided at parse time by the same breakpoints that set the card width.

This **replaced** a `scrollWidth`-vs-`clientWidth` measurement, and the reason matters: measuring is correct in principle but has to run after layout, and when it did not run the arrows stayed in their default state — two live arrows beside two cards with nothing to scroll, on the live site, while the editor looked fine. A rule that cannot run at the wrong time cannot be wrong. The cost is the breakpoints being stated twice (card width, and the hide rules); they sit adjacent for that reason. JS now only sets the `disabled` end-of-travel state, where running late is harmless.

### Data waiting for later stages

176 downloads. **Logos are surveyed in the section below.** Read them with `acfRepeater()` — ACF exports each repeater row as `Meta: <name>_<n>_<field>` **plus** a `_`-prefixed mirror holding the internal field key, which must be ignored or every value doubles.

Two expectation-setters: **`_wp_desired_post_slug` is empty for all 96** (Duda auto-slugs from the name instead, which has matched the WordPress slugs so far — but the public widget resolves by slug, so any redirect work needs the live sitemap while it's still up), and **Yoast SEO was barely populated** in WordPress (title on 4/96, meta description on 12/96) — so SEO titles and descriptions were authored rather than migrated. See the SEO section below.

### Product name casing (fixed 2026-09-11)

20 of the 96 product names were entirely upper case and are now sentence case, in **Duda** (the source of truth for `name`), via `npm run duda:fix-casing --workspace=backend -- --confirm`. Preview without `--confirm`.

⚠️ **Verified before writing: a case-only rename does NOT change Duda's auto-generated `seo.product_url`.** Probed on a throwaway product — created one SHOUTING, renamed it to sentence case, slug unchanged, deleted it. Had the slug tracked the name, this would have silently changed 20 public URLs and 404'd every link to them. **Re-probe before any bulk rename that changes words rather than just case** — that is a different question, and the answer may well differ.

⚠️ **Only ENTIRELY upper-case names are touched.** The other 76 are already styled, and a title-caser over them would capitalise the deliberate lower-case words in e.g. "Free Airflow (with 30cm Connectors)".

Acronyms are **learned from the catalogue, not hard-coded**: all-caps tokens inside already-styled names (the house style stating itself — `EX`, `LED`, `LEV`, `PU`, `PVC`, `KVA`) plus **every SKU**, because a product code in a name is a code. That second source is load-bearing: `COMPACT FILTRATION UNIT (SAECFU)` carries its SKU to clear a duplicate-title collision, and `SAECFU` appears in no styled name, so the first source alone produced "Saecfu". Tokens containing a digit are kept verbatim (`3.8KVA`, `400VA`).

Verified after: 0 products still upper case, 0 name drift between Duda and `HubProduct`, 0 slug drift.

## Categories and Tags (added 2026-09-11)

Both are **assigned Hub-side** and both are pickers in the product editor's right-hand column.

⚠️ **Duda has no working product-side category assignment, and it fails SILENTLY.** `PATCH /products/{id}` with `categories` (or `category_ids`, in either the `["id"]` or `[{id}]` shape) returns **200 and changes nothing** — the product still reports `categories: []`. Probed on throwaways. The only path that works is `PATCH /categories/{id}` with `{products:[{id}]}` — note `[{id}]`, not `["id"]`, which 400s on shape — and that array is full-replacement.

So writing a product's categories to Duda would mean rewriting every affected category's entire product list on every save: N+M calls, and a race two editors lose silently, since Duda has no optimistic concurrency. **Josh chose Hub-side storage (2026-09-11).** Consequence: Duda's own category/storefront pages stay empty; these drive our widgets only, exactly like specs, logos and compatible products. The category LIST still comes from Duda, so names and nesting are always Duda's.

- `ProductCategory` stores `dudaCategoryId` with **no foreign key** — categories live in Duda, so a category deleted there leaves a row pointing at nothing.
- `Tag` / `ProductTag` are entirely Hub-owned; Duda has no equivalent. Managed at **`/tags`** (create, rename inline, reorder, delete). Deleting a tag cascades its assignments, so the confirm names the product count.
- Nothing renders tags publicly yet — deliberately. The data layer exists so the labelling can be done before anything depends on it.
- Both `PUT` routes **reject unknown ids** rather than dropping them, so a stale editor tab cannot quietly save fewer than it displayed. Both are compared as **sorted sets** in `project()`, so ticking A then B is not a change against a baseline that loaded B then A.

### Product editor layout

70/30 two-column (`lg:grid-cols-10`, 7 + 3). Left is the product; right is classification. **Grid, not flex**, so a long accordion opening on the left cannot drag the right column's panels down.

⚠️ **Details and Description are deliberately NOT collapsible** — they are what you came to edit, and hiding them behind a click buys the least valuable scroll at the cost of the most common task.

`AccordionCard` **unmounts** its body when closed rather than hiding it: these bodies are not cheap (the compatible picker fetches the whole catalogue, the 3D section mounts a `model-viewer`), and twelve open at once is what this change exists to avoid. It also **opens itself when a section becomes dirty or errors, and only on that transition** — always-open-while-dirty could never be collapsed again, and an editor that can hide a failed section is how you lose work.

⚠️ **A section's `CardHeader` renders ONLY its actions inside an accordion.** The accordion header already carries the title, dirty badge, summary and description, so the section's own header repeated all of it — the same sentence twice, each with a bottom margin.

⚠️ **`AccordionCard` declares its own card chrome instead of using `<Card className="p-0">`.** `cn()` is a **plain string join, not tailwind-merge**, so `p-0` landed in the class list *alongside* Card's `p-5` and lost on stylesheet order — leaving 22px of padding wrapping every accordion, header included. **This is the third time the same trap has bitten**: `w-56` on an `Input` losing to its `w-full`, and the `hidden` attribute losing to a `flex` utility. **Any `w-*`/`p-*`/`text-*` passed to a UI component can silently lose to that component's own base class.** Either swap `cn` for `tailwind-merge` (one dependency, fixes it everywhere — but existing overrides that are currently no-ops would start applying, so it needs a pass) or keep sizing the wrapper, as here.

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

## Known gaps / backlog (as of 2026-07-28)

- Categories have **no image editing** yet: the API exposes `image` on a category but the editor only covers title, parent, description and SEO. Product↔category assignment also isn't built — a product's `categories` array is still read-only, so nothing is actually categorised yet (every count reads 0).
- No admin UI to view captured `Lead` rows from gated downloads yet (they're stored and now survive product deletion, just not surfaced — unlike `QuoteRequest`, which has a `/quotes` page). More valuable now that retained leads can outlive their product.
- Per-product **Downloads editor was removed**; the Downloads widget is parked as visibly disabled on `/widgets`. Backend routes, leads, `/custom` payload and the widget's downloads section all still work, so restoring it is a UI-only change (`git show d68e28b~1:frontend/src/components/DownloadsEditor.tsx` for the old implementation).
- The legacy catalogue is being bulk-migrated from WordPress — see the migration section above. Stages 1 (title/SKU/images), 2 (descriptions), 3a (key benefits + applications), 3b (technical specs) and 3c (logos) are done for all 96 published products; **still to do: downloads (176 rows) and options**, so products now have a name, gallery, description, benefits, applications, a spec table and their logos. `/products/new` remains the path for genuinely new one-off products.
- Downloads (176 rows) is the last unimported stage. ⚠️ It needs a decision first: each download has a `gated` flag (default **true**) that withholds the file until a visitor submits a lead form, and the CSV cannot say which datasheets should be gated. The per-product Downloads *editor* was also removed from the UI (backend routes, leads and the widget section all still work), so restoring it is UI-only — `git show d68e28b~1:frontend/src/components/DownloadsEditor.tsx`.
- Widget visual styling is functional but not deeply brand-tuned.
- No optimistic-concurrency check: because array writes are full replacement, a stale dashboard tab can overwrite edits made in Duda. Mitigated only by the "loaded HH:MM / refresh" control in the product header.

## ⚠️ Nullability drifts silently between backend and frontend

`res.json()` accepts anything and `apiJson<T>()` **casts** rather than validates, so a frontend interface in `frontend/src/lib/types.ts` is only a *claim* about a payload — TypeScript cannot check it against the route that produces it. When the two disagree, nothing fails at build time; it fails at runtime in the browser.

This bit for real: `sku` was typed `string` in `DudaProduct` (backend), `ProductSummary`/`ProductDetail` (frontend), `OptionUsage.products` and `DangerZoneSection`'s `DeletePreview` — but **Duda returns `sku: null` for a product without one**, exactly as it does for a freshly generated variation (`DudaVariation.sku` was already correctly `string | null`). It stayed hidden while EX Heater was the only product; the WordPress import brought in 3 SKU-less products and `p.sku.toLowerCase()` in the `/products` search filter crashed the whole page with *"Cannot read properties of null"*.

So: when a route starts returning a value that can be null, **fix the type in every mirror, not just the crash site** — correcting the backend type is what surfaces the other call sites (it found the `optionUsage.ts` one). And prefer `(x ?? "")` over `x!` at the point of use, because these types can't be trusted to stay accurate.

## Working conventions

- Ask before bundling unrelated pending changes into a commit the user has asked to be scoped narrowly — a batch of unrelated uncommitted UI tweaks sitting in the tree is not an invitation to sweep them into the next requested commit. Check `git status` before assuming recent chat history is fully reflected in `git log`.
- Prefer small, single-purpose commits matching one requested feature/fix at a time.

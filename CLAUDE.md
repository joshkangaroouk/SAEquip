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
- **Hosting**: Both `backend` and `frontend` deployed on **Railway** (see gotchas below).
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
- Vanilla JS, no framework, fails silently on any error (never breaks the host page). Gated downloads render an inline lead-capture form (name/email/company + honeypot) that posts to `/public/downloads/:id/lead` and returns a short-TTL signed URL on success.

## 3D Model Viewer

Each product may have one interactive `.glb` 3D model, uploaded per-product on the product editor (a `Model3DSection` in the unified save flow — see below), attached via `HubProduct.glbAssetId` → `MediaAsset` (kind `"model"`).

- **Storage**: `product-models` bucket, PUBLIC (unlike gated downloads, a 3D model is never gated — the live widget needs to load it unauthenticated). `backend/src/routes/media.ts` classifies an upload as kind `"model"` by its **`.glb` file extension**, not mimetype — browsers report GLB inconsistently (often `application/octet-stream`), so extension is the only reliable signal. Models get a higher upload size ceiling (150MB vs. 25MB for images/files) since textured GLBs can be large.
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

## Duda REST API

Base URL `https://api.duda.co/api`, HTTP Basic auth (`DUDA_API_USER`/`DUDA_API_PASS`). SAEquip's `site_name` is **`8a8f03b5`** (`saequip-2.multiscreensite.com`) as of 2026-09-07 — see "Site migration" below; the former `099434f3` is retired and nothing should read from it. **Path pattern includes a `multiscreen` segment that's easy to miss** — omitting it 404s (`RESTEASY003210`): `/sites/multiscreen/{site}/ecommerce/store`, `.../ecommerce/products`, `.../ecommerce/products/{id}` (see `backend/src/services/duda.ts`). Duda's product `custom_fields` are deliberately unused (see the Duda-vs-Hub split above) — don't reintroduce writes to them.

### Site migration: `099434f3` → `8a8f03b5` (2026-09-07)

The Hub now reads and writes **only** `8a8f03b5`. The old site is retired; `GRANTABLE_SITES` in `dudaEditorProvision.ts` no longer allows it, and editor access on it was revoked.

**The thing that made this cheap: `8a8f03b5` was DUPLICATED from `099434f3`, so product ids carried over byte-identically** — same `dudaProductId` (`01KW9R473XZGWZWC5206EPYAWB`), same SKU, same slug, same option ids. Products are normally per-site in Duda, so the obvious expectation was that every `HubProduct` row (keyed on `dudaProductId`) would need re-keying to new ids; **it didn't**, and the existing row kept its attached 3D model. Verify before assuming this holds for any *future* site move — a site created fresh rather than duplicated would genuinely need re-keying. **Variation ids DO differ** between the sites, but nothing persists those.

Changing sites means `DUDA_SITE_NAME` in env (default in `backend/src/env.ts`) plus `PUBLIC_ALLOWED_ORIGINS` gaining the new domain — and, on Railway, both must be set on the backend service, not just locally. Everything configured *inside* Duda is per-site and does **not** carry over even in a duplicate: widget embeds on the product template, the `.productDescription` Head-HTML CSS, and the three quote/basket Widget Builder widgets all need re-doing on the new site.

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
- **Rate limited per user, not per IP** — `app.set("trust proxy")` is never called, so behind Railway's proxy an IP-keyed limiter would bucket every staff member together. The limiter uses `keyGenerator: req => req.user?.id`.
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

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full annotated list. Highlights:
- Backend **requires**: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL_DOMAINS`, `DUDA_API_USER`, `DUDA_API_PASS`. `PUBLIC_ALLOWED_ORIGINS` must include every domain allowed to call `/public/*` (Duda domains + the frontend origin + localhost for dev) — CORS rejects anything not listed, no trailing slashes.
- Backend **optional**: `RESEND_API_KEY` + `QUOTE_NOTIFY_FROM` + `QUOTE_NOTIFY_TO` (all-or-nothing for email).
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (baked in at **build time** — changing it requires a rebuild/redeploy, not just a running-process restart).

## The product editor (unified save)

`frontend/src/pages/ProductDetail.tsx` is a full two-way editor: title, SKU, type, status, stock, price, SEO, description, images, the 3D model, plus all other Hub content. `frontend/src/components/product/` holds the machinery:

- **Options & variations**: `OptionsSection` handles per-product attach/detach and choice selection (safe — can't affect another product); `VariationsSection` annotates the generated rows and **locks while Options are dirty**, because option ids regenerate on save so anything typed first would target dead ids. `VariationCountMeter` shows current → projected against `max_variations_per_product` and blocks over it client-side. Catalog creation is kept out of the unified save (`POST /ecommerce/options` isn't idempotent — a retried save would duplicate options and eat the 20-slot cap).
- **`useProductEditor.ts`** owns two copies of one `EditorSnapshot` — `baseline` (last server-confirmed truth) and `draft` — loaded in one `Promise.all`. Every section is a controlled component; there are **no per-section Save buttons**, just `ProductSaveBar`.
- **Dirty detection** (`normalize.ts` `project()`) strips cosmetic row ids before comparing. New rows use `crypto.randomUUID()` with no server counterpart, so comparing ids directly would report a section dirty forever after a save. Logo ids compare sorted so toggle order isn't a change. **If you add a slice, add it to `project()` or it will never look dirty.**
- **Save builds its task list from the dirty map only.** Never PUT a clean section: specs/benefits/applications are delete-all-then-recreate, so a no-op PUT is a real destructive round-trip against live data. Tasks run sequentially and each banks its confirmed slice into *both* baseline and draft, so earlier work survives a later failure; failures are per-section and leave that section dirty (keeping the guard armed). Retrying the same save converges, because every sub-operation is a full replacement or idempotent.
- **`seo` is sent whole** whenever any sub-field changed — dropping `seo.product_url` would break the public widget's slug detection.
- The unsaved-changes guard (`hooks/useUnsavedChangesWarning.ts`) needs the **data router**: `useBlocker` calls `useDataRouterContext()` and throws under `<BrowserRouter>`. That's why `App.tsx` exports `createBrowserRouter`. It also pairs a `beforeunload` listener, which `useBlocker` does not cover.
- ⚠️ **Paragraph spacing is a contract with Duda.** Duda renders `<p>` flush by default, so the description editor originally showed a gap the live page didn't have — one Enter *looked* like a paragraph break when it wasn't. Duda's theme API exposes **no** margin/spacing property (checked: `paragraph` only takes font/colour/spacing-of-text properties), so spacing is injected as CSS in Duda's **Head HTML**, scoped to the description element's wrapper class: `.productDescription p:not(:last-child) { margin-bottom: 16px }`. `RichTextEditor.tsx` and `RichHtml.tsx` mirror that exact value — **change one, change all three**, or the editor stops being trustworthy. Absolute 16px, not `1em`, because em resolves to 18px on Duda vs 16px in the dashboard. Note empty `<p></p>` has zero height with no margin but contributes a full 16px once margin exists, so stray double-Enters become visible gaps.
- Description is a **raw-HTML two-pane editor, not a WYSIWYG** — a WYSIWYG normalises markup on load, so merely opening a product would silently rewrite Duda's legacy WordPress HTML. The preview is DOMPurify-sanitised; the textarea is what saves.
- Product images upload to Supabase for a public URL, then Duda ingests them **on save** (hence the "Pending upload" badge). There is deliberately no local `ProductImage` mirror: once Duda re-hosts an image the product no longer references Supabase, so deleting the Media Centre original can't break a live gallery.

## Prisma migrations — baselined

The database had **no `_prisma_migrations` table** until 2026-07-28 (schema applied without migration tracking), so `migrate deploy` failed with `P3005`. The five pre-existing migrations were baselined with `prisma migrate resolve --applied`. Migration state is now consistent — don't re-baseline.

`Lead` deliberately has a **nullable `downloadId` with `onDelete: SetNull`** plus `productName`/`productSku`/`downloadTitle` snapshot columns written at capture time, so deleting a product **preserves** captured leads (a null `downloadId` means "product since deleted"). Don't restore the cascade. `QuoteRequest`/`QuoteRequestItem` were never at risk — they hold denormalised snapshots with no FK to `HubProduct`.

## Deployment gotchas (Railway) — read before touching build/deploy config

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
- **Products with no image in WordPress get `frontend/public/saequip-no-image.jpg`** (5 of 96). Duda ingests by *fetching a URL*, so a repo file can't be handed over directly — it's uploaded once to the public `product-media` bucket at the fixed path `images/saequip-no-image.jpg` (the same Supabase staging route the dashboard's own uploader uses) and that URL is given to Duda, which re-hosts its own copy per product. Deliberately **no `MediaAsset` row**: the Media Centre's image list feeds the logo picker, and a placeholder is not a logo. `--no-fallback` opts out.
- **The verification that matters is "no image still references a non-Duda host."** Every batch is re-read and asserted to be entirely on `irp.cdn-website.com`; a batch that wholly fails stops the run instead of pressing on through 96 products.
- Product photos are deliberately **not** mirrored into `MediaAsset`/the Media Centre: `MediaPicker` and `POST /api/logos` filter on `kind === "image"`, so 329 product shots would bury the 9 real certification logos in the logo picker. `migration/images/` is the archive instead.
- `updateProductImages` takes an opt-in `timeoutMs` because Duda fetches images *during* the request — the importer scales it to gallery size (a 14-image product is a genuinely slow call). `services/duda.ts` has no retry/backoff of its own, so the importer adds bounded retry on 429/5xx/timeout plus inter-product and inter-batch pacing.

### Data waiting for later stages

466 spec rows (50 products), 512 key benefits (59), 325 applications (56), 227 logo links across only **9 distinct** logo values (`madeinuk`, `zone-1-2`, `ATEX`, `UKEX`, `IECEx`, `zone-21-22`, `INMETRO`, `zone-0`, `zone-20`), 176 downloads. Read them with `acfRepeater()` — ACF exports each repeater row as `Meta: <name>_<n>_<field>` **plus** a `_`-prefixed mirror holding the internal field key, which must be ignored or every value doubles.

Two expectation-setters: **`_wp_desired_post_slug` is empty for all 96** (Duda auto-slugs from the name instead, which has matched the WordPress slugs so far — but the public widget resolves by slug, so any redirect work needs the live sitemap while it's still up), and **Yoast SEO is barely populated** (title on 4/96, meta description on 12/96), so SEO is authoring work, not migration. Per Josh, SEO metadata is off the table for now.

## Known gaps / backlog (as of 2026-07-28)

- Categories have **no image editing** yet: the API exposes `image` on a category but the editor only covers title, parent, description and SEO. Product↔category assignment also isn't built — a product's `categories` array is still read-only, so nothing is actually categorised yet (every count reads 0).
- No admin UI to view captured `Lead` rows from gated downloads yet (they're stored and now survive product deletion, just not surfaced — unlike `QuoteRequest`, which has a `/quotes` page). More valuable now that retained leads can outlive their product.
- Per-product **Downloads editor was removed**; the Downloads widget is parked as visibly disabled on `/widgets`. Backend routes, leads, `/custom` payload and the widget's downloads section all still work, so restoring it is a UI-only change (`git show d68e28b~1:frontend/src/components/DownloadsEditor.tsx` for the old implementation).
- The legacy catalogue is being bulk-migrated from WordPress — see the migration section above. Stage 1 (title/SKU/images for all 96 published products) is scripted; descriptions, Hub content and options are still to do, so most products in Duda currently have images and a name but no other content. `/products/new` remains the path for genuinely new one-off products.
- `CompatibleLink` model exists with no editor/UI.
- Widget visual styling is functional but not deeply brand-tuned.
- No optimistic-concurrency check: because array writes are full replacement, a stale dashboard tab can overwrite edits made in Duda. Mitigated only by the "loaded HH:MM / refresh" control in the product header.

## ⚠️ Nullability drifts silently between backend and frontend

`res.json()` accepts anything and `apiJson<T>()` **casts** rather than validates, so a frontend interface in `frontend/src/lib/types.ts` is only a *claim* about a payload — TypeScript cannot check it against the route that produces it. When the two disagree, nothing fails at build time; it fails at runtime in the browser.

This bit for real: `sku` was typed `string` in `DudaProduct` (backend), `ProductSummary`/`ProductDetail` (frontend), `OptionUsage.products` and `DangerZoneSection`'s `DeletePreview` — but **Duda returns `sku: null` for a product without one**, exactly as it does for a freshly generated variation (`DudaVariation.sku` was already correctly `string | null`). It stayed hidden while EX Heater was the only product; the WordPress import brought in 3 SKU-less products and `p.sku.toLowerCase()` in the `/products` search filter crashed the whole page with *"Cannot read properties of null"*.

So: when a route starts returning a value that can be null, **fix the type in every mirror, not just the crash site** — correcting the backend type is what surfaces the other call sites (it found the `optionUsage.ts` one). And prefer `(x ?? "")` over `x!` at the point of use, because these types can't be trusted to stay accurate.

## Working conventions

- Ask before bundling unrelated pending changes into a commit the user has asked to be scoped narrowly — a batch of unrelated uncommitted UI tweaks sitting in the tree is not an invitation to sweep them into the next requested commit. Check `git status` before assuming recent chat history is fully reflected in `git log`.
- Prefer small, single-purpose commits matching one requested feature/fix at a time.

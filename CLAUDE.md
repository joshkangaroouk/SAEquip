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
- **Frontend**: Vite + React 18 + TypeScript + Tailwind. `react-router-dom` v7. `@dnd-kit` (core/sortable/utilities) for drag-reorder. `react-dropzone` for uploads. `sonner` for toasts. `dompurify` for rendering trusted-but-HTML content (specs/descriptions). Font: **IBM Plex Sans** (`@fontsource/ibm-plex-sans`, weights 400/500/600, wired in `main.tsx`) with standard rounded corners — this project went through a dark/sharp/ClashGrotesk design pass that was later fully reverted; don't assume that look, or Montserrat, without checking current `index.css`/`tailwind.config.js`/`main.tsx` first, since the visual design has changed direction more than once.
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

Base URL `https://api.duda.co/api`, HTTP Basic auth (`DUDA_API_USER`/`DUDA_API_PASS`). SAEquip's `site_name` is `099434f3`. **Path pattern includes a `multiscreen` segment that's easy to miss** — omitting it 404s (`RESTEASY003210`): `/sites/multiscreen/{site}/ecommerce/store`, `.../ecommerce/products`, `.../ecommerce/products/{id}` (see `backend/src/services/duda.ts`). Duda's product `custom_fields` are deliberately unused (see the Duda-vs-Hub split above) — don't reintroduce writes to them.

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
- **Categories** live at `/ecommerce/categories` (GET, POST) and `/ecommerce/categories/{id}` (GET, PATCH, DELETE). They come back **FLAT with a `parent_id`** — the tree is derived, not nested — and top-level rows use the sentinel string `"ROOT"`, not null. The list shape is only `{id, title, parent_id, products_count}`; `description`, `image` and `seo` come from the single-category GET. `backend/src/routes/categories.ts` derives depth/ordering server-side so every consumer agrees, and guards against re-parenting a category under its own descendant.
- ⚠️ **A category's `seo` is FULL REPLACEMENT on PATCH**, exactly like a product's. PATCHing `seo` without `url` blanks the page URL and Duda rejects with `"Category page url cannot be blank"`. The categories route merges the incoming `seo` over the current value so partial edits work.
- `GET /products?category_id=…` appears to **ignore the filter** (it returned a product whose `categories` array is empty). Don't rely on it for category membership.
- `quantity` is **write-only** — accepted on PATCH, never returned on read.
- **`GET /products` clamps `limit` to 200** regardless of what you ask for, so paging is required now `max_products` is 1000 (`duda.listAllProducts()`).
- Store limits live at `GET /ecommerce/store` → currently `max_products:1000, max_variations_per_product:300, max_options:20, max_choices_per_option:50`. **`max_options:20` is per-CATALOG and did NOT rise with the plan upgrade — it's the binding constraint across ~86 products.**

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

**EX Heater** (`dudaProductId 01KW9R473XZGWZWC5206EPYAWB`, slug `ex-heater`) is a **live product** Josh populates for real, not a fixture. Multiple early verification passes accidentally wrote test data to it or risked wiping it via replace-whole-set endpoints (specs/benefits/applications use delete-all-then-recreate semantics).

**Rule going forward: every verification/test must use a dedicated throwaway product (create hidden → test → delete), never the live EX Heater** — and never run a replace-whole-set write against real data without snapshotting first. Read-only checks against EX Heater are fine.

## Known gaps / backlog (as of 2026-07-28)

- Categories have **no image editing** yet: the API exposes `image` on a category but the editor only covers title, parent, description and SEO. Product↔category assignment also isn't built — a product's `categories` array is still read-only, so nothing is actually categorised yet (every count reads 0).
- No admin UI to view captured `Lead` rows from gated downloads yet (they're stored and now survive product deletion, just not surfaced — unlike `QuoteRequest`, which has a `/quotes` page). More valuable now that retained leads can outlive their product.
- Per-product **Downloads editor was removed**; the Downloads widget is parked as visibly disabled on `/widgets`. Backend routes, leads, `/custom` payload and the widget's downloads section all still work, so restoring it is a UI-only change (`git show d68e28b~1:frontend/src/components/DownloadsEditor.tsx` for the old implementation).
- Only 1 of ~86 SAEquip products exists in the Duda store so far (EX Heater) — the rest are still on the legacy WordPress site. `/products/new` ("Create and add another") is the intended migration path.
- `CompatibleLink` model exists with no editor/UI.
- Widget visual styling is functional but not deeply brand-tuned.
- No optimistic-concurrency check: because array writes are full replacement, a stale dashboard tab can overwrite edits made in Duda. Mitigated only by the "loaded HH:MM / refresh" control in the product header.

## Working conventions

- Ask before bundling unrelated pending changes into a commit the user has asked to be scoped narrowly — a batch of unrelated uncommitted UI tweaks sitting in the tree is not an invitation to sweep them into the next requested commit. Check `git status` before assuming recent chat history is fully reflected in `git log`.
- Prefer small, single-purpose commits matching one requested feature/fix at a time.

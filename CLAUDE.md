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
- **Frontend**: Vite + React 18 + TypeScript + Tailwind. `react-router-dom` v7. `@dnd-kit` (core/sortable/utilities) for drag-reorder. `react-dropzone` for uploads. `sonner` for toasts. `dompurify` for rendering trusted-but-HTML content (specs/descriptions). Font: Montserrat (`@fontsource/montserrat`) — note: an earlier ClashGrotesk design pass was later reverted back to a standard rounded-corners look with this font; don't reintroduce ClashGrotesk assumptions without checking current `index.css`/`tailwind.config.js`.
- **Database/Auth/Storage**: Supabase — Postgres (via Prisma, pooled `DATABASE_URL` + direct `DIRECT_URL` for migrations), Auth (email+password, public signup **disabled**, `ALLOWED_EMAIL_DOMAINS` allowlist, backend verifies JWTs via `supabase.auth.getUser`), Storage (two buckets: `product-media` public for logos/images, `product-files` private for gated download files, served via short-lived signed URLs).
- **Hosting**: Both `backend` and `frontend` deployed on **Railway** (see gotchas below).
- **External APIs**: Duda REST API (HTTP Basic auth), Resend (optional, email notifications).

## Data model (Prisma) — source of truth split

**Duda owns**: native product fields + description only. All Duda custom_fields were deliberately deleted from the store — the Hub DB is the sole source of truth for everything else.

**Supabase (via `HubProduct`, keyed by `dudaProductId`) owns**:
- `Logo` + `ProductLogo` — SA/Cert logos are a **global shared catalog** (`Logo`, kind `SA_LOGO`/`CERT_LOGO`), not per-product. `ProductLogo` is a join table; a row's existence = that catalog logo is *active* for that product. Adding a logo to the catalog makes it available to every product; deleting one is global (UI warns with a usage count).
- `SpecRow` — ordered label/value technical spec rows.
- `ProductTextItem` — ordered text items, `kind` `BENEFIT` or `APPLICATION`.
- `Download` + `Lead` — per-product (not shared like logos) file attachments, each referencing a `MediaAsset`. `gated: true` (default) withholds the file URL until a visitor submits a lead form; `Lead` rows capture name/email/company per download.
- `MediaAsset` — the shared "media centre" library backing both `Logo` and `Download`.
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

## Quote Requests / basket flow (separate from product-content widgets)

SAEquip has **no native pricing/checkout** for these products — instead there's a custom "request a quote" flow, built as **three separate Duda Widget Builder custom widgets** (edited directly in Duda's Widget Builder UI, NOT in this repo):
- **"SAEquip - Add to Quote"** — per-product button, reads selected variation options + product SSR data off the page, writes to a shared client-side store (`window.SAEquipQuote`, localStorage-backed).
- **"SAEquip - Quote Basket Header"** — site-header count + hover mini-cart, reads the same store.
- **"SAEquip - Basket Page"** — full basket list + the quote request form. On submit, POSTs JSON to this backend's `POST /public/quotes` (replaced the old `quote-mailer.php` on a separate PHP/Plesk host — same request/response contract `{ok:true}`/`{ok:false,error}` so the widget JS didn't need a rewrite, just its `ENDPOINT` constant updated). On success it clears the basket and redirects to a Duda "Thank You" page (`THANK_YOU_URL` constant in that widget) rather than showing an inline message.

Backend side (`backend/src/routes/quotes.ts`, `backend/src/services/email.ts`): stores every submission (`QuoteRequest`/`QuoteRequestItem`) regardless of email config, so nothing is ever lost. Email notification via Resend is **fully optional** — `isEmailConfigured()` requires all three of `RESEND_API_KEY`, `QUOTE_NOTIFY_FROM`, `QUOTE_NOTIFY_TO`; until set, `emailSent` stays `false` and the admin `/quotes` page shows a banner explaining notifications aren't active yet. A send failure never blocks/fails the visitor's submission. Honeypot (`website` field) and a bot-timing check (`elapsedMs < 1500ms`) are checked before validation, matching the legacy script's anti-spam behavior.

## Duda REST API

Base URL `https://api.duda.co/api`, HTTP Basic auth (`DUDA_API_USER`/`DUDA_API_PASS`). SAEquip's `site_name` is `099434f3`. **Path pattern includes a `multiscreen` segment that's easy to miss** — omitting it 404s (`RESTEASY003210`): `/sites/multiscreen/{site}/ecommerce/store`, `.../ecommerce/products`, `.../ecommerce/products/{id}` (see `backend/src/services/duda.ts`). Duda's product `custom_fields` are deliberately unused (see the Duda-vs-Hub split above) — don't reintroduce writes to them.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full annotated list. Highlights:
- Backend **requires**: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL_DOMAINS`, `DUDA_API_USER`, `DUDA_API_PASS`. `PUBLIC_ALLOWED_ORIGINS` must include every domain allowed to call `/public/*` (Duda domains + the frontend origin + localhost for dev) — CORS rejects anything not listed, no trailing slashes.
- Backend **optional**: `RESEND_API_KEY` + `QUOTE_NOTIFY_FROM` + `QUOTE_NOTIFY_TO` (all-or-nothing for email).
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (baked in at **build time** — changing it requires a rebuild/redeploy, not just a running-process restart).

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

## Known gaps / backlog (as of last update)

- No admin UI to view captured `Lead` rows from gated downloads yet (they're stored, just not surfaced — unlike `QuoteRequest`, which does have a `/quotes` admin page).
- Only 1 of ~86 SAEquip products exists in the Duda store so far (EX Heater) — the rest are still on the legacy WordPress site and haven't been migrated in.
- `CompatibleLink` model exists with no editor/UI.
- Widget visual styling is functional but not deeply brand-tuned.

## Working conventions

- Ask before bundling unrelated pending changes into a commit the user has asked to be scoped narrowly — a batch of unrelated uncommitted UI tweaks sitting in the tree is not an invitation to sweep them into the next requested commit. Check `git status` before assuming recent chat history is fully reflected in `git log`.
- Prefer small, single-purpose commits matching one requested feature/fix at a time.

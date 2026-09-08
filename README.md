# SAEquip Product Hub

Internal admin dashboard for SAEquip. It manages everything about a product that Duda's native
e-commerce store can't: certification logos, technical spec tables, benefit/application lists,
gated datasheet downloads, interactive 3D models, and the custom "request a quote" flow that
replaces Duda checkout. That content is rendered back onto the live product page by a small
embeddable widget, so visitors see native Duda fields and Hub content merged.

**`CLAUDE.md` is the real documentation** — architecture, the Duda API's verified behaviours and
traps, the security model for editor SSO, and the WordPress migration. Read it before changing
anything non-obvious. This file is just how to get running.

## Layout

npm-workspaces monorepo:

- **`backend/`** — Node + TypeScript (ESM) + Express + Prisma. The API, plus the public
  embeddable widget and its unauthenticated data/lead-capture endpoints.
- **`frontend/`** — Vite + React + TypeScript + Tailwind. The login-gated dashboard.
- **`api/index.ts`** — the Vercel entry point; re-exports the Express app so one deployment
  serves both surfaces from one origin.

## Where the data lives

- **Duda** owns native product fields (name, SKU, price, images, variations) and the description.
- **Supabase Postgres** (via Prisma) owns everything else, keyed to a `HubProduct` by
  `dudaProductId`: logos, spec rows, benefits, applications, downloads and captured leads,
  3D model attachments, quote requests, and the Duda-editor SSO mappings.
- **Supabase Storage** holds uploaded media in three buckets — `product-media` (public),
  `product-files` (private, served via short-lived signed URLs) and `product-models` (public).
- **Supabase Auth** handles login. Public signup is disabled and an email-domain allowlist applies.

## Prerequisites

- Node 20+ and npm 10+
- Access to the Supabase project and Duda API credentials

## Setup

```bash
npm install                                  # installs all workspaces
cp backend/.env.example backend/.env         # then fill in the real values
cp frontend/.env.example frontend/.env
npm run prisma:generate -w backend
```

The database is remote — there is **no local database file**. Migrations run against Supabase via
`DIRECT_URL`, so only apply them deliberately:

```bash
npx prisma migrate deploy --schema=backend/prisma/schema.prisma
```

## Run both apps

```bash
npm run dev
```

- Backend API: http://localhost:4000 (health: http://localhost:4000/api/health)
- Frontend: http://localhost:5173
- Widget test harness: http://localhost:4000/public/test.html

In dev the two are separate origins, so the frontend targets `localhost:4000`. In production
`VITE_API_BASE_URL` is deliberately **unset** and API calls are relative — see `CLAUDE.md`.

## Useful commands

```bash
npm run dev -w backend                       # backend only
npm run dev -w frontend                      # frontend only
npm run build                                # build both (also runs the secret scanner)

npm run duda:test -w backend                 # list the live Duda catalogue
npm run duda:snapshot -w backend -- <id>     # dump one product read-only, before a risky write
npm run storage:ensure -w backend            # apply bucket size/mimetype limits (run after deploys)
npm run media:verify-upload -w backend       # check the direct-to-Supabase upload path still works
```

Catalogue migration from the legacy WordPress site (see `CLAUDE.md` for the staged plan):

```bash
npm run duda:import-products -w backend                            # dry run, writes nothing
npm run duda:import-products -w backend -- --confirm               # stage 1: title/SKU/images
npm run duda:import-products -w backend -- --descriptions --confirm # stage 2: descriptions
npm run duda:import-products -w backend -- --verify                # reconcile against the CSV
```

## Deployment

One Vercel project, Root Directory = repo root, configured by the root `vercel.json`. The
dashboard is the static build; `/api/*` and `/public/*` are rewritten to the Express function.

⚠️ The frontend build runs with the backend's secrets in scope, because Vercel has no
build-time/runtime environment split. `scripts/assert-no-secrets.mjs` runs after every frontend
build and fails it if a non-`VITE_` secret appears in `dist`. Don't widen `envPrefix` or add a
`define:` block in `frontend/vite.config.ts` — see the comment there and in `CLAUDE.md`.

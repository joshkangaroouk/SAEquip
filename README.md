# saequip-product-hub

Internal product-management dashboard. npm-workspaces monorepo with two apps:

- **backend/** — Node + TypeScript + Express + Prisma (SQLite). Serves the API. The database stores only the things that live *outside* Duda: download gating and captured leads. Product content itself lives in Duda.
- **frontend/** — Vite + React + TypeScript + Tailwind. The dashboard UI.

## Prerequisites

- Node 18+ and npm 9+

## Setup

```bash
npm install                       # installs all workspaces
cp backend/.env.example backend/.env
npm run prisma:generate -w backend
npm run prisma:migrate -w backend # creates backend/dev.db
```

## Run both apps

```bash
npm run dev
```

- Backend API: http://localhost:4000 (health check: http://localhost:4000/api/health)
- Frontend: http://localhost:5173

The frontend calls the backend health endpoint on load and shows **Backend: ok** (green) when the two apps can talk.

## Useful commands

```bash
npm run dev -w backend            # backend only
npm run dev -w frontend           # frontend only
npm run build                     # build both apps
npx prisma studio -w backend      # inspect the SQLite tables
```

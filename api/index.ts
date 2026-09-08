/**
 * Vercel serverless entry point for the whole API.
 *
 * Lives at the repo root, not in `backend/`, because this is a SINGLE Vercel
 * project: Root Directory is the repo root so one deployment serves both the
 * static dashboard (`frontend/dist`) and the API. Vercel only picks up
 * functions from an `api/` directory at the project root.
 *
 * Vercel invokes the default export as the request handler, and an Express app
 * IS one (`(req, res) => void`), so the entire existing app is reused rather
 * than split into per-route functions — Express keeps doing all the routing and
 * there stays exactly one place routes are defined. `vercel.json` rewrites both
 * `/api/*` and `/public/*` here.
 *
 * `backend/src/index.ts` skips `app.listen()` when `process.env.VERCEL` is set,
 * so the same module still runs as an ordinary server locally and on any
 * container host.
 *
 * The `.js` specifier resolving to `backend/src/index.ts` is correct for this
 * ESM TypeScript setup and bundles cleanly — verified with esbuild, which is
 * what Vercel's Node builder uses.
 */
export { default } from "../backend/src/index.js";

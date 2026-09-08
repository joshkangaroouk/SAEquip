/**
 * Vercel serverless entry point.
 *
 * Vercel invokes the default export as the request handler; an Express app IS
 * one (`(req, res) => void`), so the whole existing app is reused unchanged
 * rather than being split into per-route functions. `backend/vercel.json`
 * rewrites every path here, so Express keeps doing all the routing and there
 * is exactly one place routes are defined.
 *
 * `src/index.ts` skips `app.listen()` when `process.env.VERCEL` is set, so the
 * same module still runs as a normal server locally and on any container host.
 */
export { default } from "../src/index.js";

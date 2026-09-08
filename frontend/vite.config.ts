import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },

  /**
   * ⚠️ SECURITY — do not widen, and do not add a `define:` block that exposes
   * `process.env`.
   *
   * The dashboard and the API are a single Vercel project, so this build runs
   * with the BACKEND's environment in scope: the Supabase service-role key
   * (which bypasses every RLS policy), the Duda API credentials and the
   * database URL are all present in `process.env` while Vite runs.
   *
   * Only variables matching this prefix are inlined into the client bundle.
   * `VITE_` is Vite's default, pinned explicitly so widening it has to be a
   * deliberate edit to this line rather than an accident. Anything reaching the
   * client here is public to every visitor.
   *
   * `scripts/assert-no-secrets.mjs` runs after the build and fails it if a
   * backend secret is found in `dist`, so a mistake here is caught rather than
   * shipped.
   */
  envPrefix: ["VITE_"],
});

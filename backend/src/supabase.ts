import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Server-side Supabase client, built with the SERVICE ROLE key.
 *
 * This key bypasses row-level security and must never reach the browser.
 * We disable session persistence/refresh — the server only verifies tokens.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

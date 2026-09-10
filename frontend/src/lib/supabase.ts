import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Copy frontend/.env.example to frontend/.env and fill them in.",
  );
}

/**
 * Browser Supabase client — uses the public anon key.
 *
 * `detectSessionInUrl` defaults to true, which is what makes the password
 * reset flow work: the emailed link carries its token in the URL FRAGMENT and
 * this client exchanges it for a session on load. Don't disable it.
 *
 * ⚠️ Consequence worth knowing: a recovery link is effectively a one-time
 * login. Whoever opens it holds a real session, which is why the emailed link
 * must land on /reset-password (where the password is changed and the session
 * is then torn down) rather than on the app root.
 */
export const supabase = createClient(url, anonKey);

import { supabase } from "./supabase";

const API_BASE = "http://localhost:4000";

/**
 * fetch wrapper for backend calls. Automatically attaches the current Supabase
 * session's access token as an `Authorization: Bearer <token>` header.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Base URL for backend calls.
 *
 * Empty in production, i.e. relative: the dashboard and the API are one Vercel
 * project on one origin, so `/api/...` resolves to the same deployment. That
 * removes the CORS relationship between them entirely, and removes the old
 * gotcha where this value was baked in at build time and any change to the API
 * URL required a full rebuild.
 *
 * In dev the two really are separate origins (Vite on 5173, Express on 4000),
 * so a base is needed. `VITE_API_BASE_URL` still overrides both, for pointing
 * a local dashboard at a deployed API.
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:4000" : "");

/**
 * The activity log's "one save" (backend middleware/activity.ts): every
 * changing request made while `inActivityBatch()` runs carries the same
 * `X-Activity-Batch` id, so the Activity page can show a product save, with
 * its logo switches and translation batches, as one group.
 *
 * ⚠️ `fn` is STARTED synchronously, before anything is awaited: the product
 * editor's save opens Chrome's translators inside the click, which needs the
 * click's user activation still to be live.
 */
let activityBatch: string | null = null;
export function inActivityBatch<T>(fn: () => Promise<T>): Promise<T> {
  const previous = activityBatch;
  const mine = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : null;
  activityBatch = mine;
  return fn().finally(() => {
    if (activityBatch === mine) activityBatch = previous;
  });
}

/**
 * fetch wrapper for backend calls. Automatically attaches the current Supabase
 * session's access token as an `Authorization: Bearer <token>` header.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const batch = activityBatch;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  const method = (init.method ?? "GET").toUpperCase();
  if (batch && method !== "GET" && method !== "HEAD" && !headers.has("X-Activity-Batch")) {
    headers.set("X-Activity-Batch", batch);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  /*
   * ⚠️ `mfa_required` means the session is valid but only aal1, and the
   * account has a confirmed authenticator (see requireAuth). Every request
   * will fail this way until a code is entered, so end the session and let
   * the login screen run the challenge properly. Handled HERE, not in
   * apiJson: Products, Quotes, Resource Requests and Media call apiFetch
   * directly, and used to show "returned 403" and load nothing.
   */
  if (res.status === 403) {
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown } | null;
    if (body?.error === "mfa_required") {
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/login");
    }
    // The account must set up two-factor first (invited users, the super
    // admin): every request fails until it has, so go and do it.
    // ⚠️ Refresh the session FIRST. One signed in before the requirement was
    // set (an account just made super admin) still holds the old
    // app_metadata, so /setup-2fa read "nothing owed" and sent it back here:
    // a reload loop until the token expired. A refreshed session carries the
    // server's current app_metadata; if the refresh fails, sign out, since a
    // fresh sign-in carries it too.
    if (body?.error === "mfa_setup_required" && window.location.pathname !== "/setup-2fa") {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
        window.location.assign("/login");
      } else window.location.assign("/setup-2fa");
    }
    // Disabled by the super admin: the session is useless, so end it and say why.
    if (body?.error === "account_disabled") {
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/login?disabled=1");
    }
  }

  /*
   * ⚠️ A 401 for a token we DID send means the session is gone on the server:
   * signed out on another device (or everywhere after a password change),
   * or the account deleted. It used to be ignored, so the dashboard stayed on
   * screen failing every request with "unauthorized" until its refresh failed,
   * up to an hour later (USERS-AUDIT M6). Refresh once to tell that apart from
   * a token that simply expired in flight; a refusal the server meant ends the
   * session here too. A network failure (Supabase unreachable) does NOT: it
   * says nothing about the session, and signing everyone out on a blip would
   * be worse than the stale screen.
   */
  if (res.status === 401 && session?.access_token && !PUBLIC_PATHS.has(window.location.pathname)) {
    const { error } = await supabase.auth.refreshSession();
    if (error && !isAuthRetryableFetchError(error)) {
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/login?ended=1");
    }
  }
  return res;
}

/** Pages that work without a session; a 401 there must not navigate away. */
const PUBLIC_PATHS = new Set(["/login", "/forgot-password", "/reset-password", "/invite"]);

/**
 * A failed backend call, with the pieces callers actually branch on.
 *
 * `fieldErrors` is populated from the backend's zod `details.fieldErrors`, so a
 * form can drop it straight into <Field error={...}> per input.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;
  readonly upstreamStatus?: number;
  /** The parsed response body, for a caller that needs more than the message. */
  readonly body?: Record<string, unknown>;

  constructor(
    message: string,
    opts: { status: number; fieldErrors?: Record<string, string[]>; upstreamStatus?: number; body?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.fieldErrors = opts.fieldErrors;
    this.upstreamStatus = opts.upstreamStatus;
    this.body = opts.body;
  }
}

/** Words for the error codes the API sends without a `detail`; anything else as sent. */
const ERROR_WORDS: Record<string, string> = {
  unauthorized: "Your session has ended. Sign in again.",
  not_found: "That no longer exists. Refresh the page.",
  forbidden_domain: "Only staff email addresses can be used for this.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  super_admin_required: "Only the super admin can do this.",
  internal_error: "Something went wrong on the server. Try again.",
  no_editor_access: "You don't have Website Editor access.",
};
function errorWords(code: unknown): string | undefined {
  if (typeof code !== "string" || !code) return undefined;
  return ERROR_WORDS[code] ?? code;
}

/**
 * JSON call that throws a normalised ApiError instead of returning a Response.
 *
 * The backend reports failures in three different shapes, so unwrapping them
 * lives here once rather than being re-implemented at every call site:
 *   1. zod validation  -> { error, details: { fieldErrors } }
 *   2. Duda passthrough -> { error, detail, upstream_status }
 *   3. everything else  -> { error }
 */
export async function apiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await apiFetch(path, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  // 204 and other empty bodies are legitimate successes.
  const text = await res.text();
  const json: Record<string, unknown> = text
    ? ((() => {
        try {
          return JSON.parse(text) as Record<string, unknown>;
        } catch {
          return {};
        }
      })())
    : {};

  if (!res.ok) {
    const details = json.details as { fieldErrors?: Record<string, string[]> } | undefined;
    const fieldErrors = details?.fieldErrors;
    const upstream = json.upstream_status as number | undefined;
    /*
     * ⚠️ "Duda error" only when the error came from Duda (`upstream_status`).
     * Every `detail` used to be labelled that way, so the Hub refusing on
     * purpose read as Duda failing: "Duda error : You can't disable your own
     * account." (USERS-AUDIT M5). A bare code gets words where it has some.
     */
    const message = details
      ? `Validation error: ${JSON.stringify(fieldErrors ?? details)}`
      : json.detail
        ? upstream !== undefined
          ? `Duda error ${upstream}: ${String(json.detail)}`
          : String(json.detail)
        : errorWords(json.error) || `Request failed (${res.status})`;

    throw new ApiError(message, {
      status: res.status,
      fieldErrors,
      upstreamStatus: json.upstream_status as number | undefined,
      body: json,
    });
  }

  return json as T;
}

import { supabase } from "./supabase";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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

  constructor(
    message: string,
    opts: { status: number; fieldErrors?: Record<string, string[]>; upstreamStatus?: number },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.fieldErrors = opts.fieldErrors;
    this.upstreamStatus = opts.upstreamStatus;
  }
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
    const message = details
      ? `Validation error: ${JSON.stringify(fieldErrors ?? details)}`
      : json.detail
        ? `Duda error ${(json.upstream_status as number | undefined) ?? ""}: ${String(json.detail)}`
        : (json.error as string | undefined) || `Request failed (${res.status})`;

    throw new ApiError(message, {
      status: res.status,
      fieldErrors,
      upstreamStatus: json.upstream_status as number | undefined,
    });
  }

  return json as T;
}

/**
 * Upload helper for multipart/form-data. Attaches the Bearer token but does NOT
 * set Content-Type — the browser must set the multipart boundary itself.
 */
export async function apiUpload(
  path: string,
  formData: FormData,
  method: string = "POST",
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`${API_BASE}${path}`, { method, headers, body: formData });
}

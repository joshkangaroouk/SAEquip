import "dotenv/config";
import { z } from "zod";

/**
 * Environment schema.
 *
 * DB + Supabase values are REQUIRED. Duda API credentials are now REQUIRED too
 * (the read-layer needs them). We throw with a clear message if any are missing.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),

  // Database (Supabase Postgres).
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required (Supabase pooler string, port 6543, ?pgbouncer=true)"),
  DIRECT_URL: z
    .string()
    .min(1, "DIRECT_URL is required (Supabase direct string, port 5432)"),

  // Supabase auth (server-side).
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Comma-separated list of email domains allowed to authenticate.
  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .min(1, 'ALLOWED_EMAIL_DOMAINS is required (e.g. "kangaroouk.com,saequip.com")'),

  // Comma-separated list of origins allowed to call the PUBLIC widget API.
  PUBLIC_ALLOWED_ORIGINS: z.string().default(""),

  // --- Duda API (now required for the product read-layer) ---
  DUDA_API_USER: z.string().min(1, "DUDA_API_USER is required (Duda API credentials)"),
  DUDA_API_PASS: z.string().min(1, "DUDA_API_PASS is required (Duda API credentials)"),
  DUDA_API_BASE_URL: z.string().url().default("https://api.duda.co/api"),
  // 8a8f03b5 = saequip-2, the site in use from 2026-09-07. The previous site
  // (099434f3 / saequip.multiscreensite.com) is retired. Product ids, SKUs and
  // slugs carried over unchanged when the site was duplicated, so HubProduct
  // rows keyed by dudaProductId still match — no re-keying was needed.
  DUDA_SITE_NAME: z.string().default("8a8f03b5"),

  // --- Resend (OPTIONAL — quote-request email notifications).
  // The app must run fine with none of these set; email is inert until all
  // three are present (see services/email.ts isEmailConfigured()).
  RESEND_API_KEY: z.string().optional(),
  QUOTE_NOTIFY_FROM: z.string().optional(),
  QUOTE_NOTIFY_TO: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  const lines = Object.entries(fieldErrors)
    .filter(([, messages]) => messages && messages.length)
    .map(([key, messages]) => `  - ${key}: ${messages!.join("; ")}`);

  const summary = `Invalid environment configuration:\n${lines.join("\n")}`;
  console.error(summary);

  /**
   * ⚠️ Throw rather than `process.exit(1)` on a serverless platform.
   *
   * This module is evaluated when the function is imported, so exiting the
   * process there kills the invocation before anything is flushed — the caller
   * gets an opaque `FUNCTION_INVOCATION_FAILED` and the log may show nothing
   * at all. A thrown Error carries the missing variable names into the
   * platform's error reporting, which is the difference between "it's broken"
   * and "DUDA_API_PASS isn't set".
   *
   * Locally, exiting is still the better behaviour: it stops `npm run dev`
   * immediately with a readable message instead of a stack trace.
   */
  if (process.env.VERCEL) {
    throw new Error(
      `${summary}\n\nSet these in the Vercel project's Environment Variables (Production), then redeploy.`,
    );
  }

  console.error("\nCopy backend/.env.example to backend/.env and fill in the required values.");
  process.exit(1);
}

const raw = parsed.data;

/** Normalized list of allowed email domains (lowercased, trimmed). */
const allowedEmailDomains = raw.ALLOWED_EMAIL_DOMAINS.split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

/** Origins allowed to call the public widget API (exact-match). */
const publicAllowedOrigins = raw.PUBLIC_ALLOWED_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const env = { ...raw, allowedEmailDomains, publicAllowedOrigins };

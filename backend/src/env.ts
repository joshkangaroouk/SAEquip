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
  DUDA_SITE_NAME: z.string().default("099434f3"),

  // --- Resend (OPTIONAL — quote-request email notifications).
  // The app must run fine with none of these set; email is inert until all
  // three are present (see services/email.ts isEmailConfigured()).
  RESEND_API_KEY: z.string().optional(),
  QUOTE_NOTIFY_FROM: z.string().optional(),
  QUOTE_NOTIFY_TO: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:\n");
  const fieldErrors = parsed.error.flatten().fieldErrors;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length) console.error(`  - ${key}: ${messages.join("; ")}`);
  }
  console.error(
    "\nCopy backend/.env.example to backend/.env and fill in the required values.",
  );
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

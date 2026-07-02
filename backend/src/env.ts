import "dotenv/config";
import { z } from "zod";

/**
 * Environment schema.
 *
 * DB + Supabase values are REQUIRED now — the app cannot serve auth without
 * them, so we throw with a clear message if any are missing.
 *
 * Duda credentials remain optional at this stage — we only warn. They aren't
 * used until the Duda integration step.
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

  // --- Duda API (not required yet; wired up in a later step) ---
  DUDA_API_USER: z.string().default(""),
  DUDA_API_PASS: z.string().default(""),
  DUDA_API_BASE_URL: z.string().url().default("https://api.duda.co/api"),
  DUDA_SITE_NAME: z.string().default("099434f3"),
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

export const env = { ...raw, allowedEmailDomains };

if (!env.DUDA_API_USER || !env.DUDA_API_PASS) {
  console.warn(
    "[env] Duda API credentials are not set (DUDA_API_USER / DUDA_API_PASS). " +
      "This is fine for now — Duda integration is added in a later step.",
  );
}

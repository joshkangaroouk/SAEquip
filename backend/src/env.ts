import "dotenv/config";
import { z } from "zod";

/**
 * Environment schema.
 *
 * Duda credentials are intentionally optional at this stage — the app must
 * boot and pass a health check without them. We only warn if they're missing.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default("file:../dev.db"),
  DUDA_API_USER: z.string().default(""),
  DUDA_API_PASS: z.string().default(""),
  DUDA_API_BASE_URL: z.string().url().default("https://api.duda.co/api"),
  DUDA_SITE_NAME: z.string().default("099434f3"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // A genuine schema violation (e.g. a non-numeric PORT) is fatal.
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (!env.DUDA_API_USER || !env.DUDA_API_PASS) {
  console.warn(
    "[env] Duda API credentials are not set (DUDA_API_USER / DUDA_API_PASS). " +
      "This is fine for now — Duda integration is added in a later step.",
  );
}

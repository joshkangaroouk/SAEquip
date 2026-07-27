/**
 * READ-ONLY snapshot. Run with:
 *   npm run duda:snapshot -- <productId>
 *   npm run --silent duda:snapshot -- <productId> > before.json
 *
 * Use `npm run --silent` when redirecting to a file — without it npm prints its
 * own banner to stdout and the result isn't valid JSON.
 *
 * Prints the full Duda product JSON plus the store-level option catalog, so a
 * replace-whole-set write can be reversed by hand if it goes wrong. CLAUDE.md
 * requires a snapshot before any destructive write against real data.
 *
 * Makes GET requests only — safe against live products.
 */
import { env } from "../env.js";

const site = env.DUDA_SITE_NAME;
const auth = "Basic " + Buffer.from(`${env.DUDA_API_USER}:${env.DUDA_API_PASS}`).toString("base64");

const productId = process.argv.slice(2).find((a) => !a.startsWith("-"));
if (!productId) {
  console.error(`Usage: npm run duda:snapshot -- <productId>\n`);
  console.error(`  e.g. npm run duda:snapshot -- 01KW9R473XZGWZWC5206EPYAWB   # EX Heater`);
  process.exit(1);
}

async function get<T>(path: string): Promise<T | { _error: string }> {
  const res = await fetch(`${env.DUDA_API_BASE_URL}${path}`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });
  const raw = await res.text();
  if (!res.ok) return { _error: `${res.status}: ${raw.slice(0, 300)}` };
  try {
    return JSON.parse(raw) as T;
  } catch {
    return { _error: `unparseable body: ${raw.slice(0, 200)}` };
  }
}

const [product, options, store] = await Promise.all([
  get(`/sites/multiscreen/${site}/ecommerce/products/${productId}`),
  get(`/sites/multiscreen/${site}/ecommerce/options`),
  get(`/sites/multiscreen/${site}/ecommerce/store`),
]);

console.log(
  JSON.stringify(
    {
      _snapshot: {
        // Timestamp comes from the runtime, not hardcoded, so successive
        // snapshots of the same product are distinguishable.
        takenAt: new Date().toISOString(),
        site,
        productId,
      },
      store,
      product,
      storeLevelOptionCatalog: options,
    },
    null,
    2,
  ),
);

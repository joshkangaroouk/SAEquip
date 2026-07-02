/**
 * READ-ONLY investigation probe. Run with: npm run duda:probe-customfields
 *
 * Makes GET requests ONLY (never writes) to candidate endpoints to discover
 * whether Duda exposes custom-field definitions / a write surface. Prints
 * {url, httpStatus, bodySnippet} per endpoint. A 404 is a valid, informative
 * result — we catch per-request and keep going.
 */
import { env } from "../env.js";

const site = env.DUDA_SITE_NAME;
const PRODUCT_ID = "01KW9R473XZGWZWC5206EPYAWB"; // EX Heater
const auth = "Basic " + Buffer.from(`${env.DUDA_API_USER}:${env.DUDA_API_PASS}`).toString("base64");

const candidates = [
  `/sites/multiscreen/${site}/ecommerce/custom-fields`,
  `/sites/multiscreen/${site}/ecommerce/products/${PRODUCT_ID}/custom-fields`,
  `/sites/multiscreen/${site}/ecommerce/stores/custom-fields`,
  `/sites/multiscreen/${site}/ecommerce/store`,
];

console.log(`Probing custom-field endpoints (GET only) for site "${site}"\n`);

for (const path of candidates) {
  const url = `${env.DUDA_API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
    });
    const body = await res.text();
    console.log(`[${res.status}] GET ${path}`);
    console.log(`   ${body.slice(0, 400).replace(/\s+/g, " ")}\n`);
  } catch (err) {
    console.log(`[ERR] GET ${path}`);
    console.log(`   ${err instanceof Error ? err.message : String(err)}\n`);
  }
}

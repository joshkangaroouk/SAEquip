/**
 * Standalone smoke test for the Duda API creds + endpoint path.
 * Run with: npm run duda:test
 *
 * Prints each product's name + sku and the total count. On a 401/404 it prints
 * the exact upstream error so you know creds or the endpoint path need fixing.
 */
import { duda } from "../services/duda.js";

async function main() {
  const list = await duda.listProducts({ limit: 100 });
  const total = list.total_responses ?? list.results.length;

  console.log(`Duda store "${process.env.DUDA_SITE_NAME ?? "8a8f03b5"}" — ${total} product(s):\n`);
  for (const p of list.results) {
    console.log(`  ${p.name} / ${p.sku}`);
  }
  console.log(`\nTotal: ${total}`);
}

main().catch((err) => {
  console.error("duda:test FAILED:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

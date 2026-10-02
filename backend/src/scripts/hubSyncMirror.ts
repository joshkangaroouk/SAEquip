/**
 * Refresh every HubProduct's mirror of Duda — name, sku, slug, thumbnail and
 * status — from ONE paged list call, for every product in the store.
 *
 *   npm run hub:sync-mirror --workspace=backend              # dry run: prints what would change
 *   npm run hub:sync-mirror --workspace=backend -- --confirm # writes it
 *
 * Why this exists alongside `duda:import-products -- --sync-hub`: that pass
 * walks the WordPress import ledger, so a product created in the Hub after the
 * import is invisible to it. This one walks Duda itself.
 *
 * Writes only through `syncHubProduct`, the same function every route uses, so
 * the two cannot disagree about what is mirrored. Never touches the Hub-owned
 * description copy, and never creates a row for a product the Hub has not
 * seen — that happens when a product is first opened in the dashboard.
 */
import { prisma } from "../prisma.js";
import { duda } from "../services/duda.js";
import { syncHubProduct } from "../services/hubProduct.js";

const confirm = process.argv.includes("--confirm");

async function main() {
  const products = await duda.listAllProducts();
  const hub = new Map(
    (
      await prisma.hubProduct.findMany({
        select: { dudaProductId: true, name: true, sku: true, slug: true, thumbnailUrl: true, status: true },
      })
    ).map((h) => [h.dudaProductId, h]),
  );

  let changed = 0;
  let unchanged = 0;
  let notInHub = 0;
  for (const p of products) {
    const h = hub.get(p.id);
    if (!h) {
      notInHub++;
      continue;
    }
    const next = {
      name: p.name ?? null,
      sku: p.sku ?? null,
      slug: p.seo?.product_url?.trim() || null,
      thumbnailUrl: p.images?.[0]?.url?.trim() || null,
      status: p.status ?? null,
    };
    const diffs = (Object.keys(next) as (keyof typeof next)[]).filter((k) => h[k] !== next[k]);
    if (diffs.length === 0) {
      unchanged++;
      continue;
    }
    changed++;
    console.log(`  ${confirm ? "✓" : "·"} ${p.name}: ${diffs.map((k) => `${k} ${JSON.stringify(h[k])} → ${JSON.stringify(next[k])}`).join(", ")}`);
    if (confirm) await syncHubProduct(p);
  }

  const orphans = [...hub.keys()].filter((id) => !products.some((p) => p.id === id));
  console.log(
    `\n${confirm ? "Updated" : "Would update"} ${changed}, ${unchanged} already current, ` +
      `${notInHub} in Duda with no Hub row yet, ${orphans.length} Hub row(s) with no Duda product.`,
  );
  if (orphans.length) console.log(`  Orphans (deleted in Duda directly?): ${orphans.join(", ")}`);
  if (!confirm && changed) console.log("\nDry run — re-run with --confirm to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

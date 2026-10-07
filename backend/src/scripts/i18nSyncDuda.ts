/**
 * Copy Duda's own translations of product names and category titles into the
 * Hub (see services/i18n/dudaHarvest.ts for why the published pages are the
 * source).
 *
 *   npm run i18n:sync-duda --workspace=backend                      # dry run, every site language
 *   npm run i18n:sync-duda --workspace=backend -- --confirm
 *   npm run i18n:sync-duda --workspace=backend -- --locale ar --only ex-heater
 *
 * Read-only against Duda and the public site; writes only DudaTranslation.
 * Re-run after the client changes translations in Duda → Store Languages and
 * republishes.
 */
import { prisma } from "../prisma.js";
import { harvestDuda, siteLanguages } from "../services/i18n/dudaHarvest.js";
import { normaliseLocale } from "../services/i18n/locales.js";

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

async function main() {
  let langs = await siteLanguages();
  const wanted = arg("--locale");
  if (wanted) langs = langs.filter((l) => l.locale === normaliseLocale(wanted));
  if (!langs.length) {
    console.log(`\nNo translated languages on the site${wanted ? ` matching "${wanted}"` : ""} — nothing to copy.\n`);
    return;
  }
  for (const lang of langs) {
    console.log(`\n${lang.locale} (Duda code "${lang.code}", pages under /${lang.code}/) …`);
    const r = await harvestDuda(lang, { confirm, only: arg("--only") });
    console.log(`  products:   ${r.products.found}/${r.products.total} names found, ${r.products.translated} translated in Duda (the rest are still English there)`);
    if (!arg("--only")) console.log(`  categories: ${r.categories.found}/${r.categories.total} titles found, ${r.categories.translated} translated in Duda`);
    console.log(`  options:    ${r.options.found} option and choice names found, ${r.options.translated} translated in Duda${r.options.error ? ` — ✗ ${r.options.error}` : ""}`);
    for (const s of r.samples) console.log(`    e.g. ${s}`);
    for (const f of [...r.products.failed, ...r.categories.failed].slice(0, 10)) console.log(`  ✗ ${f}`);
    console.log(confirm ? `  wrote ${r.written} translation(s)` : "  dry run — re-run with --confirm to write");
    if (r.products.failed.length || r.categories.failed.length) process.exitCode = 1;
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

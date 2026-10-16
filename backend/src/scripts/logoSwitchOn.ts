/**
 * Switch one catalogue logo ON for every visible product (SA Equip, 16 Oct
 * 2026: UKCA everywhere, SA ENDURE and accessories included).
 *
 *   npm run logos:switch-on --workspace=backend -- --file ukca.png [--confirm]
 *
 * The logo is found by its media FILE, as the import does (labels get
 * renamed). Only adds links; never removes one. Hidden products are left
 * alone. ⚠️ Never use it for a hazardous-area mark (Ex, IECEx, Inmetro, a
 * Zone): SA ENDURE must never carry those, and this switches on everywhere.
 * Dry run by default.
 */
import "dotenv/config";
import { prisma } from "../prisma.js";
import { duda } from "../services/duda.js";

const confirm = process.argv.includes("--confirm");
const i = process.argv.indexOf("--file");
const file = i !== -1 ? process.argv[i + 1] : undefined;
const HAZARDOUS = /(^|[^a-z])ex([^a-z]|$)|iecex|inmetro|zone|atex/i;

async function main() {
  if (!file) throw new Error("pass --file <the logo's media filename>");
  const logos = await prisma.logo.findMany({ where: { mediaAsset: { filename: file } }, include: { mediaAsset: true } });
  if (logos.length !== 1) throw new Error(`${logos.length} logos use the file ${file}; expected exactly one`);
  const logo = logos[0];
  if (HAZARDOUS.test(`${logo.label} ${logo.alt} ${file}`)) throw new Error(`refusing: "${logo.alt || logo.label}" is a hazardous-area mark`);
  const visible = new Set((await duda.listAllProducts()).filter((p) => p.status === "ACTIVE").map((p) => p.id));
  const hub = await prisma.hubProduct.findMany({ select: { id: true, dudaProductId: true, name: true, logos: { select: { logoId: true } } } });
  const targets = hub.filter((h) => visible.has(h.dudaProductId));
  const add = targets.filter((h) => !h.logos.some((l) => l.logoId === logo.id));
  console.log(`\n${confirm ? "Applying" : "Dry run —"} "${logo.alt || logo.label}" (${file}) ON for every visible product`);
  console.log(`  visible ${targets.length}: already on ${targets.length - add.length}, to switch on ${add.length}`);
  console.log(`  ${add.map((h) => h.name).join("; ")}`);
  if (!confirm) { console.log("\nNothing written.\n"); return; }
  await prisma.productLogo.createMany({ data: add.map((h) => ({ hubProductId: h.id, logoId: logo.id })), skipDuplicates: true });
  const on = await prisma.productLogo.count({ where: { logoId: logo.id, hubProductId: { in: targets.map((h) => h.id) } } });
  console.log(`  ${on === targets.length ? "✓" : "✗"} on for ${on} of ${targets.length} visible products\n`);
  if (on !== targets.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err instanceof Error ? err.message : err, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

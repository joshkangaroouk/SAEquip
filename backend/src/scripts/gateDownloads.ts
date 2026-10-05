/**
 * Gate every download: the resources pages then ask for the visitor's details
 * before a file opens (decided 2026-10-05).
 *
 *   npm run downloads:gate --workspace=backend                       # dry run
 *   npm run downloads:gate --workspace=backend -- --confirm          # gate all
 *   npm run downloads:gate --workspace=backend -- --ungate --confirm # undo
 *
 * ⚠️ Run it only AFTER the code that understands gated downloads is live.
 * The previous code lists ungated files only, so gating first would empty all
 * three resources pages until the deploy landed. New downloads are written
 * gated by the server, so this is a one-off for the files that already exist.
 */
import { prisma } from "../prisma.js";

const confirm = process.argv.includes("--confirm");
const ungate = process.argv.includes("--ungate");

async function main() {
  const target = !ungate;
  const [total, todo] = await Promise.all([
    prisma.download.count(),
    prisma.download.count({ where: { gated: !target } }),
  ]);
  console.log(`\n${total} downloads; ${todo} ${ungate ? "gated" : "ungated"}.`);
  if (!todo) {
    console.log(`Nothing to do — every download is already ${target ? "gated" : "ungated"}.\n`);
    return;
  }
  if (!confirm) {
    console.log(`Dry run — re-run with --confirm to ${ungate ? "ungate" : "gate"} ${todo}.\n`);
    return;
  }
  const { count } = await prisma.download.updateMany({ where: { gated: !target }, data: { gated: target } });
  const left = await prisma.download.count({ where: { gated: !target } });
  console.log(`${ungate ? "Ungated" : "Gated"} ${count}; ${left} left ${ungate ? "gated" : "ungated"}.\n`);
  if (left) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

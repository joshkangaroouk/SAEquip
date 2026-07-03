// Copy the hand-written widget assets into the compiled runtime so the
// `node dist/index.js` server can serve them. Cross-platform + idempotent.
import { rmSync, cpSync, existsSync } from "node:fs";

const src = "src/public-widget";
const dest = "dist/public-widget";

if (!existsSync(src)) {
  console.error(`[copy-widget] source ${src} not found`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-widget] copied ${src} -> ${dest}`);

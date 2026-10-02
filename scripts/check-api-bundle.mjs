#!/usr/bin/env node
/**
 * Fails if the serverless API's import graph pulls in a package known to break
 * it on Vercel, or code that was never meant to run on the server.
 *
 *   node scripts/check-api-bundle.mjs
 *
 * Runs FIRST in vercel.json's buildCommand, so a bad import fails the BUILD and
 * the previous deployment stays live, rather than shipping a function that
 * crashes at load. Also runs in the pre-push hook.
 *
 * ⚠️ Why a denylist and not "load the bundle and see": the failure this exists
 * for does not reproduce locally. Importing `sanitize-html` makes the whole
 * function fail at module load ON VERCEL — FUNCTION_INVOCATION_FAILED on every
 * /api and /public route, the live widget included — while the same code runs
 * perfectly under tsx and node. It has happened twice, the second time through
 * an innocent-looking helper (`stripAnchors`) that lived beside the sanitiser.
 * The only reliable signal available before deploy is the import graph itself.
 *
 * Bundles with esbuild (the same tool Vercel's Node builder uses) with every
 * package left external, so the result is exactly the set of packages the
 * function will `import` at cold start.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Packages that must never be imported by the API at runtime, and why. */
const FORBIDDEN_PACKAGES = {
  "sanitize-html": "crashes the whole function at load on Vercel (twice). Script-side only — see services/anchors.ts.",
  "@napi-rs/canvas": "a ~30MB native renderer, a backend devDependency for the PDF-preview backfill only.",
  "pdfjs-dist": "a backend devDependency for the PDF-preview backfill only.",
  jsdom: "a devDependency for widget:test only.",
};

/** Source files that must never be in the function's graph, and why. */
const FORBIDDEN_FILES = [
  [/backend\/src\/services\/descriptionHtml\.ts$/, "imports sanitize-html — server code must use services/anchors.ts"],
  [/backend\/src\/scripts\//, "CLI scripts run main() on import and may disconnect the shared Prisma client"],
];

const result = await build({
  entryPoints: [path.join(ROOT, "api/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  metafile: true,
  write: false,
  logLevel: "silent",
});

const { inputs, outputs } = result.metafile;

/** The import chain from the entry point to `target`, so a failure says WHERE it came in. */
function chainTo(isTarget) {
  const entry = Object.keys(inputs).find((p) => p.endsWith("api/index.ts"));
  const prev = new Map([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const cur = queue.shift();
    for (const imp of inputs[cur]?.imports ?? []) {
      if (isTarget(imp)) {
        const chain = [imp.path];
        for (let p = cur; p; p = prev.get(p)) chain.unshift(p);
        return chain;
      }
      if (!imp.external && inputs[imp.path] && !prev.has(imp.path)) {
        prev.set(imp.path, cur);
        queue.push(imp.path);
      }
    }
  }
  return null;
}

const problems = [];

const externals = new Set();
for (const out of Object.values(outputs)) for (const imp of out.imports) if (imp.external) externals.add(imp.path);
for (const [pkg, why] of Object.entries(FORBIDDEN_PACKAGES)) {
  const hit = [...externals].find((e) => e === pkg || e.startsWith(`${pkg}/`));
  if (hit) {
    const chain = chainTo((imp) => imp.external && (imp.path === pkg || imp.path.startsWith(`${pkg}/`)));
    problems.push(`package "${hit}" — ${why}\n      via ${chain ? chain.join("\n        → ") : "(chain not found)"}`);
  }
}

for (const [pattern, why] of FORBIDDEN_FILES) {
  const hit = Object.keys(inputs).find((p) => pattern.test(p));
  if (hit) {
    const chain = chainTo((imp) => pattern.test(imp.path));
    problems.push(`file ${hit} — ${why}\n      via ${chain ? chain.join("\n        → ") : "(chain not found)"}`);
  }
}

if (problems.length) {
  console.error(`\n✗ API bundle check FAILED — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  • ${p}\n`);
  console.error("  Deploying this would risk the whole API (and the live widget) failing at load.\n");
  process.exit(1);
}

console.log(
  `✓ API bundle check: ${Object.keys(inputs).length} source files, ${externals.size} packages — none forbidden`,
);

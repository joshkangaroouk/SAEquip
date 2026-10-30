#!/usr/bin/env node
/**
 * The CSP must allow every inline <script> in frontend/index.html by hash.
 *
 *   node scripts/check-csp-hash.mjs        (run by .githooks/pre-push)
 *
 * The pre-paint theme script in index.html runs before first paint and is
 * allowed through `script-src` in vercel.json by its sha256. Change one byte
 * of it — whitespace included — and the hash no longer matches: once the
 * policy is enforced (it is report-only today) the browser blocks the script
 * and every page paints light. Nothing else would notice.
 *
 * Fails when an inline script's hash is missing from script-src, and when
 * script-src lists a sha256 that no inline script has (a stale hash left
 * behind after an edit).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "frontend/index.html"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

// Inline classic scripts only: a <script> with no src. The hash covers the
// exact bytes between the tags.
const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(([, attrs]) => !/\bsrc\s*=/.test(attrs))
  .map(([, , body]) => `sha256-${crypto.createHash("sha256").update(body, "utf8").digest("base64")}`);

const cspHeaders = (vercel.headers ?? [])
  .flatMap((rule) => rule.headers ?? [])
  .filter((h) => /^Content-Security-Policy(-Report-Only)?$/i.test(h.key));
if (!cspHeaders.length) {
  console.error("✗ CSP hash check: no Content-Security-Policy header in vercel.json");
  process.exit(1);
}

let failed = false;
for (const header of cspHeaders) {
  const scriptSrc = header.value.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src ")) ?? "";
  const listed = [...scriptSrc.matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)].map((m) => m[1]);
  for (const hash of inline) {
    if (!listed.includes(hash)) {
      console.error(`✗ CSP hash check: ${header.key} script-src is missing '${hash}' (an inline script in frontend/index.html)`);
      failed = true;
    }
  }
  for (const hash of listed) {
    if (!inline.includes(hash)) {
      console.error(`✗ CSP hash check: ${header.key} script-src lists '${hash}', which matches no inline script — stale?`);
      failed = true;
    }
  }
}
if (failed) {
  console.error("  Recompute from the exact bytes between the tags and update vercel.json in the same commit.");
  process.exit(1);
}
console.log(`✓ CSP hash check: ${inline.length} inline script(s) in index.html, all allowed by script-src`);

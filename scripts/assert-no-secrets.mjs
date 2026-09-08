#!/usr/bin/env node
/**
 * Fail the build if a backend secret ended up in the public bundle.
 *
 * Why this exists: the dashboard and the API are ONE Vercel project, so the
 * frontend build runs with the backend's environment — including the Supabase
 * service-role key (which bypasses every RLS policy) and the Duda API
 * credentials. Vercel has no build-time/runtime split for environment
 * variables, so isolation is not available; verification is.
 *
 * Nothing should leak today: Vite only inlines `VITE_`-prefixed variables via
 * `import.meta.env`, no frontend file references `process.env`, and
 * `envPrefix` is pinned in vite.config.ts. But that is three conventions deep,
 * and a single `define:` entry or a widened prefix would quietly undo all of
 * it. This turns "should be fine" into something checked on every deploy.
 *
 * ⚠️ What this canNOT catch: a compromised dependency reading process.env and
 * exfiltrating it over the network during the build. Only running the frontend
 * build in an environment without those secrets prevents that (i.e. a separate
 * Vercel project). Documented in CLAUDE.md as the accepted residual risk of a
 * single project.
 *
 *   node scripts/assert-no-secrets.mjs [dist-dir]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DIST = process.argv[2] ?? "frontend/dist";

/**
 * Variables that must never appear in a public artifact.
 *
 * An allowlist of names to CHECK rather than a denylist of names to skip: a
 * new secret added to the environment is then covered only if it is named
 * here, which is the safer failure mode than a pattern that silently stops
 * matching. `VITE_*` values are deliberately absent — those are meant to ship.
 */
const SECRET_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "DUDA_API_USER",
  "DUDA_API_PASS",
  "RESEND_API_KEY",
  "QUOTE_NOTIFY_FROM",
  "QUOTE_NOTIFY_TO",
];

/** Short or structural values would false-positive; only check real secrets. */
const MIN_LENGTH = 12;

function walk(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    out = statSync(full).isDirectory() ? out.concat(walk(full)) : out.concat(full);
  }
  return out;
}

function main() {
  let files;
  try {
    files = walk(DIST);
  } catch {
    console.error(`✗ assert-no-secrets: cannot read ${DIST} — did the build run?`);
    process.exit(1);
  }

  const checking = [];
  const skipped = [];
  for (const name of SECRET_VARS) {
    const value = process.env[name];
    if (!value || value.length < MIN_LENGTH) {
      skipped.push(name);
      continue;
    }
    checking.push([name, value]);
    // Also check the DB password on its own: a URL could be reassembled or
    // partially inlined, and the password is the part that actually matters.
    const pw = /^[a-z]+:\/\/[^:]+:([^@]+)@/i.exec(value)?.[1];
    if (pw && pw.length >= MIN_LENGTH) checking.push([`${name} (password component)`, pw]);
  }

  const findings = [];
  for (const file of files) {
    // Read as latin1 so any byte sequence is searchable, including inside
    // source maps and fonts.
    const content = readFileSync(file, "latin1");
    for (const [name, value] of checking) {
      if (content.includes(value)) findings.push({ file, name });
    }
  }

  console.log(
    `assert-no-secrets: scanned ${files.length} file(s) in ${DIST} for ${checking.length} secret value(s)` +
      (skipped.length ? `; ${skipped.length} not set in this environment` : ""),
  );

  if (findings.length) {
    // Report the variable NAME and file only — never the value itself.
    console.error(`\n✗ SECRET FOUND IN THE PUBLIC BUNDLE — build failed\n`);
    for (const f of findings) console.error(`   ${f.name}  →  ${f.file}`);
    console.error(
      `\n  This bundle is served to anyone who loads the dashboard.\n` +
        `  Only VITE_-prefixed variables may reach the client. Check for a\n` +
        `  \`define:\` entry or a widened \`envPrefix\` in vite.config.ts, or a\n` +
        `  process.env reference in frontend/src.\n` +
        `  Treat the leaked credential as compromised and rotate it.\n`,
    );
    process.exit(1);
  }

  console.log("✓ no backend secrets in the public bundle\n");
}

main();

/**
 * Import the mass translation for one language (phase 3 of "Languages" in
 * CLAUDE.md).
 *
 *   npm run i18n:import --workspace=backend -- --locale ar             # dry run: validate, report
 *   npm run i18n:import --workspace=backend -- --locale ar --confirm   # save
 *
 * Reads migration/i18n/sources.json (from i18n:export-sources) and every
 * migration/i18n/<locale>/*.json part — arrays of {h: sourceHash, k: kind,
 * t: translation}. The ENGLISH comes from sources.json, never from the part
 * files, so a translation can only ever be attached to the text it was made
 * for.
 *
 * Every translation goes through the same validator as everything else; the
 * dry run lists each rejection with its reason so it can be fixed first.
 * --confirm saves through saveTranslations(), so a staff correction is never
 * overwritten and anything still unsafe is stored as rejected (English shown).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TranslationKind } from "@prisma/client";
import { prisma } from "../prisma.js";
import { normaliseLocale } from "../services/i18n/locales.js";
import { validateTranslation } from "../services/i18n/validate.js";
import { saveTranslations } from "../services/i18n/store.js";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../migration/i18n");
const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const localeArg = args[args.indexOf("--locale") + 1];

interface Source { kind: TranslationKind; sourceHash: string; sourceText: string }
interface Part { h: string; k: TranslationKind; t: string }

async function main() {
  const locale = normaliseLocale(localeArg);
  if (!locale || locale === "en") throw new Error(`--locale must be one of ar, zh, fr, de, pt-br, es (got ${localeArg})`);
  const sources: Source[] = JSON.parse(readFileSync(path.join(DIR, "sources.json"), "utf8"));
  const byKey = new Map(sources.map((s) => [`${s.kind}:${s.sourceHash}`, s]));

  const partDir = path.join(DIR, locale);
  if (!existsSync(partDir)) throw new Error(`no translations at ${partDir}`);
  const parts: Part[] = readdirSync(partDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => {
      const v = JSON.parse(readFileSync(path.join(partDir, f), "utf8"));
      if (!Array.isArray(v)) throw new Error(`${f} is not an array`);
      return v as Part[];
    });

  const seen = new Set<string>();
  const valid: { kind: TranslationKind; sourceText: string; text: string }[] = [];
  const rejected: string[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const key = `${p.k}:${p.h}`;
    const src = byKey.get(key);
    if (!src) {
      unknown.push(key);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const v = validateTranslation(src.kind, src.sourceText, String(p.t ?? ""));
    if (!v.ok) {
      rejected.push(`${p.h.slice(0, 10)} ${src.kind} ${v.reason}\n      EN: ${src.sourceText.slice(0, 140)}\n      ${locale}: ${String(p.t).slice(0, 140)}`);
      continue;
    }
    valid.push({ kind: src.kind, sourceText: src.sourceText, text: p.t });
  }
  const missing = sources.filter((s) => !seen.has(`${s.kind}:${s.sourceHash}`));

  console.log(`\n${locale}: ${sources.length} sources, ${parts.length} translations in ${partDir}`);
  console.log(`  valid ${valid.length} · rejected ${rejected.length} · missing ${missing.length} · unknown ${unknown.length}`);
  for (const r of rejected.slice(0, 40)) console.log(`  ✗ ${r}`);
  for (const m of missing.slice(0, 10)) console.log(`  · missing ${m.sourceHash.slice(0, 10)} ${m.kind}: ${m.sourceText.slice(0, 80)}`);
  if (unknown.length) console.log(`  · ${unknown.length} translation(s) for text no longer in sources.json (ignored)`);

  if (!confirm) {
    console.log(rejected.length || missing.length ? "\nDry run — fix the above, or import the valid ones with --confirm.\n" : "\nDry run — all valid. Re-run with --confirm to save.\n");
    if (rejected.length || missing.length) process.exitCode = 1;
    return;
  }
  const results = await saveTranslations(locale, valid, { origin: "MT", engine: "claude-code" });
  const count = (s: string) => results.filter((r) => r.status === s).length;
  console.log(`\nSaved ${count("saved")} · unchanged ${count("unchanged")} · kept staff ${count("kept-staff")} · rejected ${count("rejected")} · pass-through ${count("pass-through")}\n`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

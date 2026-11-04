#!/usr/bin/env node
/**
 * cn-audit — what tailwind-merge REMOVES, so a class that silently stops
 * applying is a reviewed decision rather than a surprise.
 *
 *   npx tsx frontend/scripts/cn-audit.mjs        (tsx: it imports src/lib/cn.ts)
 *
 * Two checks:
 *
 * 1. HARD: `FONT_SIZES` in src/lib/cn.ts equals the `fontSize` keys in
 *    tailwind.config.js. A size missing from FONT_SIZES is read as a text
 *    COLOUR by tailwind-merge and drops a real colour class. Exit 1 on drift.
 *
 * 2. REPORT: every class tailwind-merge drops, found statically —
 *    a) inside a single cn() call (e.g. a ui/ component's base vs its size);
 *    b) where a page passes `className` to a ui/ component, the base classes
 *       that className now overrides (it used to depend on CSS order).
 *    Arguments are resolved through string consts, `+`, ternaries, `&&`,
 *    `map[key]` lookups and relative imports, trying every combination of
 *    alternatives (one per argument, so mutually exclusive variants are never
 *    merged with each other). Anything dynamic is treated as empty.
 *    Read the report: each line is a class that no longer applies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { cn, FONT_SIZES } from "../src/lib/cn.ts";
import tailwindConfig from "../tailwind.config.js";

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(FRONTEND, "src");
const MAX_COMBOS = 2000;

// ---------------------------------------------------------------- check 1 --
const configSizes = Object.keys(tailwindConfig.theme?.extend?.fontSize ?? {}).sort();
const listed = [...FONT_SIZES].sort();
const sizesOk = JSON.stringify(configSizes) === JSON.stringify(listed);
console.log(
  sizesOk
    ? `✓ FONT_SIZES matches tailwind.config.js fontSize (${listed.join(", ")})`
    : `✗ FONT_SIZES drift\n    cn.ts:  ${listed.join(", ")}\n    config: ${configSizes.join(", ")}`,
);

// ---------------------------------------------------------------- parsing --
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) files.push(p);
  }
})(SRC);

const parsed = new Map();
function parse(file) {
  if (!parsed.has(file)) {
    const text = fs.readFileSync(file, "utf8");
    parsed.set(file, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  }
  return parsed.get(file);
}

/** Per-file environment: const name → string[] alternatives, plus imports. */
const envs = new Map();
function envOf(file) {
  if (envs.has(file)) return envs.get(file);
  const env = { consts: new Map(), imports: new Map(), file };
  envs.set(file, env);
  const sf = parse(file);
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith(".")) {
        const base = path.resolve(path.dirname(file), spec);
        const target = [base + ".ts", base + ".tsx", path.join(base, "index.ts")].find((f) => fs.existsSync(f));
        const named = node.importClause?.namedBindings;
        if (target && named && ts.isNamedImports(named)) {
          for (const el of named.elements) {
            env.imports.set(el.name.text, { file: target, name: (el.propertyName ?? el.name).text });
          }
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      let init = node.initializer;
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init) || ts.isParenthesizedExpression(init)) init = init.expression;
      if (ts.isObjectLiteralExpression(init)) {
        env.consts.set(node.name.text, { kind: "map", node: init });
      } else {
        env.consts.set(node.name.text, { kind: "expr", node: init });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return env;
}

function lookup(name, env, seen = new Set()) {
  const key = env.file + "#" + name;
  if (seen.has(key)) return null;
  seen.add(key);
  if (env.consts.has(name)) return { ...env.consts.get(name), env };
  const imp = env.imports.get(name);
  if (imp) return lookup(imp.name, envOf(imp.file), seen);
  return null;
}

const cartesian = (lists, join) => {
  let out = [""];
  for (const list of lists) {
    const next = [];
    for (const a of out) for (const b of list) next.push(join(a, b));
    out = next.length > MAX_COMBOS ? next.slice(0, MAX_COMBOS) : next;
  }
  return out;
};

/** Alternatives a string-valued expression can take; null if not static. */
function alts(expr, env, depth = 0) {
  if (!expr || depth > 12) return null;
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr))
    return alts(expr.expression, env, depth + 1);
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
  if (expr.kind === ts.SyntaxKind.FalseKeyword || expr.kind === ts.SyntaxKind.NullKeyword) return [""];
  if (ts.isIdentifier(expr)) {
    if (expr.text === "undefined") return [""];
    const found = lookup(expr.text, env);
    if (found?.kind === "expr") return alts(found.node, found.env, depth + 1);
    return null;
  }
  if (ts.isTemplateExpression(expr)) {
    const parts = [[expr.head.text]];
    for (const span of expr.templateSpans) {
      const a = alts(span.expression, env, depth + 1);
      if (!a) return null;
      parts.push(a, [span.literal.text]);
    }
    return cartesian(parts, (x, y) => x + y);
  }
  if (ts.isConditionalExpression(expr)) {
    const t = alts(expr.whenTrue, env, depth + 1);
    const f = alts(expr.whenFalse, env, depth + 1);
    if (!t && !f) return null;
    return [...(t ?? [""]), ...(f ?? [""])];
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.PlusToken) {
      const l = alts(expr.left, env, depth + 1);
      const r = alts(expr.right, env, depth + 1);
      return l && r ? cartesian([l, r], (x, y) => x + y) : null;
    }
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      const r = alts(expr.right, env, depth + 1);
      return r ? ["", ...r] : null;
    }
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      const l = alts(expr.left, env, depth + 1);
      const r = alts(expr.right, env, depth + 1);
      if (!l && !r) return null;
      return [...(l ?? []), ...(r ?? [""])];
    }
  }
  if (ts.isElementAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    const found = lookup(expr.expression.text, env);
    if (found?.kind === "map") {
      const values = [];
      for (const p of found.node.properties) {
        if (ts.isPropertyAssignment(p)) {
          const a = alts(p.initializer, found.env, depth + 1);
          if (a) values.push(...a);
        }
      }
      return values.length ? values : null;
    }
  }
  return null;
}

const tokens = (s) => s.split(/\s+/).filter(Boolean);
/** Classes in `input` that cn() drops (duplicates included, reported apart). */
function dropped(argStrings) {
  const input = tokens(argStrings.join(" "));
  const kept = new Map();
  for (const t of tokens(cn(...argStrings))) kept.set(t, (kept.get(t) ?? 0) + 1);
  const out = [];
  for (const t of input) {
    const n = kept.get(t) ?? 0;
    if (n > 0) kept.set(t, n - 1);
    else out.push(t);
  }
  return out;
}

function enclosingName(node) {
  for (let n = node.parent; n; n = n.parent) {
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name) return n.name.text;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
  }
  return null;
}

const rel = (f) => path.relative(FRONTEND, f);
const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

// --------------------------------------------------- collect cn() calls ----
const internal = new Map(); // "file:line" -> Set(dropped)
const passThrough = new Map(); // component name -> { file, line, argAlts, classNameIndex }

for (const file of files) {
  const sf = parse(file);
  const env = envOf(file);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cn") {
      let classNameIndex = -1;
      const argAlts = node.arguments.map((a, i) => {
        if (ts.isIdentifier(a) && a.text === "className") {
          classNameIndex = i;
          return [""];
        }
        return alts(a, env) ?? [""];
      });
      const where = `${rel(file)}:${lineOf(sf, node)}`;
      for (const combo of cartesian(argAlts.map((a) => a.map((s) => [s])), (x, y) => [...x, ...y])) {
        const d = dropped(combo);
        if (d.length) {
          if (!internal.has(where)) internal.set(where, new Set());
          d.forEach((t) => internal.get(where).add(t));
        }
      }
      if (classNameIndex !== -1 && file.includes(`${path.sep}components${path.sep}ui${path.sep}`)) {
        const name = enclosingName(node);
        if (name && !passThrough.has(name)) passThrough.set(name, { where, argAlts, classNameIndex });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// ------------------------------------- className overrides on ui/ parts ----
const overrides = [];
for (const file of files) {
  if (file.includes(`${path.sep}components${path.sep}ui${path.sep}`)) continue;
  const sf = parse(file);
  const env = envOf(file);
  const visit = (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
      const comp = passThrough.get(node.tagName.text);
      if (comp) {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || attr.name.getText(sf) !== "className" || !attr.initializer) continue;
          const init = attr.initializer;
          const values = ts.isStringLiteral(init) ? [init.text] : ts.isJsxExpression(init) ? alts(init.expression, env) : null;
          for (const value of (values ?? []).filter(Boolean)) {
            const lost = new Set();
            const combos = cartesian(comp.argAlts.map((a) => a.map((s) => [s])), (x, y) => [...x, ...y]);
            for (const combo of combos) {
              const without = new Set(dropped(combo));
              const withIt = [...combo];
              withIt[comp.classNameIndex] = value;
              for (const t of dropped(withIt)) if (!without.has(t)) lost.add(t);
            }
            if (lost.size) {
              overrides.push(
                `${rel(file)}:${lineOf(sf, node)}  <${node.tagName.text} className="${value}">  overrides base: ${[...lost].join(" ")}`,
              );
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// ----------------------------------------------------------------- report --
console.log(`\nInternal conflicts — classes a single cn() call drops (${internal.size}):`);
for (const [where, set] of [...internal].sort()) console.log(`  ${where}  drops: ${[...set].join(" ")}`);
console.log(`\nclassName overrides on ui/ components — base classes now overridden (${overrides.length}):`);
for (const line of overrides.sort()) console.log(`  ${line}`);
console.log(`\n(ui/ components seen with a className pass-through: ${[...passThrough.keys()].sort().join(", ")})`);

process.exit(sizesOk ? 0 : 1);

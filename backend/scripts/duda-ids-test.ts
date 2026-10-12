/**
 * The Duda id guard (DUDA_ID in services/duda.ts): an id from a URL must never
 * walk out of this site's catalogue. No network and no database — `fetch` is
 * stubbed and FAILS the test if any request reaches api.duda.co.
 *   npm run duda-ids:test --workspace=backend
 */
import express, { type ErrorRequestHandler } from "express";
import type { AddressInfo } from "node:net";
import { InvalidDudaIdError, __dudaPathsForTest as PATHS } from "../src/services/duda.js";
import { dudaRouter } from "../src/routes/duda.js";
import { categoriesRouter } from "../src/routes/categories.js";
import { stripAnchors } from "../src/services/anchors.js";

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};
const throwsInvalid = (fn: () => unknown) => {
  try {
    fn();
    return false;
  } catch (err) {
    return err instanceof InvalidDudaIdError;
  }
};

const ULID = "01M1XRCFGGHYEJ0QGGXCJ3582N";
const ULID2 = "01KW9TRW04JDNAQXD6P8QKX15V";
const SITE = "8a8f03b5";

// ---- real ids build the paths they always did
check(PATHS.product(SITE, ULID) === `/sites/multiscreen/${SITE}/ecommerce/products/${ULID}`, "product path unchanged for a real id");
check(
  PATHS.productVariation(SITE, ULID, ULID2) === `/sites/multiscreen/${SITE}/ecommerce/products/${ULID}/variations/${ULID2}`,
  "variation path unchanged",
);
check(PATHS.option(SITE, ULID) === `/sites/multiscreen/${SITE}/ecommerce/options/${ULID}`, "option path unchanged");
check(PATHS.optionChoices(SITE, ULID) === `/sites/multiscreen/${SITE}/ecommerce/options/${ULID}/choices`, "choices path unchanged");
check(PATHS.optionChoice(SITE, ULID, ULID2) === `/sites/multiscreen/${SITE}/ecommerce/options/${ULID}/choices/${ULID2}`, "choice path unchanged");
check(PATHS.category(SITE, ULID) === `/sites/multiscreen/${SITE}/ecommerce/categories/${ULID}`, "category path unchanged");

// ---- anything that could navigate, add a query, or smuggle encoding is refused
const BAD = [
  "../../../../../sites/multiscreen/other",
  "..",
  ".",
  "a/b",
  "a?limit=1",
  "a#b",
  "a%2Fb",
  "a b",
  "a\\b",
  "",
  "x".repeat(65),
];
for (const bad of BAD) {
  const shown = JSON.stringify(bad.length > 40 ? bad.slice(0, 40) + "…" : bad);
  check(throwsInvalid(() => PATHS.product(SITE, bad)), `product refuses ${shown}`);
  check(throwsInvalid(() => PATHS.category(SITE, bad)), `category refuses ${shown}`);
  check(throwsInvalid(() => PATHS.option(SITE, bad)), `option refuses ${shown}`);
  check(throwsInvalid(() => PATHS.optionChoice(SITE, ULID, bad)), `choice refuses ${shown}`);
  check(throwsInvalid(() => PATHS.productVariation(SITE, ULID, bad)), `variation refuses ${shown}`);
}
check(throwsInvalid(() => PATHS.product(SITE, undefined as unknown as string)), "a missing id is refused");

// ---- through the real routes: encoded slashes reach req.params decoded, and
// still nothing leaves for Duda
const realFetch = globalThis.fetch;
const outbound: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith("http://127.0.0.1:")) return realFetch(input, init);
  outbound.push(url);
  return new Response("{}", { status: 200 });
}) as typeof fetch;

const app = express();
app.use(express.json());
app.use("/api", dudaRouter, categoriesRouter);
const handler: ErrorRequestHandler = (err, _req, res, _next) => {
  res.status(err instanceof InvalidDudaIdError ? 400 : 500).json({ error: err instanceof InvalidDudaIdError ? "invalid_id" : String(err) });
};
app.use(handler);

const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
const escape = "..%2F..%2F..%2F..%2F..%2Fsites%2Fmultiscreen%2Fother";

for (const [method, path] of [
  ["DELETE", `/products/${escape}?confirm=true`],
  ["GET", `/products/${escape}/delete-preview`],
  ["GET", `/categories/${escape}`],
  ["GET", `/categories/a%3Flimit%3D1`],
] as const) {
  const res = await realFetch(base + path, { method });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  check(res.status === 400 && body.error === "invalid_id", `${method} ${path.split("?")[0].slice(0, 48)} → 400 invalid_id`, `got ${res.status} ${JSON.stringify(body)}`);
}
check(outbound.length === 0, "no request reached Duda", outbound.join(", "));

server.close();
globalThis.fetch = realFetch;

// ---- what reaches Duda's WAF: never an <a href> (it 403s the whole save)
const noHref = (h: string) => !/<a\b[^>]*href/i.test(h);
check(stripAnchors('<p>See <a href="/product/x">the trolley</a>.</p>') === "<p>See the trolley.</p>", "a balanced link keeps its text");
check(noHref(stripAnchors("<p>See <a href=/product/x>x.</p>")), "an UNCLOSED link is still stripped");
check(stripAnchors('<p><a title="a > b" href="/x">t</a></p>') === "<p>t</p>", "a > inside a quoted attribute does not cut the tag short");
check(noHref(stripAnchors('<A HREF="/x">t</A>')), "upper case");
check(stripAnchors("<p>abbr <abbr>x</abbr> <article>y</article></p>") === "<p>abbr <abbr>x</abbr> <article>y</article></p>", "other tags starting with a are untouched");

// ---- the real app's error handler: a malformed %-escape is the caller's fault
{
  process.env.VERCEL = process.env.VERCEL ?? "1"; // export the app without listening
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const res = await realFetch(`http://127.0.0.1:${(srv.address() as AddressInfo).port}/public/downloads/%E0/file`);
  check(res.status === 400, "a malformed %-escape in the path → 400, not 500", String(res.status));
  srv.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

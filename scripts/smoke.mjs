#!/usr/bin/env node
/**
 * Post-deploy smoke test against the LIVE site (or any base URL).
 *
 *   node scripts/smoke.mjs                                  # production
 *   node scripts/smoke.mjs https://<deployment>.vercel.app
 *   node scripts/smoke.mjs --wait-for <commit-sha>          # wait until that commit is serving first
 *
 * Run by .github/workflows/post-deploy-smoke.yml after every push to main.
 * Every check is something that has actually broken, or would break silently:
 *   - the function failing at load (FUNCTION_INVOCATION_FAILED, 2026-10-02)
 *   - auth no longer enforced on the admin API
 *   - the widget script missing or serving an unstamped build marker
 *   - CORS: the edge cache serving one origin's response to another
 *   - the product content / catalogue payloads the live widget renders
 *   - the resources pages' list, a download opening as a PDF, and a gated one
 *     refused without the form
 * Read-only; needs no credentials and writes nothing.
 */
const args = process.argv.slice(2);
const waitIdx = args.indexOf("--wait-for");
const waitFor = waitIdx !== -1 ? args.splice(waitIdx, 2)[1] : null;
const BASE = (args[0] ?? "https://sa-equip-backend.vercel.app").replace(/\/$/, "");
const SITE = "https://saequip.com"; // an allowed widget origin
const bust = () => `z=${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const withBust = (p) => `${p}${p.includes("?") ? "&" : "?"}${bust()}`;

async function waitForCommit(sha) {
  const deadline = Date.now() + 12 * 60 * 1000;
  process.stdout.write(`Waiting for ${sha.slice(0, 7)} to be live on ${BASE} `);
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health?${bust()}`);
      const j = r.ok ? await r.json() : null;
      if (j?.commit === sha) {
        console.log("— live.");
        return;
      }
    } catch {
      /* keep waiting */
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 15000));
  }
  console.log(`\n✗ ${sha.slice(0, 7)} never went live within 12 minutes — the Vercel build probably failed (check its logs).`);
  process.exit(1);
}

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ ok: true, name, detail: detail ?? "" });
  } catch (e) {
    results.push({ ok: false, name, detail: e instanceof Error ? e.message : String(e) });
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

if (waitFor) await waitForCommit(waitFor);

await check("API function loads (/api/health)", async () => {
  const r = await fetch(withBust(`${BASE}/api/health`));
  expect(r.status === 200, `status ${r.status} — a 500 here means the whole API is down`);
  const j = await r.json();
  expect(j.status === "ok", `body ${JSON.stringify(j).slice(0, 80)}`);
  return j.commit ? `commit ${String(j.commit).slice(0, 7)}` : "";
});

await check("admin API still requires a login", async () => {
  for (const p of ["/api/products", "/api/users", "/api/media"]) {
    const r = await fetch(`${BASE}${p}`, { headers: { Authorization: "Bearer not-a-real-token" } });
    expect(r.status === 401, `${p} answered ${r.status} to a forged token`);
  }
  return "3 routes → 401";
});

await check("widget script is served and stamped", async () => {
  const r = await fetch(withBust(`${BASE}/public/widget.js`));
  expect(r.status === 200, `status ${r.status}`);
  expect(/javascript/.test(r.headers.get("content-type") ?? ""), `content-type ${r.headers.get("content-type")}`);
  const js = await r.text();
  const v = js.match(/version:\s*"([^"]+)"/)?.[1];
  expect(v && !v.includes("%BUILD%"), `version marker ${v ?? "missing"}`);
  return v;
});

await check("product content for the live widget", async () => {
  const r = await fetch(withBust(`${BASE}/public/products/content?slug=ex-heater`), { headers: { Origin: SITE } });
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get("access-control-allow-origin") === SITE, `CORS header ${r.headers.get("access-control-allow-origin")}`);
  const j = await r.json();
  expect(j.name && Array.isArray(j.specs), "payload missing name/specs");
  return `${j.name}: ${j.specs.length} spec rows`;
});

await check("catalogue for the listing widget", async () => {
  const r = await fetch(withBust(`${BASE}/public/catalogue`), { headers: { Origin: SITE } });
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get("access-control-allow-origin") === SITE, `CORS header ${r.headers.get("access-control-allow-origin")}`);
  const j = await r.json();
  expect(j.products?.length > 0 && j.categories?.length > 0, "empty catalogue");
  return `${j.products.length} products, ${j.categories.length} categories`;
});

await check("resources list and its file route", async () => {
  const r = await fetch(withBust(`${BASE}/public/resources?type=datasheet`), { headers: { Origin: SITE } });
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get("access-control-allow-origin") === SITE, `CORS header ${r.headers.get("access-control-allow-origin")}`);
  const j = await r.json();
  const first = j.products?.[0]?.downloads?.[0];
  expect(first?.id, "no datasheets listed");
  // Read-only: a GATED file is checked by proving the direct route REFUSES it
  // (submitting the form would store a request); an ungated one must open.
  const f = await fetch(`${BASE}/public/downloads/${first.id}/file`, { redirect: "manual" });
  expect(f.headers.get("cache-control") === "no-store", `file route Cache-Control: ${f.headers.get("cache-control")}`);
  let how;
  if (first.gated) {
    expect(first.href === null, `a gated file is listed with a direct link: ${first.href}`);
    expect(f.status === 404, `a GATED file opened without the form: ${f.status}`);
    how = "first is gated, and the direct route refuses it";
  } else {
    expect(f.status === 302, `file route answered ${f.status}`);
    const pdf = await fetch(f.headers.get("location"), { headers: { Range: "bytes=0-4" } });
    const head = Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString();
    expect(head === "%PDF-", `signed URL served ${pdf.status} "${head}"`);
    how = "first is ungated and opens as a PDF";
  }
  const bad = await fetch(withBust(`${BASE}/public/resources?type=brochure`));
  expect(bad.status === 400, `unknown type answered ${bad.status}`);
  return `${j.products.length} products with datasheets; ${how}`;
});

await check("translated payloads (?lang=ar)", async () => {
  const r = await fetch(withBust(`${BASE}/public/catalogue?lang=ar`), { headers: { Origin: SITE } });
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get("access-control-allow-origin") === SITE, `CORS header ${r.headers.get("access-control-allow-origin")}`);
  expect(r.headers.get("vary")?.toLowerCase().includes("origin"), `Vary: ${r.headers.get("vary")}`);
  const j = await r.json();
  expect(j.lang === "ar", `lang ${j.lang}`);
  const p = j.products?.find((x) => x.nameEn);
  expect(p, "no nameEn on the products");
  const translated = j.products.filter((x) => x.name !== x.nameEn).length;
  const en = await fetch(withBust(`${BASE}/public/catalogue`), { headers: { Origin: SITE } }).then((x) => x.json());
  expect(en.lang === "en", `the English catalogue says lang ${en.lang}`);
  return `${translated}/${j.products.length} product names in Arabic; English unchanged`;
});

await check("edge cache keys on Origin (Vary)", async () => {
  const r = await fetch(withBust(`${BASE}/public/catalogue`));
  expect(r.headers.get("vary")?.toLowerCase().includes("origin"), `Vary: ${r.headers.get("vary")} — a no-Origin copy could be served to the live site`);
  return "Vary: Origin";
});

await check("a disallowed origin is refused", async () => {
  const r = await fetch(withBust(`${BASE}/public/catalogue`), { headers: { Origin: "https://evil.example" } });
  expect(r.status === 403, `status ${r.status}`);
  return "403";
});

await check("dashboard loads", async () => {
  for (const p of ["/", "/login"]) {
    const r = await fetch(`${BASE}${p}`);
    expect(r.status === 200 && /<div id="root"|<!doctype html/i.test(await r.text()), `${p} → ${r.status}`);
  }
  return "/ and /login";
});

const failed = results.filter((r) => !r.ok);
console.log(`\nSmoke test — ${BASE}\n`);
for (const r of results) console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
console.log(failed.length ? `\n✗ ${failed.length} check(s) FAILED\n` : `\n✓ all ${results.length} checks passed\n`);
process.exit(failed.length ? 1 : 0);

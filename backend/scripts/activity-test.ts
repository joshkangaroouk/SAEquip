/**
 * The platform activity log (CLAUDE.md "Activity log"). No database: the
 * activity store is swapped for an in-memory one.
 *   npm run activity:test --workspace=backend
 *
 * The coverage check is the one that matters most as the API grows: every
 * changing route under /api must have a catalogue entry (or a `skip` with its
 * reason), or this fails and names it.
 */
process.env.VERCEL = process.env.VERCEL ?? "1"; // import the app without listening

import express, { type ErrorRequestHandler, type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import {
  ActivityRecorder,
  WRITE_TIMEOUT_MS,
  __forgetSessionsForTest,
  __setActivityStoreForTest,
  fieldChanges,
  fileRequestLabel,
  listChanges,
  movedItem,
  noteSession,
  ordinal,
  quoteLabel,
  sanitizeDetails,
  type ActivityRow,
  type ActivityStore,
} from "../src/services/activity.js";
import { ROUTE_CATALOGUE, matchRoute, allActions, REPORTABLE } from "../src/services/activityCatalog.js";
import { activityContext } from "../src/middleware/activity.js";
import { requireSuperAdmin } from "../src/middleware/requireAuth.js";
import { reportBody } from "../src/routes/activity.js";
import { summariseGroup, type GroupMember } from "../src/services/activityGroups.js";

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};

const TEST_DOMAIN = "example.test";

// ---- The in-memory store -------------------------------------------------------

let rows: ActivityRow[] = [];
let insertDelay = 0;
let insertHangs = false;
let insertedAt = 0;
const sessions = new Map<string, { ip: string | null }>();
const store: ActivityStore = {
  async insert(r) {
    if (insertHangs) return new Promise<void>(() => {});
    if (insertDelay) await new Promise((res) => setTimeout(res, insertDelay));
    rows.push(...r);
    insertedAt = Date.now();
  },
  async label(type, id) {
    return `${type} named ${id}`;
  },
  async touchSession(s) {
    const prev = sessions.get(s.sessionId);
    sessions.set(s.sessionId, { ip: s.ip });
    return { inserted: !prev, previousIp: prev?.ip ?? null };
  },
  async sweep() {},
};
__setActivityStoreForTest(store);

// ---- 1. Coverage: every changing /api route is in the catalogue ---------------------

{
  const { default: app } = await import("../src/index.js");
  type Layer = {
    route?: { path: string; methods: Record<string, boolean> };
    name: string;
    handle: { stack?: Layer[] };
    regexp: RegExp & { fast_slash?: boolean };
  };
  // Express 4 keeps a mount's path only inside its layer's regexp
  // (`^\/api\/?(?=\/|$)`), so it is read back out of that.
  const mountPath = (l: Layer): string => {
    if (l.regexp.fast_slash) return "";
    const m = l.regexp.source.match(/^\^((?:\\\/[^\\?()]+)+)\\\/\?\(\?=\\\/\|\$\)$/);
    if (!m) throw new Error(`cannot read the mount path of ${l.regexp.source}`);
    return m[1].replace(/\\\//g, "/");
  };
  const routes: string[] = [];
  const walk = (stack: Layer[], prefix: string) => {
    for (const l of stack) {
      if (l.route) {
        for (const [m, on] of Object.entries(l.route.methods)) {
          if (on && m !== "_all") routes.push(`${m.toUpperCase()} ${(prefix + l.route.path).replace(/(.)\/+$/, "$1")}`);
        }
      } else if (l.name === "router" && l.handle.stack) walk(l.handle.stack, prefix + mountPath(l));
    }
  };
  walk((app as unknown as { _router: { stack: Layer[] } })._router.stack, "");

  const changing = routes.filter((r) => !r.startsWith("GET ") && r.includes(" /api/"));
  const missing = changing.filter((r) => !(r in ROUTE_CATALOGUE));
  check(changing.length >= 67, "found the API's changing routes", `${changing.length}`);
  check(missing.length === 0, "every changing /api route has a catalogue entry", missing.join(", "));
  const stale = Object.keys(ROUTE_CATALOGUE).filter((k) => !routes.includes(k));
  check(stale.length === 0, "every catalogue entry names a real route", stale.join(", "));
  check(!routes.some((r) => r.includes(" /public/") && r in ROUTE_CATALOGUE), "/public is not in the catalogue (visitors are not logged)");
  const actions = allActions().map((a) => a.action);
  check(new Set(actions).size === actions.length, "every action is listed once for the filter");
  check(REPORTABLE.every((a) => actions.includes(a)), "every reportable action has a label");
}

// ---- 2. Route matching ----------------------------------------------------------

check(matchRoute("PUT", "/api/products/order")?.key === "PUT /api/products/order", "a literal path beats a :id shape");
check(matchRoute("PUT", "/api/products/abc/specs")?.params.id === "abc", "route params are read from the path");
check(matchRoute("PUT", "/api/logos/reorder")?.key === "PUT /api/logos/reorder", "/reorder is not taken for an id");
check(matchRoute("POST", "/api/accept-invite/")?.key === "POST /api/accept-invite", "a trailing slash still matches");
check(matchRoute("DELETE", "/api/quotes/q1/notes/n1")?.params.noteId === "n1", "nested params");
check(matchRoute("GET", "/api/products") === null, "a GET that is not an export has no entry");

// ---- 3. The middleware, end to end --------------------------------------------------

const app = express();
app.use(express.json());
app.use("/api", activityContext);
// A stand-in for requireAuth: the user comes from a header.
app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
  const who = req.header("x-test-user");
  if (who) req.user = { id: `id-${who}`, email: `${who}@${TEST_DOMAIN}`, role: who === "admin" ? "super_admin" : null, aal: "aal1", sessionId: "s1" };
  next();
});
app.put("/api/products/:id/specs", (req, res) => {
  req.activity?.set({
    summary: "Updated technical specs (1 added)",
    details: { added: ["Weight: 5kg"], password: "hunter2", nested: { authorization: "Bearer x", token: "t" }, unlinkedFromProducts: 3 },
  });
  res.json({ ok: true });
});
app.post("/api/media/upload-url", (_req, res) => res.json({ ok: true }));
app.get("/api/products", (_req, res) => res.json([]));
app.patch("/api/products/:id", (_req, _res, next) => next(new Error("boom")));
app.delete("/api/products/:id", (_req, res) => res.status(404).json({ error: "not_found" }));
app.put("/api/products/:id/variations", (req, res) => {
  req.activity?.set({ outcome: "partial" });
  res.status(500).json({ error: "partial_variation_save" });
});
app.post("/api/not-catalogued", (_req, res) => res.json({ ok: true }));
app.get("/api/activity", requireSuperAdmin, (_req, res) => res.json({}));
app.post("/api/accept-invite", (req, res) => {
  req.activity?.set({ actor: { id: "new-user", email: `new@${TEST_DOMAIN}` }, target: { id: "new-user", label: `new@${TEST_DOMAIN}` } });
  res.status(201).json({ ok: true });
});
app.post("/api/products", (req, res) => res.status(201).json({ body: req.body }));
const errors: ErrorRequestHandler = (_err, _req, res, _next) => {
  res.status(500).json({ error: "internal_error" });
};
app.use(errors);

const srv = app.listen(0);
await new Promise((r) => srv.once("listening", r));
const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
const call = async (method: string, path: string, opts: { user?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
  const t0 = Date.now();
  const res = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.user ? { "x-test-user": opts.user } : {}),
      "user-agent": "activity-test",
      ...(opts.headers ?? {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  await res.text();
  return { status: res.status, ms: Date.now() - t0, doneAt: Date.now() };
};
const last = () => rows[rows.length - 1];

{
  rows = [];
  const batch = "6f1c2a8e-1111-4222-8333-944455556666";
  insertDelay = 80;
  const r = await call("PUT", "/api/products/p1/specs", { user: "alice", headers: { "x-activity-batch": batch } });
  insertDelay = 0;
  const e = last();
  check(rows.length === 1 && e?.action === "product.specs.update", "a changing request writes one row, its catalogue action");
  check(insertedAt > 0 && insertedAt <= r.doneAt, "the row is written BEFORE the response finishes");
  check(e?.summary === "Updated technical specs (1 added)" && e.category === "products", "the route's own wording replaces the catalogue's");
  check(e?.targetType === "product" && e.targetId === "p1" && e.targetLabel === "product named p1", "the target comes from the route param, named by the store");
  check(e?.actorEmail === `alice@${TEST_DOMAIN}` && e.sessionId === "s1", "who did it, and their session");
  check(e?.method === "PUT" && e.path === "/api/products/p1/specs" && e.status === 200 && typeof e.durationMs === "number", "method, path, status and duration");
  check(e?.batchId === batch, "the save's batch id is kept");
  check(e?.userAgent === "activity-test", "the device is kept");
  const json = JSON.stringify(e?.details);
  check(!/hunter2|Bearer|"t"|password|authorization|token/.test(json), "secret-looking keys never reach the row", json);
  check(/unlinkedFromProducts/.test(json) && /Weight: 5kg/.test(json), "ordinary details are kept");

  rows = [];
  await call("PUT", "/api/products/p1/specs", { user: "alice", headers: { "x-activity-batch": "not-a-uuid" } });
  check(last()?.batchId === null, "a malformed batch id is dropped");

  rows = [];
  await call("POST", "/api/products", { user: "alice", body: { name: "X", password: "sekret-pass", token: "sekret-token" } });
  check(rows.length === 1 && !JSON.stringify(rows[0]).includes("sekret"), "a request body is never copied into the row");

  rows = [];
  await call("GET", "/api/products", { user: "alice" });
  check(rows.length === 0, "a plain GET writes nothing");

  rows = [];
  await call("POST", "/api/media/upload-url", { user: "alice" });
  check(rows.length === 0, "a skipped route writes nothing");

  rows = [];
  await call("PATCH", "/api/products/p2", { user: "alice" });
  check(last()?.outcome === "failed" && last()?.status === 500 && last()?.action === "product.details.update", "an error reaching the error handler is logged as failed, still matched to its route");

  rows = [];
  await call("DELETE", "/api/products/p3", { user: "alice" });
  check(last()?.outcome === "failed" && last()?.status === 404, "a 404 is a failed attempt");

  rows = [];
  await call("PUT", "/api/products/p4/variations", { user: "alice" });
  check(last()?.outcome === "partial", "a route can say a failure was partial");

  rows = [];
  await call("POST", "/api/not-catalogued", { user: "alice" });
  check(last()?.action === "unknown" && last()?.summary === "POST /api/not-catalogued", "a real route with no entry is logged as unknown, never dropped");

  rows = [];
  await call("PUT", "/api/products/p1/specs");
  check(rows.length === 0, "an anonymous request writes nothing");

  rows = [];
  await call("GET", "/api/activity", { user: "bob" });
  check(
    rows.length === 1 && last()?.action === "security.refused" && last()?.outcome === "refused" && /only the super admin/.test(last()?.summary ?? ""),
    "a signed-in person refused a super-admin page: one 'refused' row",
  );

  rows = [];
  await call("POST", "/api/accept-invite");
  check(last()?.action === "invite.accept" && last()?.actorId === "new-user", "a route can name the actor when no one is signed in");

  rows = [];
  insertHangs = true;
  const hung = await call("PUT", "/api/products/p1/specs", { user: "alice" });
  insertHangs = false;
  check(hung.status === 200 && hung.ms >= WRITE_TIMEOUT_MS - 100 && hung.ms < WRITE_TIMEOUT_MS + 1500, "a store that hangs releases the response at the timeout", `${hung.ms}ms`);
}

srv.close();

// ---- 4. Sessions: "Signed in" and "new IP" ----------------------------------------------

{
  __forgetSessionsForTest();
  sessions.clear();
  const fakeReq = (ip: string) =>
    ({ activity: new ActivityRecorder({ ip, userAgent: "ua", country: null, city: null, batchId: null }) }) as unknown as Request;
  const user = { id: "u1", email: `u1@${TEST_DOMAIN}` };

  const a = fakeReq("1.1.1.1");
  await noteSession(a, user, "sess-A", { method: "password", at: 1_700_000_000_000 });
  check(a.activity!.extra.length === 1 && a.activity!.extra[0].action === "auth.sign_in", "the first request of a session: one 'Signed in'");
  check((a.activity!.extra[0].details as { method?: string }).method === "password", "with how it signed in");

  const b = fakeReq("1.1.1.1");
  await noteSession(b, user, "sess-A", { method: "password", at: null });
  check(b.activity!.extra.length === 0, "the next request of the same session: nothing");

  const c = fakeReq("2.2.2.2");
  await noteSession(c, user, "sess-A", { method: "password", at: null });
  check(c.activity!.extra.length === 1 && c.activity!.extra[0].action === "auth.session_new_ip", "the same session from a new IP: one 'new IP'");

  __forgetSessionsForTest(); // another instance, same session, same IP
  const d = fakeReq("2.2.2.2");
  await noteSession(d, user, "sess-A", { method: "password", at: null });
  check(d.activity!.extra.length === 0, "another instance seeing a known session: no second 'Signed in'");

  const e = fakeReq("3.3.3.3");
  await noteSession(e, user, null, { method: null, at: null });
  check(e.activity!.extra.length === 0, "no session id (an old token): nothing, no error");
}

// ---- 5. What the browser may report ---------------------------------------------------

check(reportBody.safeParse({ action: "auth.sign_out" }).success, "report: a listed action is accepted");
check(!reportBody.safeParse({ action: "product.delete" }).success, "report: anything off the list is refused");
check(!reportBody.safeParse({ action: "auth.sign_out", actor: "someone-else" }).success, "report: extra keys (a forged actor) are refused");
check(reportBody.safeParse({ action: "enquiry.quote.export", rows: 12, filtered: true }).success, "report: an export with its row count");

// ---- 6. Helpers ----------------------------------------------------------------------

check(JSON.stringify(movedItem(["a", "b", "c", "d"], ["a", "d", "b", "c"])) === JSON.stringify({ item: "d", from: 3, to: 1 }), "movedItem: finds the one dragged product");
check(movedItem(["a", "b", "c"], ["c", "b", "a"]) === null, "movedItem: more than one move is not guessed");
check(movedItem(["a", "b"], ["a", "b"]) === null, "movedItem: no move");
check(ordinal(1) === "1st" && ordinal(2) === "2nd" && ordinal(3) === "3rd" && ordinal(11) === "11th" && ordinal(22) === "22nd" && ordinal(113) === "113th", "ordinal");
{
  const d = listChanges(["a", "b", "b"], ["b", "c"]);
  check(JSON.stringify(d) === JSON.stringify({ added: ["c"], removed: ["a", "b"] }), "listChanges counts repeats", JSON.stringify(d));
  const f = fieldChanges({ name: "A", sku: "1" }, { name: "B", sku: "1" }, { name: "Name", sku: "SKU" });
  check(f.length === 1 && f[0].field === "name" && f[0].before === "A" && f[0].after === "B", "fieldChanges: only what changed");
}
{
  const label = quoteLabel(new Date("2026-11-14T10:00:00Z"), 3);
  check(label === "Quote request of 14 Nov 2026 (3 items)", "a quote's label: date and items, no person", label);
  check(fileRequestLabel("Datasheet", "EX Heater", new Date()) === "File request: Datasheet – EX Heater", "a file request's label: the file, no person");
  const long = sanitizeDetails({ s: "x".repeat(20_000), list: Array.from({ length: 600 }, (_, i) => i) }) as { s: string; list: unknown[] };
  check(long.s.length < 10_100 && long.s.endsWith("[cut]"), "long text is cut");
  check(long.list.length === 501, "long lists are cut, saying so");
}

// ---- 7. One row per save -------------------------------------------------------------

{
  const t0 = Date.parse("2026-11-18T16:01:11Z");
  const row = (i: number, action: string, summary: string, extra: Partial<GroupMember> = {}): GroupMember => ({
    id: `r${i}`,
    at: new Date(t0 + i * 500),
    category: action.startsWith("translation") ? "translations" : "products",
    action,
    outcome: "ok",
    summary,
    targetType: action.startsWith("translation") ? null : "product",
    targetId: action.startsWith("translation") ? null : "P1",
    targetLabel: action.startsWith("translation") ? null : "EX Heater",
    details: null,
    ...extra,
  });
  const mt = (i: number, locale: string, counts: Record<string, number>, outcome = "ok") =>
    row(i, "translation.save", "Saved machine translations", { outcome, details: { origin: "MT", locale, counts } });
  const label = (a: string) => ({ "product.logo.on": "Switched a logo on" })[a] ?? a;

  // The save Josh saw: the description, then six languages, Chinese refused (stored as "failed" before the fix).
  const save = [
    row(0, "product.details.update", "Updated Description"),
    mt(1, "ar", { saved: 1 }),
    mt(2, "zh", { rejected: 1 }, "failed"),
    mt(3, "fr", { saved: 1 }),
    mt(4, "de", { saved: 1 }),
    mt(5, "pt-br", { saved: 1 }),
    mt(6, "es", { saved: 1 }),
  ];
  const g = summariseGroup(save, label);
  check(g.representative.id === "r0", "a save is represented by its own change, not a translation");
  check(g.summary === "Updated Description · translated into 5 languages (Chinese kept in English)", "one line for the whole save", g.summary);
  check(g.outcome === "ok", "a refused machine translation does not flag the save as failed", g.outcome);

  const logos = summariseGroup(
    [row(0, "product.specs.update", "Updated technical specs (1 added)"), row(1, "product.logo.on", "Switched on EX"), row(2, "product.logo.on", "Switched on UKCA")],
    label,
  );
  check(logos.summary === "Updated technical specs (1 added) · Switched a logo on (2)", "same-action rows fold together", logos.summary);

  const half = summariseGroup([row(0, "product.details.update", "Updated Name"), row(1, "product.specs.update", "Updated technical specs", { outcome: "failed" })], label);
  check(half.outcome === "partial", "one part saved and one failed: partly done", half.outcome);

  const run = summariseGroup([mt(0, "fr", { saved: 20 }), mt(1, "de", { saved: 5, rejected: 1 })], label);
  check(run.summary === "Saved 25 machine translations in 2 languages (German kept in English)", "a Translate missing run: one line", run.summary);

  const single = summariseGroup([row(0, "product.details.update", "Updated Name")], label);
  check(single.summary === "Updated Name", "a lone row keeps its own wording");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

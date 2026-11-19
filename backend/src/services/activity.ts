/**
 * The platform activity log (the super admin's Activity page): who did what,
 * when, from where.
 *
 * One `ActivityRecorder` per /api request (`middleware/activity.ts` attaches it
 * as `req.activity`). A changing request writes ONE row when its response ends:
 * the catalogue's default for that route (services/activityCatalog.ts), merged
 * with whatever the route added through `req.activity.set()`, the target's name
 * and the before → after it knows. `add()` writes extra rows (a sign-in noticed
 * by requireAuth); `refuse()` turns a 403 into one "refused" row.
 *
 * ⚠️ Never put into an event: a customer's name, email, phone or company, a
 * note's text, or any password, token or link. `sanitizeDetails()` drops the
 * obvious keys as a backstop, but the rule is the caller's.
 *
 * ⚠️ Writing must never break a request: every failure is caught and logged
 * WITHOUT the event's details, and the middleware gives up waiting after
 * WRITE_TIMEOUT_MS.
 */
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { supabase } from "../supabase.js";
import { PgRateLimitStore } from "../middleware/pgRateLimitStore.js";
import {
  matchRoute,
  type ActivityCategory,
  type CatalogueEntry,
  type TargetType,
} from "./activityCatalog.js";

export type Outcome = "ok" | "partial" | "failed" | "refused";
export type Target = { type: TargetType; id?: string | null; label?: string | null };
export type Actor = { id: string | null; email: string | null };

export type ActivityEventInput = {
  category: ActivityCategory;
  action: string;
  summary: string;
  outcome?: Outcome;
  target?: Target | null;
  details?: unknown;
  actor?: Actor | null;
  source?: "hub" | "browser" | "duda";
  at?: Date;
};

/** What a route may add to its request's event. Any field left out keeps the catalogue's. */
export type ActivityPatch = {
  category?: ActivityCategory;
  action?: string;
  summary?: string;
  outcome?: Outcome;
  target?: Partial<Target> | null;
  details?: unknown;
  actor?: Actor | null;
  source?: "hub" | "browser" | "duda";
};

/** The request facts every row carries. Read once, when the request arrives. */
export type RequestFacts = {
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  batchId: string | null;
};

export const RETENTION_DAYS = 730;
export const WRITE_TIMEOUT_MS = 1500;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// --- Details -------------------------------------------------------------------

/**
 * Keys never stored, whatever a route hands over: anything mentioning a
 * password, secret, token, authorization or cookie, and the exact names a
 * login link or one-time code would travel under. (Not a bare "link"
 * substring: `unlinkedFromProducts` is a count, not a credential. Nor a bare
 * `url`: a category's page URL is ordinary detail. A URL's VALUE is scanned
 * instead, by SECRET_VALUE.) Named credentials added 2026-11-19 (USERS-AUDIT
 * L5): api keys, JWTs, signed/SSO URLs and reset/invite/login links.
 */
const SECRET_KEY =
  /password|passwd|secret|token|authori[sz]ation|cookie|api_?key|jwt|signed_?url|sso_?url|(reset|invite|login|magic|recovery)_?(link|url)|^(link|signedurl|ssourl|otp|code)$/i;
/**
 * Values that look like a credential, whatever key they sit under
 * (USERS-AUDIT L5): a URL carrying a token or signature in its query or
 * fragment, or a bare JWT. Replaced, not dropped, so the entry still says
 * something was there.
 */
const SECRET_VALUE =
  /[?#&](access_token|refresh_token|token|t|code|sig|signature|otp|jwt|x-amz-signature)=|^eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}$/i;
const MAX_STRING = 10_000;
const MAX_ITEMS = 500;
const MAX_DEPTH = 6;

/**
 * A copy of `value` fit to store: secret-looking keys dropped, strings capped,
 * long arrays cut, and nothing deeper than six levels. Returns undefined for
 * nothing worth keeping.
 */
export function sanitizeDetails(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    if (SECRET_VALUE.test(value)) return "[removed: looked like a credential]";
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… [cut]` : value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[too deep]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => sanitizeDetails(v, depth + 1) ?? null);
    if (value.length > MAX_ITEMS) items.push(`… and ${value.length - MAX_ITEMS} more`);
    return items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      const clean = sanitizeDetails(v, depth + 1);
      if (clean !== undefined) out[k] = clean;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

/**
 * Field-by-field changes between two plain objects, for the page's before →
 * after table. Only fields that differ; labels are the page's own words.
 */
export function fieldChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): { field: string; label: string; before: unknown; after: unknown }[] {
  const out: { field: string; label: string; before: unknown; after: unknown }[] = [];
  for (const [field, label] of Object.entries(labels)) {
    if (!(field in after)) continue;
    const a = after[field] ?? null;
    const b = before ? (before[field] ?? null) : null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field, label, before: before ? b : undefined, after: a });
  }
  return out;
}

/** Lines added and removed between two lists (order-insensitive), for specs, benefits and the like. */
export function listChanges(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const count = (xs: string[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());
  const b = count(before);
  const a = count(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const [x, n] of a) for (let i = (b.get(x) ?? 0); i < n; i++) added.push(x);
  for (const [x, n] of b) for (let i = (a.get(x) ?? 0); i < n; i++) removed.push(x);
  return { added, removed };
}

/** "1st", "2nd", "3rd", "11th"… */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * The one item that moved between two orders of the same items, with its old
 * and new position (0-based), or null when it is not exactly one move (the
 * first drag after a bulk change, say). A drag on the Products page moves one
 * product, so this names it.
 */
export function movedItem<T>(before: T[], after: T[]): { item: T; from: number; to: number } | null {
  if (before.length !== after.length || before.length < 2) return null;
  const same = (a: T[], b: T[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (same(before, after)) return null;
  for (let to = 0; to < after.length; to++) {
    const item = after[to];
    const from = before.indexOf(item);
    if (from < 0) return null;
    if (from === to) continue;
    if (same(before.filter((x) => x !== item), after.filter((x) => x !== item))) return { item, from, to };
  }
  return null;
}

// --- Labels without personal details -------------------------------------------

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

/** "Quote request of 14 Nov 2026 (3 items)" — never the customer's name or company. */
export function quoteLabel(createdAt: Date, items: number): string {
  return `Quote request of ${DAY.format(createdAt)} (${items} ${items === 1 ? "item" : "items"})`;
}

/** "File request: Datasheet – EX Heater" — the file, never the person who asked. */
export function fileRequestLabel(downloadTitle: string | null, productName: string | null, createdAt: Date): string {
  const what = [downloadTitle, productName].filter(Boolean).join(" – ");
  return what ? `File request: ${what}` : `File request of ${DAY.format(createdAt)}`;
}

// --- Storage (swappable for tests) ---------------------------------------------

export type ActivityRow = Prisma.ActivityEventCreateManyInput;

export type ActivityStore = {
  insert(rows: ActivityRow[]): Promise<void>;
  label(type: TargetType, id: string): Promise<string | null>;
  /** Upsert a session; says whether it was new and the IP it had before. */
  touchSession(s: {
    sessionId: string;
    userId: string;
    email: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<{ inserted: boolean; previousIp: string | null }>;
  sweep(cutoff: Date): Promise<void>;
  /**
   * Whether `actorId` may add another refused/failed row this minute
   * (USERS-AUDIT L2). Absent (the tests' store) means always.
   */
  problemBudget?: (actorId: string) => Promise<boolean>;
  /** The first row of a save, to check a browser-sent batch id (USERS-AUDIT M9). */
  batchStart?: (batchId: string) => Promise<{ actorId: string | null; at: Date } | null>;
  /** Whether `actorId` has a row for `action` since `since` (noteCustomerDataView). */
  loggedSince?: (actorId: string, action: string, since: Date) => Promise<boolean>;
};

/**
 * Refused and failed rows per person per minute, beyond which they are dropped
 * (with a console line). Anyone signed in could otherwise fill the append-only
 * table, which nothing may delete for two years, by looping a refused request.
 * Postgres-backed so the budget holds across instances; failures are rare, so
 * the extra write is too.
 */
const PROBLEM_ROWS_PER_MINUTE = 30;
const problemLimiter = new PgRateLimitStore("activity-problems");
problemLimiter.init({ windowMs: 60_000 } as never);

/** A save's rows stop joining its group this long after its first. */
const BATCH_WINDOW_MS = 30 * 60 * 1000;

const prismaStore: ActivityStore = {
  async insert(rows) {
    await prisma.activityEvent.createMany({ data: rows });
  },
  async label(type, id) {
    switch (type) {
      case "product":
        return (await prisma.hubProduct.findUnique({ where: { dudaProductId: id }, select: { name: true } }))?.name ?? null;
      case "category":
        return (await prisma.categoryMirror.findUnique({ where: { dudaCategoryId: id }, select: { title: true } }))?.title ?? null;
      case "logo": {
        const l = await prisma.logo.findUnique({ where: { id }, select: { alt: true, label: true } });
        return l ? l.alt || l.label || "Logo" : null;
      }
      case "media":
        return (await prisma.mediaAsset.findUnique({ where: { id }, select: { filename: true } }))?.filename ?? null;
      case "download": {
        const d = await prisma.download.findUnique({ where: { id }, select: { title: true, hubProduct: { select: { name: true } } } });
        return d ? [d.title, d.hubProduct.name].filter(Boolean).join(" – ") : null;
      }
      case "quote": {
        const q = await prisma.quoteRequest.findUnique({ where: { id }, select: { createdAt: true, _count: { select: { items: true } } } });
        return q ? quoteLabel(q.createdAt, q._count.items) : null;
      }
      case "resource_request": {
        const l = await prisma.lead.findUnique({ where: { id }, select: { downloadTitle: true, productName: true, createdAt: true } });
        return l ? fileRequestLabel(l.downloadTitle, l.productName, l.createdAt) : null;
      }
      case "invite":
        return (await prisma.userInvite.findUnique({ where: { id }, select: { email: true } }))?.email ?? null;
      case "user": {
        const { data } = await supabase.auth.admin.getUserById(id);
        return data.user?.email ?? null;
      }
      default:
        return null;
    }
  },
  async touchSession(s) {
    // One statement: the CTE reads the row as it was BEFORE the upsert, so the
    // caller learns both "new session" and "the IP it had" without a race
    // between two instances seeing the same session at once.
    const rows = await prisma.$queryRaw<{ inserted: boolean; previous_ip: string | null }[]>`
      WITH prev AS (SELECT "ip" FROM "ActivitySession" WHERE "sessionId" = ${s.sessionId})
      INSERT INTO "ActivitySession" ("sessionId", "userId", "email", "ip", "userAgent")
      VALUES (${s.sessionId}, ${s.userId}, ${s.email}, ${s.ip}, ${s.userAgent})
      ON CONFLICT ("sessionId") DO UPDATE
        SET "lastSeenAt" = CURRENT_TIMESTAMP, "ip" = EXCLUDED."ip", "userAgent" = EXCLUDED."userAgent"
      RETURNING (xmax = 0) AS inserted, (SELECT "ip" FROM prev) AS previous_ip`;
    return { inserted: rows[0]?.inserted ?? false, previousIp: rows[0]?.previous_ip ?? null };
  },
  async sweep(cutoff) {
    // ⚠️ The database itself refuses anything newer: the DELETE policy on
    // ActivityEvent only matches rows older than RETENTION_DAYS.
    await prisma.activityEvent.deleteMany({ where: { at: { lt: cutoff } } });
    await prisma.activitySession.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
  },
  async problemBudget(actorId) {
    const { totalHits } = await problemLimiter.increment(actorId);
    return totalHits <= PROBLEM_ROWS_PER_MINUTE;
  },
  async loggedSince(actorId, action, since) {
    return !!(await prisma.activityEvent.findFirst({ where: { actorId, action, at: { gt: since } }, select: { id: true } }));
  },
  async batchStart(batchId) {
    return prisma.activityEvent.findFirst({ where: { batchId }, orderBy: { at: "asc" }, select: { actorId: true, at: true } });
  },
};

let store: ActivityStore = prismaStore;

/** Tests only: swap the storage, get back a function that restores it. */
export function __setActivityStoreForTest(s: ActivityStore): () => void {
  const prev = store;
  store = s;
  return () => {
    store = prev;
  };
}

/** Delete what is past the retention period. Awaited by the Activity page; best effort elsewhere. */
export async function sweepOldActivity(): Promise<void> {
  await store.sweep(new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
}

// --- The per-request recorder ----------------------------------------------------

export class ActivityRecorder {
  readonly startedAt = Date.now();
  patch: ActivityPatch | null = null;
  extra: ActivityEventInput[] = [];
  refusal: { reason: string; actor: Actor | null } | null = null;
  /** Work that may still add rows (a slow session check), awaited before the write. */
  pending: Promise<void>[] = [];

  constructor(readonly facts: RequestFacts) {}

  /** Add to (or override part of) this request's event. Later calls merge over earlier ones. */
  set(p: ActivityPatch): void {
    const prev = this.patch ?? {};
    this.patch = {
      ...prev,
      ...p,
      target: p.target === undefined ? prev.target : p.target === null ? null : { ...(prev.target ?? {}), ...p.target },
    };
  }

  /** An extra row, written with this request's facts (IP, device, session). */
  add(e: ActivityEventInput): void {
    this.extra.push(e);
  }

  /** This request was refused (a 403 for someone signed in): one "refused" row, with the reason. */
  refuse(reason: string, actor: Actor | null = null): void {
    this.refusal = { reason, actor };
  }
}

const REFUSALS: Record<string, string> = {
  forbidden_domain: "their email domain is not allowed",
  account_disabled: "the account is disabled",
  mfa_setup_required: "two-factor must be set up first",
  mfa_required: "the two-factor code was not entered",
  super_admin_required: "only the super admin can do this",
};

function outcomeFor(status: number): Outcome {
  if (status < 400) return "ok";
  if (status === 401 || status === 403) return "refused";
  return "failed";
}

function entryDefaults(entry: Exclude<CatalogueEntry, { skip: string }>, params: Record<string, string>): ActivityEventInput {
  const id = entry.target?.param ? params[entry.target.param] ?? null : null;
  return {
    category: entry.category,
    action: entry.action,
    summary: entry.label,
    target: entry.target ? { type: entry.target.type, id } : null,
  };
}

function merge(base: ActivityEventInput, patch: ActivityPatch | null): ActivityEventInput {
  if (!patch) return base;
  const target =
    patch.target === null
      ? null
      : patch.target
        ? ({ ...(base.target ?? {}), ...patch.target } as Target)
        : base.target;
  return {
    ...base,
    category: patch.category ?? base.category,
    action: patch.action ?? base.action,
    summary: patch.summary ?? base.summary,
    outcome: patch.outcome ?? base.outcome,
    details: patch.details ?? base.details,
    actor: patch.actor ?? base.actor,
    source: patch.source ?? base.source,
    target: target && target.type ? target : null,
  };
}

/**
 * The rows a finished request should write, before target names are looked up.
 * Pure: everything it needs is on `req` and `status`.
 */
export function planEvents(req: Request, status: number): { rows: ActivityEventInput[]; meta: boolean[] } {
  const rec = req.activity;
  if (!rec) return { rows: [], meta: [] };
  const path = (req.originalUrl || req.url).split("?")[0];
  const match = matchRoute(req.method, path);
  const mutating = MUTATING.has(req.method);
  const userActor: Actor | null = req.user ? { id: req.user.id, email: req.user.email } : null;
  const actor = rec.patch?.actor ?? rec.refusal?.actor ?? userActor;

  let primary: ActivityEventInput | null = null;
  if (match && !("skip" in match.entry)) {
    if (mutating || rec.patch || rec.refusal) primary = merge(entryDefaults(match.entry, match.params), rec.patch);
  } else if (match && "skip" in match.entry) {
    // A skipped route may still log something it chose to, in full.
    if (rec.patch?.category && rec.patch.action) {
      primary = merge({ category: rec.patch.category, action: rec.patch.action, summary: rec.patch.summary ?? rec.patch.action }, rec.patch);
    }
  } else if (mutating && req.route) {
    // ⚠️ A real route with no catalogue entry. Logged rather than dropped;
    // `npm run activity:test` fails until it has one.
    primary = { category: "activity", action: "unknown", summary: `${req.method} ${path}` };
  }
  if (rec.refusal) {
    const why = REFUSALS[rec.refusal.reason] ?? rec.refusal.reason;
    if (primary) {
      primary = { ...primary, outcome: "refused", details: { ...(primary.details as object | undefined), refusedBecause: why } };
    } else {
      primary = { category: "security", action: "security.refused", summary: `Was refused access: ${why}`, outcome: "refused", details: { reason: rec.refusal.reason } };
    }
  }

  const rows: ActivityEventInput[] = [];
  const meta: boolean[] = [];
  // No one to attribute it to (an anonymous request) means no row.
  if (primary && actor) {
    const outcome = primary.outcome ?? outcomeFor(status);
    // ⚠️ The catalogue's wording is the success tense ("Deleted an account").
    // When the request failed or was refused before its route said anything,
    // say so in the line itself, not only in the outcome column (USERS-AUDIT L3).
    const routeSpoke = !!rec.patch?.summary;
    const summary =
      routeSpoke || outcome === "ok" || outcome === "partial" || primary.action === "security.refused"
        ? primary.summary
        : `${outcome === "refused" ? "Refused" : "Failed"}: ${primary.summary}`;
    rows.push({ ...primary, summary, actor, outcome });
    meta.push(true);
  }
  for (const e of rec.extra) {
    if (!(e.actor ?? userActor)) continue;
    rows.push({ ...e, actor: e.actor ?? userActor });
    meta.push(false);
  }
  return { rows, meta };
}

function toRow(req: Request, e: ActivityEventInput, isPrimary: boolean, status: number, label: string | null): ActivityRow {
  const rec = req.activity!;
  const details = sanitizeDetails(e.details);
  return {
    at: e.at,
    source: e.source ?? "hub",
    actorId: e.actor?.id ?? null,
    actorEmail: e.actor?.email ?? null,
    category: e.category,
    action: e.action,
    outcome: e.outcome ?? "ok",
    targetType: e.target?.type ?? null,
    targetId: e.target?.id ?? null,
    targetLabel: (e.target?.label ?? label)?.slice(0, 500) ?? null,
    summary: e.summary.slice(0, 1000),
    details: details === undefined ? undefined : (details as Prisma.InputJsonValue),
    ip: rec.facts.ip,
    userAgent: rec.facts.userAgent,
    country: rec.facts.country,
    city: rec.facts.city,
    method: isPrimary ? req.method : null,
    path: isPrimary ? (req.originalUrl || req.url).split("?")[0].slice(0, 500) : null,
    status: isPrimary ? status : null,
    durationMs: isPrimary ? Date.now() - rec.startedAt : null,
    sessionId: req.user?.sessionId ?? null,
    batchId: rec.facts.batchId,
  };
}

/**
 * Name this request's target NOW, from the catalogue's target type and route
 * param: for a delete, which is written after the row has gone. Best effort.
 */
export async function nameTargetNow(req: Request): Promise<void> {
  const rec = req.activity;
  if (!rec) return;
  const match = matchRoute(req.method, (req.originalUrl || req.url).split("?")[0]);
  if (!match || "skip" in match.entry || !match.entry.target?.param) return;
  const id = match.params[match.entry.target.param];
  if (!id) return;
  try {
    const label = await store.label(match.entry.target.type, id);
    if (label) rec.set({ target: { label } });
  } catch {
    // The id is still recorded.
  }
}

/** How often the same person's view of the same customer list is logged again. */
export const VIEW_EVERY_MS = 10 * 60 * 1000;

/**
 * Log that someone loaded a list of customer data (the quote and resource
 * requests: names, emails, phones, companies). The log's rule is "actions, not
 * views", and this is its one exception (Josh, 2026-11-19, USERS-AUDIT M10):
 * "who took the customer list?" is the first question a data-protection
 * incident asks, and before this the honest answer was "the log can't say".
 *
 * At most once per person per list every VIEW_EVERY_MS, so a working morning
 * on the Quotes page is a row, not dozens. The check reads the table, so it
 * holds across server instances; if it fails, the view is logged anyway.
 */
export async function noteCustomerDataView(req: Request, action: string, summary: string, details: Record<string, unknown>): Promise<void> {
  const rec = req.activity;
  const actorId = req.user?.id;
  if (!rec || !actorId) return;
  try {
    if (await store.loggedSince?.(actorId, action, new Date(Date.now() - VIEW_EVERY_MS))) return;
  } catch {
    // Log it: a duplicate row beats a missing one.
  }
  rec.set({ summary, details });
}

let writes = 0;

/**
 * Write what this request should log. Returns null when there is nothing to
 * write, so the middleware can end the response at once.
 */
export function flushActivity(req: Request, status: number): Promise<void> | null {
  const rec = req.activity;
  // A slow session check may still add a "Signed in" (USERS-AUDIT L1): wait for
  // it, inside the middleware's bounded write.
  if (rec?.pending.length) {
    return Promise.allSettled(rec.pending).then(() => {
      rec.pending = [];
      return flushActivity(req, status) ?? undefined;
    });
  }
  const planned = planEvents(req, status);
  if (!planned.rows.length) return null;
  return (async () => {
    let { rows, meta } = planned;

    // Refused and failed rows: within each person's budget only.
    const keep: boolean[] = [];
    for (const e of rows) {
      const problem = e.outcome === "refused" || e.outcome === "failed";
      let ok = true;
      if (problem && e.actor?.id && store.problemBudget) {
        ok = await store.problemBudget(e.actor.id).catch(() => true);
        if (!ok) console.warn(`[activity] dropped a ${e.outcome} row for ${e.actor.id}: over ${PROBLEM_ROWS_PER_MINUTE}/minute`);
      }
      keep.push(ok);
    }
    if (keep.includes(false)) {
      rows = rows.filter((_, i) => keep[i]);
      meta = meta.filter((_, i) => keep[i]);
      if (!rows.length) return;
    }

    // ⚠️ The batch id comes from the browser (USERS-AUDIT M9). It joins a save
    // only for the person who started it, and only within BATCH_WINDOW_MS of
    // its first row; otherwise a fixed id would fold someone's later actions
    // into an old group, out of sight at the top of the list.
    const batchId = rec?.facts.batchId;
    if (batchId && store.batchStart) {
      const start = await store.batchStart(batchId).catch(() => null);
      const actorId = req.user?.id ?? rows[0].actor?.id ?? null;
      if (start && (start.actorId !== actorId || Date.now() - start.at.getTime() > BATCH_WINDOW_MS)) rec!.facts.batchId = null;
    }

    const labels = await Promise.all(
      rows.map(async (e) => {
        if (!e.target?.id || e.target.label) return null;
        try {
          return await store.label(e.target.type, e.target.id);
        } catch {
          return null;
        }
      }),
    );
    await store.insert(rows.map((e, i) => toRow(req, e, meta[i], status, labels[i])));
    // Best effort, about one write in fifty.
    if (++writes % 50 === 0) void sweepOldActivity().catch(() => {});
  })();
}

/** Write events outside a request's lifetime (Duda's log). */
export async function insertActivityRows(rows: ActivityRow[]): Promise<void> {
  if (rows.length) await store.insert(rows);
}

// --- Sessions: "Signed in" and "session used from a new IP" ----------------------

const SESSION_TOUCH_MS = 5 * 60 * 1000;
const SESSION_TIMEOUT_MS = 500;
const seen = new Map<string, { ip: string | null; at: number }>();

/**
 * Called by requireAuth for every verified request. The first request of a
 * new Supabase session adds a "Signed in" row; a known session seen from a
 * different IP adds "Session used from a new IP". Signing in itself happens
 * browser → Supabase, so this is the only place the server can notice it.
 *
 * Per-instance memory first, so a session costs one database round trip per
 * instance per five minutes. Bounded, and never fails the request.
 */
export async function noteSession(
  req: Request,
  user: { id: string; email: string },
  sessionId: string | null,
  signIn: { method: string | null; at: number | null },
): Promise<void> {
  const rec = req.activity;
  if (!rec || !sessionId) return;
  const ip = rec.facts.ip;
  const known = seen.get(sessionId);
  const now = Date.now();
  if (known && known.ip === ip && now - known.at < SESSION_TOUCH_MS) return;
  if (seen.size > 2000) seen.clear();
  seen.set(sessionId, { ip, at: now });

  /*
   * ⚠️ The rows are added when the write ANSWERS, not only if it answers
   * within SESSION_TIMEOUT_MS (USERS-AUDIT L1). The session was marked seen
   * above, so a write that landed late used to lose its "Signed in" for good:
   * every later check found the row and said "not new". A slow one now joins
   * `rec.pending`, which the request's own (bounded) activity write awaits.
   */
  const touch = store
    .touchSession({ sessionId, userId: user.id, email: user.email, ip, userAgent: rec.facts.userAgent })
    .then((result) => addSessionRows(rec, user, ip, signIn, result))
    .catch((err: Error) => console.error("[activity] session check failed:", err.message));
  const inTime = await Promise.race([touch.then(() => true), new Promise<false>((r) => setTimeout(() => r(false), SESSION_TIMEOUT_MS))]);
  if (!inTime) rec.pending.push(touch);
}

function addSessionRows(
  rec: ActivityRecorder,
  user: { id: string; email: string },
  ip: string | null,
  signIn: { method: string | null; at: number | null },
  result: { inserted: boolean; previousIp: string | null },
): void {
  {
    const actor = { id: user.id, email: user.email };
    if (result.inserted) {
      // Each sign-in also sweeps what is past the retention period, so the two
      // years hold whenever anyone uses the Hub, not only when the Activity
      // page is opened (USERS-AUDIT L6).
      void sweepOldActivity().catch(() => {});
      rec.add({
        category: "security",
        action: "auth.sign_in",
        summary: "Signed in",
        actor,
        target: { type: "user", id: user.id, label: user.email },
        details: { method: signIn.method, signedInAt: signIn.at ? new Date(signIn.at).toISOString() : null },
      });
    } else if (result.previousIp && ip && result.previousIp !== ip) {
      rec.add({
        category: "security",
        action: "auth.session_new_ip",
        summary: "Session used from a new IP",
        actor,
        target: { type: "user", id: user.id, label: user.email },
        details: { previousIp: result.previousIp, ip },
      });
    }
  }
}

/** Tests only. */
export function __forgetSessionsForTest(): void {
  seen.clear();
  writes = 0;
}

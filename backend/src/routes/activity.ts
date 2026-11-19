import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { supabase } from "../supabase.js";
import { staffName } from "../services/supabaseUsers.js";
import { requireSuperAdmin } from "../middleware/requireAuth.js";
import { PgRateLimitStore } from "../middleware/pgRateLimitStore.js";
import { sweepOldActivity } from "../services/activity.js";
import {
  ACCESS_ALERT,
  CATEGORY_LABELS,
  OTHER_ACTIONS,
  REPORTABLE,
  allActions,
  type ActivityCategory,
} from "../services/activityCatalog.js";
import { csvLine } from "../services/csv.js";
import { summariseGroup } from "../services/activityGroups.js";

/**
 * The platform activity log (CLAUDE.md "Activity log"). Reading it is for the
 * super admin only; `report` is for everyone signed in, so the browser can
 * record what happens outside this server (signing out, a password change, a
 * CSV built in the page).
 */
export const activityRouter = Router();

// --- What the browser reports ------------------------------------------------------

const reportLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  store: new PgRateLimitStore("activity-report"),
});

export const reportBody = z
  .object({
    action: z.enum(REPORTABLE),
    /** A CSV export: how many rows, and whether a filter or search was on. */
    rows: z.number().int().min(0).max(1_000_000).optional(),
    filtered: z.boolean().optional(),
  })
  .strict();

activityRouter.post("/activity/report", reportLimiter, (req, res) => {
  const parsed = reportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const { action, rows, filtered } = parsed.data;
  const known = OTHER_ACTIONS[action];
  const isExport = action.endsWith(".export");
  req.activity?.set({
    category: known.category,
    action,
    source: "browser",
    summary: isExport && rows !== undefined ? `${known.label} (${rows} ${rows === 1 ? "row" : "rows"}${filtered ? ", filtered" : ""})` : known.label,
    target: isExport ? null : { type: "user", id: req.user?.id ?? null, label: req.user?.email ?? null },
    details: isExport ? { rows, filtered: filtered ?? false } : undefined,
  });
  res.status(204).end();
});

// --- Reading the log (super admin) --------------------------------------------------

const OUTCOMES = ["ok", "problem"] as const;

const filtersSchema = z.object({
  category: z.string().max(40).optional(),
  action: z.string().max(80).optional(),
  actor: z.string().max(80).optional(),
  targetType: z.string().max(40).optional(),
  targetId: z.string().max(200).optional(),
  outcome: z.enum(OUTCOMES).optional(),
  ip: z.string().max(100).optional(),
  batch: z.string().max(60).optional(),
  q: z.string().trim().max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

type Filters = z.infer<typeof filtersSchema>;

function whereFor(f: Filters): Prisma.ActivityEventWhereInput {
  const and: Prisma.ActivityEventWhereInput[] = [];
  if (f.category) and.push({ category: f.category });
  if (f.action) and.push({ action: f.action });
  if (f.actor) and.push({ actorId: f.actor });
  if (f.targetType) and.push({ targetType: f.targetType });
  if (f.targetId) and.push({ targetId: f.targetId });
  if (f.ip) and.push({ ip: f.ip });
  if (f.batch) and.push({ batchId: f.batch });
  if (f.outcome === "ok") and.push({ outcome: "ok" });
  if (f.outcome === "problem") and.push({ outcome: { in: ["failed", "refused", "partial"] } });
  if (f.from) and.push({ at: { gte: new Date(f.from) } });
  if (f.to) and.push({ at: { lt: new Date(f.to) } });
  if (f.q) {
    const contains = { contains: f.q, mode: "insensitive" as const };
    and.push({
      OR: [{ summary: contains }, { targetLabel: contains }, { actorEmail: contains }, { ip: contains }, { action: contains }],
    });
  }
  return and.length ? { AND: and } : {};
}

/**
 * The same filters as SQL, for the grouped list (Prisma cannot group on an
 * expression). ⚠️ Keep the two in step: whereFor() still serves the members'
 * fetch and the export.
 */
function whereSql(f: Filters): Prisma.Sql {
  const c: Prisma.Sql[] = [];
  if (f.category) c.push(Prisma.sql`"category" = ${f.category}`);
  if (f.action) c.push(Prisma.sql`"action" = ${f.action}`);
  if (f.actor) c.push(Prisma.sql`"actorId" = ${f.actor}`);
  if (f.targetType) c.push(Prisma.sql`"targetType" = ${f.targetType}`);
  if (f.targetId) c.push(Prisma.sql`"targetId" = ${f.targetId}`);
  if (f.ip) c.push(Prisma.sql`"ip" = ${f.ip}`);
  if (f.batch) c.push(Prisma.sql`"batchId" = ${f.batch}`);
  if (f.outcome === "ok") c.push(Prisma.sql`"outcome" = 'ok'`);
  if (f.outcome === "problem") c.push(Prisma.sql`"outcome" IN ('failed', 'refused', 'partial')`);
  if (f.from) c.push(Prisma.sql`"at" >= ${new Date(f.from)}`);
  if (f.to) c.push(Prisma.sql`"at" < ${new Date(f.to)}`);
  if (f.q) {
    // ILIKE with the wildcards in the search escaped, so "%" finds a percent sign.
    const like = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
    c.push(
      Prisma.sql`("summary" ILIKE ${like} OR "targetLabel" ILIKE ${like} OR "actorEmail" ILIKE ${like} OR "ip" ILIKE ${like} OR "action" ILIKE ${like})`,
    );
  }
  return c.length ? Prisma.sql`WHERE ${Prisma.join(c, " AND ")}` : Prisma.empty;
}

function parseFilters(req: Request): Filters | null {
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) if (typeof v === "string" && v !== "") raw[k] = v;
  const parsed = filtersSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The list's columns: everything but the bulky ones, which the detail view loads. */
const LIST_SELECT = {
  id: true,
  at: true,
  source: true,
  actorId: true,
  actorEmail: true,
  category: true,
  action: true,
  outcome: true,
  targetType: true,
  targetId: true,
  targetLabel: true,
  summary: true,
  ip: true,
  country: true,
  city: true,
  batchId: true,
  status: true,
} satisfies Prisma.ActivityEventSelect;

/**
 * GET /api/activity — ONE row per save, newest first (Josh, 2026-11-18). Rows
 * sharing a batch id (a product save's details, logo switches and machine
 * translations) fold into one line (services/activityGroups.ts); a row with
 * no batch is its own group. Filters apply to the rows first, so a filter for
 * translations shows only translation rows, still grouped by their save.
 *
 * Each item is the group's representative row, with the group's own
 * `summary` and `outcome` and `batchCount` (its rows).
 */
activityRouter.get("/activity", requireSuperAdmin, async (req, res, next) => {
  try {
    const filters = parseFilters(req);
    if (!filters) {
      res.status(400).json({ error: "invalid_filters" });
      return;
    }
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(String(req.query.pageSize ?? "50"), 10) || 50));
    // Forget what is past the retention period. Cheap (an indexed range), and
    // it means the period holds even if nothing else ever triggers the sweep.
    await sweepOldActivity().catch((err: Error) => console.error("[activity] sweep failed:", err.message));

    const where = whereSql(filters);
    const [totals, groups] = await Promise.all([
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(DISTINCT COALESCE("batchId", "id")) AS n FROM "ActivityEvent" ${where}`,
      prisma.$queryRaw<{ gkey: string; started: Date }[]>`
        SELECT COALESCE("batchId", "id") AS gkey, min("at") AS started
        FROM "ActivityEvent" ${where}
        GROUP BY 1
        ORDER BY started DESC, gkey DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    ]);
    const total = Number(totals[0]?.n ?? 0);
    const keys = groups.map((g) => g.gkey);
    const members = keys.length
      ? await prisma.activityEvent.findMany({
          where: { AND: [whereFor(filters), { OR: [{ batchId: { in: keys } }, { id: { in: keys } }] }] },
          select: { ...LIST_SELECT, details: true },
          orderBy: { at: "asc" },
          take: MEMBERS_CAP * keys.length,
        })
      : [];
    const byKey = new Map<string, typeof members>();
    for (const m of members) {
      const k = m.batchId ?? m.id;
      byKey.set(k, [...(byKey.get(k) ?? []), m]);
    }
    const labels = new Map(allActions().map((a) => [a.action, a.label]));
    const items = keys.flatMap((k) => {
      const rows = byKey.get(k);
      if (!rows?.length) return [];
      const { representative, summary, outcome } = summariseGroup(rows, (a) => labels.get(a) ?? a);
      const { details: _details, ...rep } = representative as (typeof rows)[number];
      void _details;
      return [{ ...rep, summary, outcome, batchCount: rows.length }];
    });
    res.json({ items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) {
    next(err);
  }
});

// Names for the Person filter and the table, from Supabase (where names live).
let namesCache: { at: number; names: Map<string, string> } | null = null;
async function staffNames(): Promise<Map<string, string>> {
  if (namesCache && Date.now() - namesCache.at < 60_000) return namesCache.names;
  const names = new Map<string, string>();
  try {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) {
      // The server's copy of the name (staffName()), not one the person can edit.
      const name = staffName(u).full;
      if (name) names.set(u.id, name);
    }
  } catch {
    // Names are a nicety; the email always shows.
  }
  namesCache = { at: Date.now(), names };
  return names;
}

activityRouter.get("/activity/facets", requireSuperAdmin, async (_req, res, next) => {
  try {
    const [byCategory, byAction, byActor, names] = await Promise.all([
      prisma.activityEvent.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.activityEvent.groupBy({ by: ["action"], _count: { _all: true } }),
      prisma.activityEvent.groupBy({ by: ["actorId", "actorEmail"], _count: { _all: true } }),
      staffNames(),
    ]);
    const catCount = new Map(byCategory.map((r) => [r.category, r._count._all]));
    const actionCount = new Map(byAction.map((r) => [r.action, r._count._all]));
    const categories = (Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((value) => ({
      value,
      label: CATEGORY_LABELS[value],
      count: catCount.get(value) ?? 0,
    }));
    const actions = allActions().map((a) => ({ value: a.action, label: a.label, category: a.category, count: actionCount.get(a.action) ?? 0 }));
    // One person per id: an email can change, and a Duda entry may have none.
    const people = new Map<string, { id: string; email: string | null; name: string | null; count: number }>();
    for (const r of byActor) {
      if (!r.actorId) continue;
      const p = people.get(r.actorId) ?? { id: r.actorId, email: r.actorEmail, name: names.get(r.actorId) ?? null, count: 0 };
      p.count += r._count._all;
      people.set(r.actorId, p);
    }
    res.json({
      categories,
      actions,
      people: [...people.values()].sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")),
    });
  } catch (err) {
    next(err);
  }
});

const EXPORT_CAP = 50_000;
/** Under Vercel's 4.5 MB response limit, with room for the headers. */
const EXPORT_BYTES = 4_000_000;
const DETAILS_CHARS = 2_000;
/** A save's rows shown together; a save is a few dozen at most (M9). */
const MEMBERS_CAP = 200;
const LONDON = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * GET /api/activity/unseen?since=<ISO time> → `{ count, since }`: the badge on
 * the sidebar's Activity item. How many access changes (ACCESS_ALERT) someone
 * ELSE made after `since`, which the browser keeps as the account's
 * `activitySeenAt` (set when the page is opened). No `since`, or nonsense:
 * the last 7 days; never more than 90 back. Writes nothing.
 */
activityRouter.get("/activity/unseen", requireSuperAdmin, async (req, res, next) => {
  try {
    const DAY = 24 * 60 * 60 * 1000;
    const asked = Date.parse(String(req.query.since ?? ""));
    const since = new Date(Number.isFinite(asked) ? Math.max(asked, Date.now() - 90 * DAY) : Date.now() - 7 * DAY);
    const count = await prisma.activityEvent.count({
      where: {
        at: { gt: since },
        OR: [{ category: { in: ACCESS_ALERT.categories } }, { action: { in: ACCESS_ALERT.actions } }],
        NOT: { actorId: req.user!.id },
      },
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ count, since: since.toISOString() });
  } catch (err) {
    next(err);
  }
});

activityRouter.get("/activity/export.csv", requireSuperAdmin, async (req, res, next) => {
  try {
    const filters = parseFilters(req);
    if (!filters) {
      res.status(400).json({ error: "invalid_filters" });
      return;
    }
    const [rows, names] = await Promise.all([
      prisma.activityEvent.findMany({ where: whereFor(filters), orderBy: [{ at: "desc" }, { id: "desc" }], take: EXPORT_CAP }),
      staffNames(),
    ]);
    const actionLabels = new Map(allActions().map((a) => [a.action, a.label]));
    /*
     * ⚠️ Built line by line within EXPORT_BYTES (USERS-AUDIT M11). A function's
     * response cannot exceed 4.5 MB on Vercel, and one description edit's
     * details run to 20 KB, so the 50,000-row cap was never reachable: a big
     * export failed at the platform after its "Exported" row was written as a
     * success. Details are cut to DETAILS_CHARS here (the page has them whole),
     * and a file that is full says so in a header and in the log.
     */
    const header = ["Time (UTC)", "Time (UK)", "Person", "Email", "Category", "Action", "Summary", "Target type", "Target", "Outcome", "IP", "City", "Country", "Device", "Method", "Path", "Status", "Save", "Details"];
    const lines: string[] = [csvLine(header)];
    let bytes = Buffer.byteLength(lines[0]) + 3;
    let written = 0;
    for (const r of rows) {
      const details = r.details === null ? null : JSON.stringify(r.details);
      const line = csvLine([
        r.at.toISOString(),
        LONDON.format(r.at),
        (r.actorId && names.get(r.actorId)) || null,
        r.actorEmail,
        CATEGORY_LABELS[r.category as ActivityCategory] ?? r.category,
        actionLabels.get(r.action) ?? r.action,
        r.summary,
        r.targetType,
        r.targetLabel ?? r.targetId,
        r.outcome,
        r.ip,
        r.city,
        r.country,
        r.userAgent,
        r.method,
        r.path,
        r.status,
        r.batchId,
        details && details.length > DETAILS_CHARS ? `${details.slice(0, DETAILS_CHARS)}… [cut: the Activity page has it all]` : details,
      ]);
      const size = Buffer.byteLength(line) + 2;
      if (bytes + size > EXPORT_BYTES) break;
      lines.push(line);
      bytes += size;
      written++;
    }
    const full = written < rows.length;
    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    req.activity?.set({
      summary: full
        ? `Exported the activity log (the newest ${written} of ${rows.length} entries: the file limit)`
        : `Exported the activity log (${written} ${written === 1 ? "entry" : "entries"})`,
      details: { rows: written, matched: rows.length, capped: rows.length === EXPORT_CAP || full, filters },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    if (full) res.setHeader("X-Export-Truncated", `${written}/${rows.length}`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="saequip-activity-${stamp}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

activityRouter.get("/activity/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const row = await prisma.activityEvent.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [members, names] = await Promise.all([
      row.batchId
        ? prisma.activityEvent.findMany({
            where: { batchId: row.batchId },
            orderBy: { at: "asc" },
            take: MEMBERS_CAP,
            select: { id: true, at: true, category: true, action: true, outcome: true, summary: true, targetType: true, targetId: true, targetLabel: true, details: true, status: true },
          })
        : Promise.resolve([]),
      staffNames(),
    ]);
    // Every row of its save, so the page can show what one save did.
    const labels = new Map(allActions().map((a) => [a.action, a.label]));
    const group = members.length > 1 ? summariseGroup(members, (a) => labels.get(a) ?? a) : null;
    res.json({
      ...row,
      actorName: (row.actorId && names.get(row.actorId)) || null,
      batchCount: members.length,
      members: members.length > 1 ? members : [],
      groupSummary: group?.summary ?? null,
      groupOutcome: group?.outcome ?? null,
    });
  } catch (err) {
    next(err);
  }
});

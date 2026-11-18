import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { supabase } from "../supabase.js";
import { requireSuperAdmin } from "../middleware/requireAuth.js";
import { PgRateLimitStore } from "../middleware/pgRateLimitStore.js";
import { sweepOldActivity } from "../services/activity.js";
import {
  CATEGORY_LABELS,
  OTHER_ACTIONS,
  REPORTABLE,
  allActions,
  type ActivityCategory,
} from "../services/activityCatalog.js";
import { toCsv } from "../services/csv.js";

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
    const where = whereFor(filters);
    const [total, items] = await Promise.all([
      prisma.activityEvent.count({ where }),
      prisma.activityEvent.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ at: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
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
      const m = (u.user_metadata ?? {}) as { first_name?: unknown; last_name?: unknown };
      const name = [m.first_name, m.last_name].filter((x) => typeof x === "string" && x.trim()).join(" ").trim();
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
const LONDON = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
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
    const csv = toCsv(
      ["Time (UTC)", "Time (UK)", "Person", "Email", "Category", "Action", "Summary", "Target type", "Target", "Outcome", "IP", "City", "Country", "Device", "Method", "Path", "Status", "Save", "Details"],
      rows.map((r) => [
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
        r.details === null ? null : JSON.stringify(r.details),
      ]),
    );
    req.activity?.set({
      summary: `Exported the activity log (${rows.length} ${rows.length === 1 ? "entry" : "entries"})`,
      details: { rows: rows.length, capped: rows.length === EXPORT_CAP, filters },
    });
    const stamp = new Date().toISOString().slice(0, 10);
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
    const [batchCount, names] = await Promise.all([
      row.batchId ? prisma.activityEvent.count({ where: { batchId: row.batchId } }) : Promise.resolve(0),
      staffNames(),
    ]);
    res.json({ ...row, actorName: (row.actorId && names.get(row.actorId)) || null, batchCount });
  } catch (err) {
    next(err);
  }
});

import { Router, type Request, type Response, type NextFunction } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { PgRateLimitStore } from "../middleware/pgRateLimitStore.js";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { publicImageUrl, publicModelUrl, signedFileUrl } from "../services/storage.js";
import { sendQuoteNotification } from "../services/email.js";

/**
 * CORS allowlist for the public widget API. Browser requests from a
 * disallowed Origin are rejected (403). Requests with no Origin (server-to-
 * server / curl) pass through without CORS headers.
 */
export function publicCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && !env.publicAllowedOrigins.includes(origin)) {
    res.status(403).json({ error: "origin_not_allowed" });
    return;
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

const contentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});

/*
 * ⚠️ The two FORM-POST limiters are Postgres-backed; the content limiter above
 * is not, deliberately.
 *
 * express-rate-limit's default store is in-process memory, which on serverless
 * gives every short-lived instance its own counter — so "10 per minute"
 * becomes "10 per minute PER INSTANCE". Measured against production: 30
 * concurrent posts to /public/quotes let 12 through rather than 10, because
 * more than one instance served the burst. Under sustained load Vercel spins
 * up more instances, each with a fresh budget, so the cap is soft exactly when
 * it matters.
 *
 * The reason the content limiter stays in memory does NOT apply here: that one
 * is hit on every product page view, where a DB write per request is the wrong
 * trade. A quote submission or a gated-download lead is a rare, deliberate
 * action, so one INSERT to count it costs nothing measurable and buys a limit
 * that actually holds across instances.
 *
 * Still IP-keyed, so a distributed source defeats it. Edge rules (Vercel
 * Firewall) are the answer to that, not application code.
 */
const leadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("public-lead"),
  message: { error: "rate_limited" },
});

const quoteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("public-quote"),
  message: { ok: false, error: "Too many requests, please try again shortly." },
});

/**
 * A second, tighter window on top of the per-minute one.
 *
 * Ten submissions a minute is a reasonable ceiling for a human who mistypes an
 * email and retries, but sustained over an hour it is 600 rows of junk. This
 * catches the slow drip that a per-minute limit is blind to by design.
 */
const quoteHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: false,
  legacyHeaders: false,
  store: new PgRateLimitStore("public-quote-hourly"),
  message: { ok: false, error: "Too many requests, please try again later." },
});

export const publicRouter = Router();

/**
 * Locate the widget assets across all three ways this app runs.
 *
 * Tried in order rather than assuming one layout:
 *   1. relative to this module — `src/public-widget` under tsx in dev, and
 *      `dist/public-widget` in a normal build (postbuild copies it there)
 *   2. relative to the working directory — Vercel bundles the function with
 *      its own output layout, so `import.meta.url` need not sit beside `src`;
 *      `includeFiles: "src/public-widget/**"` in vercel.json places the files
 *      under the task root instead
 *
 * Resolved once at module load. A missing widget is a deploy fault, not a
 * per-request one, so it's worth a loud log at startup rather than only
 * surfacing as a 500 the first time Duda asks for the script.
 */
function resolveWidgetDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../public-widget"),
    path.join(process.cwd(), "src/public-widget"),
    path.join(process.cwd(), "dist/public-widget"),
    path.join(process.cwd(), "backend/src/public-widget"),
  ];
  const found = candidates.find((dir) => existsSync(path.join(dir, "widget.js")));
  if (!found) {
    console.error(
      `[public] widget.js not found. Looked in:\n  ${candidates.join("\n  ")}\n` +
        `  On Vercel this means includeFiles in backend/vercel.json is not shipping src/public-widget.`,
    );
  }
  return found ?? null;
}

const WIDGET_DIR = resolveWidgetDir();

/** GET /public/widget.js — the embeddable widget script. */
publicRouter.get("/widget.js", (_req, res) => {
  try {
    if (!WIDGET_DIR) throw new Error("widget assets not deployed");
    const js = readFileSync(path.join(WIDGET_DIR, "widget.js"), "utf8");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(js);
  } catch {
    res.status(500).type("text/plain").send("// widget unavailable");
  }
});

/** GET /public/test.html — local test harness (open at http://localhost:4000/public/test.html). */
publicRouter.get("/test.html", (_req, res) => {
  try {
    if (!WIDGET_DIR) throw new Error("widget assets not deployed");
    const html = readFileSync(path.join(WIDGET_DIR, "test.html"), "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch {
    res.status(404).type("text/plain").send("not found");
  }
});

/**
 * GET /public/products/content?slug=|sku=|dudaId=
 * Public render payload. Exactly one identifier required. Gated downloads
 * NEVER include a file URL.
 */
publicRouter.get("/products/content", contentLimiter, async (req, res, next) => {
  const candidates: Array<[string, unknown]> = [
    ["slug", req.query.slug],
    ["sku", req.query.sku],
    ["dudaId", req.query.dudaId],
  ];
  const provided = candidates.filter(
    (c): c is [string, string] => typeof c[1] === "string" && c[1].trim().length > 0,
  );
  if (provided.length !== 1) {
    res.status(400).json({ error: "exactly_one_identifier", detail: "provide exactly one of slug, sku, dudaId" });
    return;
  }

  const [key, value] = provided[0];
  const startedAt = Date.now();
  try {
    const where =
      key === "slug" ? { slug: value } : key === "sku" ? { sku: value } : { dudaProductId: value };

    // Single query: HubProduct + all nested content. Source of truth is Supabase;
    // this endpoint makes NO Duda / external API calls.
    console.time("[public/content] db");
    const full = await prisma.hubProduct.findFirst({
      where,
      include: {
        logos: { include: { logo: { include: { mediaAsset: true } } } },
        specRows: { orderBy: { sortOrder: "asc" } },
        textItems: { orderBy: { sortOrder: "asc" } },
        downloads: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
        glbAsset: true,
      },
    });
    console.timeEnd("[public/content] db");

    if (!full) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Logos: public image URLs are built locally (no network round-trip).
    const activeLogos = full.logos.map((l) => l.logo).sort((a, b) => a.sortOrder - b.sortOrder);
    const shapeLogo = (l: (typeof activeLogos)[number]) => ({
      url: publicImageUrl(l.mediaAsset.storagePath),
      alt: l.alt,
      label: l.label,
    });
    const sa = activeLogos.filter((l) => l.kind === "SA_LOGO").map(shapeLogo);
    const cert = activeLogos.filter((l) => l.kind === "CERT_LOGO").map(shapeLogo);

    // Downloads: only NON-gated require a (network) signed URL; gated get none.
    console.time("[public/content] sign");
    const downloads = await Promise.all(
      full.downloads.map(async (d) =>
        d.gated
          ? { id: d.id, title: d.title, gated: true as const }
          : {
              id: d.id,
              title: d.title,
              gated: false as const,
              fileUrl: await signedFileUrl(d.mediaAsset.storagePath, 3600),
            },
      ),
    );
    console.timeEnd("[public/content] sign");

    // Short freshness window + background revalidation: visitors get an instant
    // (at most 5s-stale) response, and edits (e.g. toggling a logo) propagate
    // within a request or two instead of waiting out a flat 60s cache.
    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=55");
    res.json({
      name: full.name,
      sku: full.sku,
      slug: full.slug,
      dudaProductId: full.dudaProductId,
      // Mirrors Duda's native `description`. Served from here because this
      // endpoint is a pure Supabase read by design and must never call Duda,
      // so a widget-rendered "Overview" needs the Hub's own copy.
      //
      // ⚠️ Sanitised on the way OUT, not trusted from the database. This is the
      // only field the widget injects as HTML rather than as textContent, and
      // the dashboard's description editor is a raw-HTML textarea whose save
      // schema is a bare `z.string()` — so a `<script>` typed there reaches
      // this row intact. Sanitising at the public boundary means the stored
      // value cannot become an XSS on the live product page regardless of how
      // it got there. `stripCruft` allows only the tag set the widget renders
      // (p/strong/em/h4-h6/ul/ol/li/a/hr/sup/sub) and no attributes beyond
      // href/target/rel.
      // ⚠️ TEMPORARILY UNSANITISED — see the note above. Sanitising here pulled
      // sanitize-html into the serverless function's import graph for the
      // first time and the whole function began failing at module load
      // (FUNCTION_INVOCATION_FAILED on every route, including /api/health).
      // Reverted to restore the API; the protection is re-added by escaping in
      // the widget until the cause is identified.
      //
      // SAFE ONLY BECAUSE the widget currently escapes this field rather than
      // injecting it. Do NOT render this with innerHTML until sanitisation is
      // restored here.
      descriptionHtml: full.descriptionHtml ?? null,
      logos: { sa, cert },
      specs: full.specRows.map((s) => ({ label: s.label, value: s.value })),
      benefits: full.textItems.filter((t) => t.kind === "BENEFIT").map((t) => t.text),
      applications: full.textItems.filter((t) => t.kind === "APPLICATION").map((t) => t.text),
      downloads,
      model3dUrl: full.glbAsset ? publicModelUrl(full.glbAsset.storagePath) : null,
    });
    console.log(`[public/content] ${key}=${value} total ${Date.now() - startedAt}ms`);
  } catch (err) {
    next(err);
  }
});

const leadSchema = z
  .object({
    name: z.string().trim().min(1, "name required").max(200),
    email: z.string().trim().email("invalid email").max(320),
    company: z.string().trim().max(200).optional(),
    website: z.string().optional(), // honeypot — must be empty
  })
  .strict();

/**
 * POST /public/downloads/:downloadId/lead
 * Captures a lead and returns a short-lived signed URL to the file.
 * Honeypot: if `website` is filled, silently succeed without creating a lead.
 */
publicRouter.post("/downloads/:downloadId/lead", leadLimiter, async (req, res, next) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }
  const { name, email, company, website } = parsed.data;

  if (website && website.trim().length > 0) {
    res.status(200).json({ ok: true }); // bot — no lead created
    return;
  }

  try {
    const dl = await prisma.download.findUnique({
      where: { id: req.params.downloadId },
      include: { mediaAsset: true, hubProduct: true },
    });
    if (!dl) {
      res.status(404).json({ error: "download_not_found" });
      return;
    }
    // Snapshot where the lead came from. The FK is SetNull, so if the product
    // is later deleted the lead survives — but only stays meaningful because
    // these denormalised fields were written here, at capture time.
    await prisma.lead.create({
      data: {
        downloadId: dl.id,
        name,
        email,
        company: company ?? null,
        downloadTitle: dl.title,
        productName: dl.hubProduct.name,
        productSku: dl.hubProduct.sku,
      },
    });
    const fileUrl = await signedFileUrl(dl.mediaAsset.storagePath, 300); // 5-min TTL
    res.status(201).json({ fileUrl });
  } catch (err) {
    next(err);
  }
});

/**
 * A basket line's selected variation options, e.g. `{ Voltage: "240V" }`.
 *
 * ⚠️ Was `z.any()`, which accepted anything at all — a deeply nested or
 * enormous object went straight into a JSON column, and with up to 100 items
 * per request that is a storage-amplification vector bounded only by the body
 * size limit. Duda's basket sends a flat map of option name to chosen value,
 * so that is exactly what is allowed: string keys, scalar values, both capped,
 * and at most 40 pairs.
 */
const quoteOptionsSchema = z
  .record(z.string().trim().max(200), z.union([z.string().trim().max(500), z.number(), z.boolean()]))
  .refine((o) => Object.keys(o).length <= 40, "too many options on one item");

const quoteItemSchema = z.object({
  name: z.string().trim().min(1, "each item needs a name").max(200),
  sku: z.string().trim().max(200).optional(),
  options: quoteOptionsSchema.optional(),
  price: z.string().trim().max(100).optional(),
  quantity: z.coerce.number().int().positive().max(100_000).optional(),
});

/**
 * Trim, then strip CR/LF and other control characters.
 *
 * ⚠️ `name` is interpolated into the notification's Subject line. Resend's
 * JSON API is immune to header injection, but the moment this is switched to
 * SMTP a newline in a header value is the classic way to inject extra headers
 * (a Bcc, say). Stripping at the boundary means that switch cannot reintroduce
 * the hole, and it keeps the stored data clean either way.
 */
const headerSafe = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    // eslint-disable-next-line no-control-regex
    .transform((v) => v.replace(/[\u0000-\u001f\u007f]/g, " ").trim());

const quoteSchema = z.object({
  name: headerSafe(200).pipe(z.string().min(1, "name is required")),
  email: z.string().trim().email("a valid email is required").max(320),
  company: headerSafe(200).optional(),
  phone: headerSafe(50).optional(),
  message: z.string().trim().max(5000).optional(),
  items: z.array(quoteItemSchema).min(1, "at least one item is required").max(100, "too many items"),
});

/**
 * POST /public/quotes
 * Replaces the legacy quote-mailer.php — SAME request/response contract, so
 * the live Duda basket-page widget can point at this unchanged.
 *
 * Honeypot (`website` non-empty) and bot-timing (`elapsedMs` < 1500) checks
 * run on the raw body BEFORE schema validation, so a bot that omits/garbles
 * real fields still gets trapped silently rather than surfacing a 400.
 */
publicRouter.post("/quotes", quoteLimiter, quoteHourlyLimiter, async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const website = typeof body.website === "string" ? body.website.trim() : "";
    if (website.length > 0) {
      res.status(200).json({ ok: true }); // bot — no quote request created
      return;
    }

    const elapsedMs = Number(body.elapsedMs);
    if (Number.isFinite(elapsedMs) && elapsedMs < 1500) {
      res.status(200).json({ ok: false, error: "Please try again." });
      return;
    }

    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    const { name, email, company, phone, message, items } = parsed.data;

    const created = await prisma.quoteRequest.create({
      data: {
        name,
        email,
        company: company || null,
        phone: phone || null,
        message: message || null,
        items: {
          create: items.map((item) => ({
            name: item.name,
            sku: item.sku || null,
            options: item.options ?? undefined,
            price: item.price || null,
            quantity: item.quantity ?? 1,
          })),
        },
      },
      include: { items: true },
    });

    const emailResult = await sendQuoteNotification(created, created.items);
    if (emailResult.sent) {
      await prisma.quoteRequest.update({ where: { id: created.id }, data: { emailSent: true } });
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[public/quotes] unexpected error:", err);
    res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
});

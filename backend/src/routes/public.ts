import { Router, type Request, type Response, type NextFunction } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { resolveUrl, signedFileUrl } from "../services/storage.js";

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

const leadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});

export const publicRouter = Router();

// Directory holding the widget assets, resolved relative to THIS module so it
// works both in dev (tsx from src/routes) and prod (node from dist/routes).
// postbuild copies src/public-widget -> dist/public-widget.
const WIDGET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public-widget");

/** GET /public/widget.js — the embeddable widget script. */
publicRouter.get("/widget.js", (_req, res) => {
  try {
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
  try {
    const where =
      key === "slug" ? { slug: value } : key === "sku" ? { sku: value } : { dudaProductId: value };
    const hub = await prisma.hubProduct.findFirst({ where });
    if (!hub) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const full = await prisma.hubProduct.findUniqueOrThrow({
      where: { id: hub.id },
      include: {
        logos: { include: { logo: { include: { mediaAsset: true } } } },
        specRows: { orderBy: { sortOrder: "asc" } },
        textItems: { orderBy: { sortOrder: "asc" } },
        downloads: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    const activeLogos = full.logos.map((l) => l.logo).sort((a, b) => a.sortOrder - b.sortOrder);
    const sa = await Promise.all(
      activeLogos
        .filter((l) => l.kind === "SA_LOGO")
        .map(async (l) => ({
          url: await resolveUrl(l.mediaAsset.kind, l.mediaAsset.storagePath),
          alt: l.alt,
          label: l.label,
        })),
    );
    const cert = await Promise.all(
      activeLogos
        .filter((l) => l.kind === "CERT_LOGO")
        .map(async (l) => ({
          url: await resolveUrl(l.mediaAsset.kind, l.mediaAsset.storagePath),
          alt: l.alt,
          label: l.label,
        })),
    );

    const downloads = await Promise.all(
      full.downloads.map(async (d) =>
        d.gated
          ? { id: d.id, title: d.title, gated: true as const }
          : {
              id: d.id,
              title: d.title,
              gated: false as const,
              fileUrl: await resolveUrl(d.mediaAsset.kind, d.mediaAsset.storagePath),
            },
      ),
    );

    res.json({
      name: full.name,
      sku: full.sku,
      slug: full.slug,
      dudaProductId: full.dudaProductId,
      logos: { sa, cert },
      specs: full.specRows.map((s) => ({ label: s.label, value: s.value })),
      benefits: full.textItems.filter((t) => t.kind === "BENEFIT").map((t) => t.text),
      applications: full.textItems.filter((t) => t.kind === "APPLICATION").map((t) => t.text),
      downloads,
    });
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
      include: { mediaAsset: true },
    });
    if (!dl) {
      res.status(404).json({ error: "download_not_found" });
      return;
    }
    await prisma.lead.create({ data: { downloadId: dl.id, name, email, company: company ?? null } });
    const fileUrl = await signedFileUrl(dl.mediaAsset.storagePath, 300); // 5-min TTL
    res.status(201).json({ fileUrl });
  } catch (err) {
    next(err);
  }
});

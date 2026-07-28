import express, { Router, type ErrorRequestHandler } from "express";
import cors from "cors";
import { env } from "./env.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { dudaRouter } from "./routes/duda.js";
import { mediaRouter } from "./routes/media.js";
import { logosRouter } from "./routes/logos.js";
import { optionsRouter } from "./routes/options.js";
import { downloadsRouter } from "./routes/downloads.js";
import { quotesRouter } from "./routes/quotes.js";
import { publicRouter, publicCors } from "./routes/public.js";
import { DudaApiError } from "./services/duda.js";
import { StorageError, ensureBuckets } from "./services/storage.js";

const app = express();

app.use(express.json());

// --- PUBLIC widget API: own CORS allowlist + rate limits, NO auth ---
app.use("/public", publicCors, publicRouter);

// --- Everything else: permissive CORS ---
app.use(cors());

// --- Public ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Protected (single) ---
app.get("/api/me", requireAuth, (req, res) => {
  res.json(req.user);
});

// --- Protected API (Duda read-layer + Media Centre), all behind requireAuth ---
const api = Router();
api.use(dudaRouter);
api.use(mediaRouter);
api.use(logosRouter);
api.use(optionsRouter);
api.use(downloadsRouter);
api.use(quotesRouter);
app.use("/api", requireAuth, api);

/** Prisma known-request errors carry a string `code` like "P2002". */
function prismaErrorCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : null;
}

// Error handler: surface upstream failures with useful status codes.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DudaApiError) {
    // Map the upstream status through rather than blanket-502ing. A Duda 4xx
    // means OUR payload was wrong, and reporting that as 502 hides the real
    // cause exactly when array-payload writes are being developed.
    const upstream = err.status;
    const status =
      upstream === 404 ? 404 : upstream === 429 ? 429 : upstream >= 400 && upstream < 500 ? 400 : 502;

    if (upstream === 429) res.setHeader("Retry-After", "5");
    res.status(status).json({
      error: "duda_api_error",
      upstream_status: upstream,
      detail: err.body.slice(0, 500),
    });
    return;
  }
  if (err instanceof StorageError) {
    res.status(502).json({ error: "storage_error", detail: err.message });
    return;
  }

  const code = prismaErrorCode(err);
  if (code === "P2002") {
    // Unique constraint. HubProduct.slug is the realistic case, and a generic
    // 500 here reads as a server bug rather than "that slug is taken".
    const target = (err as { meta?: { target?: unknown } }).meta?.target;
    const field = Array.isArray(target) ? target.join(", ") : typeof target === "string" ? target : undefined;
    res.status(409).json({
      error: field?.includes("slug") ? "duplicate_slug" : "unique_violation",
      detail: field ? `Already in use: ${field}` : "A unique field is already in use.",
    });
    return;
  }
  if (code === "P2025") {
    res.status(404).json({ error: "not_found", detail: "The requested record does not exist." });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "internal_error" });
};
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
  void ensureBuckets();
});

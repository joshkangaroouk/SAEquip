import express, { Router, type ErrorRequestHandler } from "express";
import cors from "cors";
import { env } from "./env.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { dudaRouter } from "./routes/duda.js";
import { mediaRouter } from "./routes/media.js";
import { logosRouter } from "./routes/logos.js";
import { downloadsRouter } from "./routes/downloads.js";
import { DudaApiError } from "./services/duda.js";
import { StorageError, ensureBuckets } from "./services/storage.js";

const app = express();

app.use(cors());
app.use(express.json());

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
api.use(downloadsRouter);
app.use("/api", requireAuth, api);

// Error handler: surface upstream failures with useful status codes.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DudaApiError) {
    res.status(502).json({
      error: "duda_api_error",
      upstream_status: err.status,
      detail: err.body.slice(0, 500),
    });
    return;
  }
  if (err instanceof StorageError) {
    res.status(502).json({ error: "storage_error", detail: err.message });
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

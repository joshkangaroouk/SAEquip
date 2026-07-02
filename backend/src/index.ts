import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { env } from "./env.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { dudaRouter } from "./routes/duda.js";
import { DudaApiError } from "./services/duda.js";

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

// --- Protected: Duda product read-layer (all behind requireAuth) ---
app.use("/api", requireAuth, dudaRouter);

// Error handler: surface upstream Duda failures as 502 with the real status.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DudaApiError) {
    res.status(502).json({
      error: "duda_api_error",
      upstream_status: err.status,
      detail: err.body.slice(0, 500),
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal_error" });
};
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
});

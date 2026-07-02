import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { requireAuth } from "./middleware/requireAuth.js";

const app = express();

app.use(cors());
app.use(express.json());

// Public health check.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Protected: returns the authenticated user.
app.get("/api/me", requireAuth, (req, res) => {
  res.json(req.user);
});

app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
});

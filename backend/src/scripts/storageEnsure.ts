/**
 * Create/repair the storage buckets and their size + mimetype limits.
 *
 *   npm run storage:ensure --workspace=backend
 *
 * A deploy-time task, not a startup one. It used to run inside
 * `app.listen()`'s callback, which is harmless for a long-lived container but
 * wrong on serverless: the module is evaluated on every cold start, so it
 * would add several Supabase round trips to a user's request and re-do the
 * same idempotent work forever.
 *
 * Worth running after any change to MAX_BYTES or the mimetype allowlists,
 * since the bucket limits are the only enforcement left now that uploads go
 * straight from the browser to Supabase.
 */
import { ensureBuckets } from "../services/storage.js";

ensureBuckets()
  .then(() => console.log("\n✓ buckets ensured\n"))
  .catch((err) => {
    console.error("\n✗ failed:", err instanceof Error ? err.message : err, "\n");
    process.exit(1);
  });

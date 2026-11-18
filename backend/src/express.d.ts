import "express";
import type { ActivityRecorder } from "./services/activity.js";

// Augment Express's Request so route handlers can read the authenticated user
// that requireAuth attaches.
declare global {
  namespace Express {
    interface Request {
      /**
       * `role` is "super_admin" or null, from the user's app_metadata (only the
       * service role can write it). `aal` is the token's assurance level:
       * "aal2" once the second factor has been used. `sessionId` is the
       * token's Supabase session (the activity log's sign-in detection).
       */
      user?: { id: string; email: string; role: string | null; aal: string | null; sessionId?: string | null };
      /**
       * This request's activity log entry (middleware/activity.ts), on every
       * /api request. `req.activity?.set({...})` adds the target's name and
       * the before → after; see services/activity.ts.
       */
      activity?: ActivityRecorder;
    }
  }
}

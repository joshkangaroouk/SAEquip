import "express";

// Augment Express's Request so route handlers can read the authenticated user
// that requireAuth attaches.
declare global {
  namespace Express {
    interface Request {
      /**
       * `role` is "super_admin" or null, from the user's app_metadata (only the
       * service role can write it). `aal` is the token's assurance level:
       * "aal2" once the second factor has been used.
       */
      user?: { id: string; email: string; role: string | null; aal: string | null };
    }
  }
}

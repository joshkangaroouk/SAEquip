import "express";

// Augment Express's Request so route handlers can read the authenticated user
// that requireAuth attaches.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

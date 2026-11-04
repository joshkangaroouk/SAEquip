import { Router } from "express";
import { prisma } from "../prisma.js";

export const enquiriesRouter = Router();

/**
 * GET /api/enquiries/counts — how many quote requests and resource requests
 * are NOT yet handled, for the sidebar's badges.
 *
 * Its own endpoint because the sidebar loads neither list: deriving the
 * counts would mean fetching every quote (with its items and product matching)
 * and every resource request on every page. Two COUNTs instead.
 */
enquiriesRouter.get("/enquiries/counts", async (_req, res, next) => {
  try {
    const [quotes, resourceRequests] = await Promise.all([
      prisma.quoteRequest.count({ where: { handledAt: null } }),
      prisma.lead.count({ where: { handledAt: null } }),
    ]);
    res.json({ quotes, resourceRequests });
  } catch (err) {
    next(err);
  }
});

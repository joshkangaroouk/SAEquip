import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { isEmailConfigured } from "../services/email.js";
import { quoteProductMatcher, type MatchedProduct } from "../services/quoteProducts.js";
import {
  addNoteRoute,
  deleteNoteRoute,
  deleteRoute,
  markReadRoute,
  noteSelect,
  stateRoute,
  stateSelect,
} from "../services/enquiryState.js";

export const quotesRouter = Router();

// The team's notes come with every quote, oldest first: a handful per quote,
// so one query beats a request per opened detail.
const quoteInclude = { items: true, teamNotes: { select: noteSelect, orderBy: { createdAt: "asc" } } } as const;

type QuoteWithItems = Prisma.QuoteRequestGetPayload<{ include: typeof quoteInclude }>;

type Matcher = (name: string, sku: string | null) => MatchedProduct | null;

/**
 * A line's product and picture: the snapshot taken when the quote arrived, or —
 * for quotes from before snapshots existed — a match made now.
 */
function lineProduct(item: QuoteWithItems["items"][number], match: Matcher) {
  if (item.dudaProductId) return { dudaProductId: item.dudaProductId, imageUrl: item.imageUrl };
  const m = match(item.name, item.sku);
  return { dudaProductId: m?.dudaProductId ?? null, imageUrl: m?.imageUrl ?? null };
}

function shapeQuote(q: QuoteWithItems, match: Matcher) {
  return {
    id: q.id,
    name: q.name,
    email: q.email,
    company: q.company,
    phone: q.phone,
    message: q.message,
    firstName: q.firstName,
    lastName: q.lastName,
    requiredBy: q.requiredBy,
    address: q.address,
    country: q.country,
    postcode: q.postcode,
    locale: q.locale,
    createdAt: q.createdAt,
    emailSent: q.emailSent,
    // Read state and star, shared by the team (PATCH /quotes/:id).
    readAt: q.readAt,
    readBy: q.readBy,
    starredAt: q.starredAt,
    starredBy: q.starredBy,
    // The team's notes, oldest first (POST /quotes/:id/notes).
    teamNotes: q.teamNotes,
    items: q.items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      options: item.options,
      price: item.price,
      quantity: item.quantity,
      ...lineProduct(item, match),
    })),
  };
}

/** GET /api/quotes */
quotesRouter.get("/quotes", async (_req, res, next) => {
  try {
    const requests = await prisma.quoteRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: quoteInclude,
    });
    const match = await quoteProductMatcher();
    res.json({ emailEnabled: isEmailConfigured(), requests: requests.map((r) => shapeQuote(r, match)) });
  } catch (err) {
    next(err);
  }
});

/** GET /api/quotes/:id */
quotesRouter.get("/quotes/:id", async (req, res, next) => {
  try {
    const quote = await prisma.quoteRequest.findUnique({
      where: { id: req.params.id },
      include: quoteInclude,
    });
    if (!quote) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(shapeQuote(quote, await quoteProductMatcher()));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/quotes/:id  { read?, starred? }
 * Opening a quote on the dashboard sends `read: true`; "Mark as unread" and
 * the star send the rest. Rules in services/enquiryState.ts.
 */
quotesRouter.patch(
  "/quotes/:id",
  stateRoute({
    find: (id) => prisma.quoteRequest.findUnique({ where: { id }, select: stateSelect }),
    update: (id, data) => prisma.quoteRequest.update({ where: { id }, data, select: stateSelect }),
  }),
);

/** POST /api/quotes/mark-read  { ids } — "Mark all as read". */
quotesRouter.post(
  "/quotes/mark-read",
  markReadRoute({
    markRead: (ids, data) => prisma.quoteRequest.updateMany({ where: { id: { in: ids }, readAt: null }, data }),
    states: (ids) => prisma.quoteRequest.findMany({ where: { id: { in: ids } }, select: stateSelect }),
  }),
);

/** POST /api/quotes/:id/notes { body } and DELETE …/notes/:noteId (author only). */
const quoteNotes = {
  exists: async (id: string) => (await prisma.quoteRequest.count({ where: { id } })) > 0,
  create: (id: string, body: string, createdBy: string | null) =>
    prisma.enquiryNote.create({ data: { quoteRequestId: id, body, createdBy }, select: noteSelect }),
  find: (id: string, noteId: string) =>
    prisma.enquiryNote.findFirst({ where: { id: noteId, quoteRequestId: id }, select: { createdBy: true } }),
  remove: (noteId: string) => prisma.enquiryNote.delete({ where: { id: noteId } }),
};
quotesRouter.post("/quotes/:id/notes", addNoteRoute(quoteNotes));
quotesRouter.delete("/quotes/:id/notes/:noteId", deleteNoteRoute(quoteNotes));

/** DELETE /api/quotes/:id?confirm=true — permanent; its basket lines and notes go with it (cascade). */
quotesRouter.delete(
  "/quotes/:id",
  deleteRoute("quote request", (id) => prisma.quoteRequest.delete({ where: { id } })),
);

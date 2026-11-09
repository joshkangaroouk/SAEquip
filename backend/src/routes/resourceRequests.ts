import { Router } from "express";
import { prisma } from "../prisma.js";
import {
  addNoteRoute,
  deleteNoteRoute,
  deleteRoute,
  markReadRoute,
  noteSelect,
  stateRoute,
  stateSelect,
} from "../services/enquiryState.js";

export const resourceRequestsRouter = Router();

/**
 * GET /api/resource-requests — every resource request (a `Lead` row), newest
 * first, for the Resource Requests page. Mounted behind requireAuth.
 *
 * Each row is self-describing from its own snapshots (file, product, consent
 * wording), so a request stays readable after its download or product is
 * deleted. The product picture is the only live lookup: one query for every
 * product named, never one per row.
 *
 * ⚠️ Returns every row, like /api/quotes. Fine at today's volume; page it if
 * the list grows into the thousands.
 */
resourceRequestsRouter.get("/resource-requests", async (_req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: { teamNotes: { select: noteSelect, orderBy: { createdAt: "asc" } } },
    });
    const ids = [...new Set(leads.map((l) => l.dudaProductId).filter((v): v is string => !!v))];
    const products = ids.length
      ? await prisma.hubProduct.findMany({ where: { dudaProductId: { in: ids } }, select: { dudaProductId: true, thumbnailUrl: true } })
      : [];
    const thumb = new Map(products.map((p) => [p.dudaProductId, p.thumbnailUrl]));

    res.json({
      requests: leads.map((l) => ({
        id: l.id,
        name: l.name,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        company: l.company,
        phone: l.phone,
        mobile: l.mobile,
        privacyConsent: l.privacyConsent,
        marketingConsent: l.marketingConsent,
        consentText: l.consentText,
        // English copy of the consent, for a request made in another language.
        consentTextEn: l.consentTextEn,
        locale: l.locale,
        createdAt: l.createdAt,
        // Read state and star, shared by the team (PATCH /resource-requests/:id).
        readAt: l.readAt,
        readBy: l.readBy,
        starredAt: l.starredAt,
        starredBy: l.starredBy,
        // The team's notes, oldest first (POST /resource-requests/:id/notes).
        teamNotes: l.teamNotes,
        file: {
          title: l.downloadTitle,
          fileName: l.fileName,
          // Null once the download was removed from its product; the snapshot remains.
          stillListed: l.downloadId !== null,
          productName: l.productName,
          productSku: l.productSku,
          dudaProductId: l.dudaProductId,
          imageUrl: l.dudaProductId ? thumb.get(l.dudaProductId) ?? null : null,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/resource-requests/:id  { read?, starred? }
 * The resource-request twin of PATCH /quotes/:id, named after this page's own
 * route (the rows are `Lead`s). Rules in services/enquiryState.ts.
 */
resourceRequestsRouter.patch(
  "/resource-requests/:id",
  stateRoute({
    find: (id) => prisma.lead.findUnique({ where: { id }, select: stateSelect }),
    update: (id, data) => prisma.lead.update({ where: { id }, data, select: stateSelect }),
  }),
);

/** POST /api/resource-requests/mark-read  { ids } — "Mark all as read". */
resourceRequestsRouter.post(
  "/resource-requests/mark-read",
  markReadRoute({
    markRead: (ids, data) => prisma.lead.updateMany({ where: { id: { in: ids }, readAt: null }, data }),
    states: (ids) => prisma.lead.findMany({ where: { id: { in: ids } }, select: stateSelect }),
  }),
);

/** POST /api/resource-requests/:id/notes { body } and DELETE …/notes/:noteId (author only). */
const leadNotes = {
  exists: async (id: string) => (await prisma.lead.count({ where: { id } })) > 0,
  create: (id: string, body: string, createdBy: string | null) =>
    prisma.enquiryNote.create({ data: { leadId: id, body, createdBy }, select: noteSelect }),
  find: (id: string, noteId: string) =>
    prisma.enquiryNote.findFirst({ where: { id: noteId, leadId: id }, select: { createdBy: true } }),
  remove: (noteId: string) => prisma.enquiryNote.delete({ where: { id: noteId } }),
};
resourceRequestsRouter.post("/resource-requests/:id/notes", addNoteRoute(leadNotes));
resourceRequestsRouter.delete("/resource-requests/:id/notes/:noteId", deleteNoteRoute(leadNotes));

/**
 * DELETE /api/resource-requests/:id?confirm=true — permanent, consent record
 * and the team's notes included (cascade): for someone who asks for their data
 * to be removed.
 */
resourceRequestsRouter.delete(
  "/resource-requests/:id",
  deleteRoute("resource request", (id) => prisma.lead.delete({ where: { id } })),
);

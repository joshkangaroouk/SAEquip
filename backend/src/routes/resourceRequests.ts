import { Router } from "express";
import { prisma } from "../prisma.js";

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
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
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
        createdAt: l.createdAt,
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

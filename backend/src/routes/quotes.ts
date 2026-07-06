import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { isEmailConfigured } from "../services/email.js";

export const quotesRouter = Router();

const quoteInclude = { items: true } as const;

type QuoteWithItems = Prisma.QuoteRequestGetPayload<{ include: typeof quoteInclude }>;

function shapeQuote(q: QuoteWithItems) {
  return {
    id: q.id,
    name: q.name,
    email: q.email,
    company: q.company,
    phone: q.phone,
    message: q.message,
    createdAt: q.createdAt,
    emailSent: q.emailSent,
    items: q.items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      options: item.options,
      price: item.price,
      quantity: item.quantity,
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
    res.json({ emailEnabled: isEmailConfigured(), requests: requests.map(shapeQuote) });
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
    res.json(shapeQuote(quote));
  } catch (err) {
    next(err);
  }
});

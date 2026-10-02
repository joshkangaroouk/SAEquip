import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { isEmailConfigured } from "../services/email.js";
import { quoteProductMatcher, type MatchedProduct } from "../services/quoteProducts.js";

export const quotesRouter = Router();

const quoteInclude = { items: true } as const;

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
    createdAt: q.createdAt,
    emailSent: q.emailSent,
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

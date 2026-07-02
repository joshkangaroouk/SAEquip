import { PrismaClient } from "@prisma/client";

/** Shared Prisma client. Connects lazily on first query. */
export const prisma = new PrismaClient();

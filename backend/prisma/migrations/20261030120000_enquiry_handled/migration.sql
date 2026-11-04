-- Enquiry handled state (redesign batch 6): who marked a quote request or a
-- resource request handled, and when. Both null = new.
--
-- Additive only. Each column is nullable with NO default, so adding it is a
-- catalogue change and no existing row is rewritten. Written by hand; apply
-- with `prisma migrate deploy` following docs/redesign/06b-migration-runbook.md
-- (back up first).

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN "handledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN "handledBy" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "handledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "handledBy" TEXT;

-- Enquiry read state, stars and notes (2026-11). Replaces the batch 6 "Mark as
-- handled" with email-style read/unread: opening a quote request or a resource
-- request marks it read for the whole team. Also a team star and staff notes.
--
-- Additive only. Every column is nullable with NO default, so adding it is a
-- catalogue change and no row is rewritten by the ALTERs. Written by hand;
-- apply with `prisma migrate deploy` following
-- docs/redesign/06b-migration-runbook.md (back up first), BEFORE the code that
-- reads these columns is deployed. The code live before it ignores them.
--
-- handledAt / handledBy are NOT dropped here: the code live while this is
-- applied still reads them. A later migration drops them once nothing does.

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "QuoteRequest" ADD COLUMN "readBy" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "starredAt" TIMESTAMP(3);
ALTER TABLE "QuoteRequest" ADD COLUMN "starredBy" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "notes" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "notesUpdatedAt" TIMESTAMP(3);
ALTER TABLE "QuoteRequest" ADD COLUMN "notesUpdatedBy" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "readBy" TEXT;
ALTER TABLE "Lead" ADD COLUMN "starredAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "starredBy" TEXT;
ALTER TABLE "Lead" ADD COLUMN "notes" TEXT;
ALTER TABLE "Lead" ADD COLUMN "notesUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "notesUpdatedBy" TEXT;

-- Backfill: anything already marked handled has been dealt with, so it starts
-- read, attributed to whoever handled it. Everything else starts unread, which
-- is what the sidebar badge already counted ("new"), so the count is unchanged.
UPDATE "QuoteRequest" SET "readAt" = "handledAt", "readBy" = "handledBy" WHERE "handledAt" IS NOT NULL;
UPDATE "Lead" SET "readAt" = "handledAt", "readBy" = "handledBy" WHERE "handledAt" IS NOT NULL;

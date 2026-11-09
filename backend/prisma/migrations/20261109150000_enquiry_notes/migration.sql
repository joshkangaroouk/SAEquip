-- Enquiry notes as a message board (2026-11): many notes per quote request or
-- resource request, each with who wrote it and when. Replaces the single notes
-- box from 20261109120000_enquiry_read_star_notes.
--
-- Additive only: a new table, then a copy of any text in the old single notes
-- column. The old columns (notes, notesUpdatedAt, notesUpdatedBy) are NOT
-- dropped, because the code live while this is applied still reads them.
-- Written by hand from `migrate diff --from-schema-datasource` (read-only);
-- apply with `prisma migrate deploy` (docs/redesign/14-enquiry-notes-runbook.md)
-- BEFORE the code that reads the table is deployed.

-- CreateTable
CREATE TABLE "EnquiryNote" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT,
    "leadId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "EnquiryNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnquiryNote_quoteRequestId_createdAt_idx" ON "EnquiryNote"("quoteRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "EnquiryNote_leadId_createdAt_idx" ON "EnquiryNote"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A note belongs to exactly one request. Prisma cannot express this, so it
-- lives only here (like Download's kind/certScheme CHECK).
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_one_parent" CHECK (("quoteRequestId" IS NULL) <> ("leadId" IS NULL));

-- Carry over anything typed in the single notes box as the first note, with
-- its author and time. Ids are deterministic so the copy is easy to find.
INSERT INTO "EnquiryNote" ("id", "quoteRequestId", "body", "createdAt", "createdBy")
SELECT 'migrated-q-' || "id", "id", "notes", COALESCE("notesUpdatedAt", CURRENT_TIMESTAMP), "notesUpdatedBy"
FROM "QuoteRequest" WHERE "notes" IS NOT NULL AND btrim("notes") <> '';

INSERT INTO "EnquiryNote" ("id", "leadId", "body", "createdAt", "createdBy")
SELECT 'migrated-l-' || "id", "id", "notes", COALESCE("notesUpdatedAt", CURRENT_TIMESTAMP), "notesUpdatedBy"
FROM "Lead" WHERE "notes" IS NOT NULL AND btrim("notes") <> '';

-- Leads must OUTLIVE the download/product they came from: deleting a product
-- previously cascaded HubProduct -> Download -> Lead and destroyed captured
-- business data. Make the FK nullable + SetNull, and snapshot the product /
-- download identity onto the row so it stays self-describing afterwards.

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_downloadId_fkey";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "downloadTitle" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "productSku" TEXT,
ALTER COLUMN "downloadId" DROP NOT NULL;

-- Backfill the snapshot for leads captured before these columns existed, so
-- historical rows aren't left blank once their product is deleted.
UPDATE "Lead" AS l
SET "downloadTitle" = d."title",
    "productName"   = hp."name",
    "productSku"    = hp."sku"
FROM "Download" AS d
JOIN "HubProduct" AS hp ON hp."id" = d."hubProductId"
WHERE l."downloadId" = d."id";

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "Download"("id") ON DELETE SET NULL ON UPDATE CASCADE;

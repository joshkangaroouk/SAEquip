-- AlterTable
ALTER TABLE "CompatibleLink" DROP COLUMN "relatedSku",
ADD COLUMN     "relatedHubProductId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "CompatibleLink_hubProductId_idx" ON "CompatibleLink"("hubProductId");

-- CreateIndex
CREATE INDEX "CompatibleLink_relatedHubProductId_idx" ON "CompatibleLink"("relatedHubProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CompatibleLink_hubProductId_relatedHubProductId_key" ON "CompatibleLink"("hubProductId", "relatedHubProductId");

-- AddForeignKey
ALTER TABLE "CompatibleLink" ADD CONSTRAINT "CompatibleLink_hubProductId_fkey" FOREIGN KEY ("hubProductId") REFERENCES "HubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibleLink" ADD CONSTRAINT "CompatibleLink_relatedHubProductId_fkey" FOREIGN KEY ("relatedHubProductId") REFERENCES "HubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;


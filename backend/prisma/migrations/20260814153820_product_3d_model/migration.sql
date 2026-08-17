-- AlterTable
ALTER TABLE "HubProduct" ADD COLUMN     "glbAssetId" TEXT;

-- AddForeignKey
ALTER TABLE "HubProduct" ADD CONSTRAINT "HubProduct_glbAssetId_fkey" FOREIGN KEY ("glbAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

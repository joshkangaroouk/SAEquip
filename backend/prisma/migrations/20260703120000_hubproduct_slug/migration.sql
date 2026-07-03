-- AlterTable
ALTER TABLE "HubProduct" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HubProduct_slug_key" ON "HubProduct"("slug");

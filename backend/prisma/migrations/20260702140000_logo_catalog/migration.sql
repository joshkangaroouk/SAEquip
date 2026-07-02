-- DropForeignKey
ALTER TABLE "ProductLogo" DROP CONSTRAINT "ProductLogo_mediaAssetId_fkey";

-- AlterTable
ALTER TABLE "ProductLogo" DROP COLUMN "alt",
DROP COLUMN "kind",
DROP COLUMN "mediaAssetId",
DROP COLUMN "sortOrder",
ADD COLUMN     "logoId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Logo" (
    "id" TEXT NOT NULL,
    "kind" "LogoKind" NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "label" TEXT,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Logo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductLogo_hubProductId_logoId_key" ON "ProductLogo"("hubProductId", "logoId");

-- AddForeignKey
ALTER TABLE "Logo" ADD CONSTRAINT "Logo_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLogo" ADD CONSTRAINT "ProductLogo_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "Logo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

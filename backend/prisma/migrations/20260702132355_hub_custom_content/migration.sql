/*
  Warnings:

  - You are about to drop the column `productSku` on the `CompatibleLink` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `Download` table. All the data in the column will be lost.
  - You are about to drop the column `productSku` on the `Download` table. All the data in the column will be lost.
  - You are about to drop the `CustomFieldMap` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `hubProductId` to the `CompatibleLink` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hubProductId` to the `Download` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mediaAssetId` to the `Download` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LogoKind" AS ENUM ('SA_LOGO', 'CERT_LOGO');

-- CreateEnum
CREATE TYPE "TextItemKind" AS ENUM ('BENEFIT', 'APPLICATION');

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_downloadId_fkey";

-- AlterTable
ALTER TABLE "CompatibleLink" DROP COLUMN "productSku",
ADD COLUMN     "hubProductId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Download" DROP COLUMN "fileUrl",
DROP COLUMN "productSku",
ADD COLUMN     "hubProductId" TEXT NOT NULL,
ADD COLUMN     "mediaAssetId" TEXT NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "CustomFieldMap";

-- CreateTable
CREATE TABLE "HubProduct" (
    "id" TEXT NOT NULL,
    "dudaProductId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "alt" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLogo" (
    "id" TEXT NOT NULL,
    "hubProductId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "kind" "LogoKind" NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductLogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecRow" (
    "id" TEXT NOT NULL,
    "hubProductId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpecRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTextItem" (
    "id" TEXT NOT NULL,
    "hubProductId" TEXT NOT NULL,
    "kind" "TextItemKind" NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductTextItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HubProduct_dudaProductId_key" ON "HubProduct"("dudaProductId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storagePath_key" ON "MediaAsset"("storagePath");

-- AddForeignKey
ALTER TABLE "ProductLogo" ADD CONSTRAINT "ProductLogo_hubProductId_fkey" FOREIGN KEY ("hubProductId") REFERENCES "HubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLogo" ADD CONSTRAINT "ProductLogo_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecRow" ADD CONSTRAINT "SpecRow_hubProductId_fkey" FOREIGN KEY ("hubProductId") REFERENCES "HubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTextItem" ADD CONSTRAINT "ProductTextItem_hubProductId_fkey" FOREIGN KEY ("hubProductId") REFERENCES "HubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_hubProductId_fkey" FOREIGN KEY ("hubProductId") REFERENCES "HubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "Download"("id") ON DELETE CASCADE ON UPDATE CASCADE;

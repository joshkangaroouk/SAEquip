-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "hubProductId" TEXT NOT NULL,
    "dudaCategoryId" TEXT NOT NULL,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ProductTag" (
    "id" TEXT NOT NULL,
    "hubProductId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ProductCategory_dudaCategoryId_idx" ON "ProductCategory"("dudaCategoryId");
-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_hubProductId_dudaCategoryId_key" ON "ProductCategory"("hubProductId", "dudaCategoryId");
-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");
-- CreateIndex
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
-- CreateIndex
CREATE UNIQUE INDEX "ProductTag_hubProductId_tagId_key" ON "ProductTag"("hubProductId", "tagId");
-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_hubProductId_fkey" FOREIGN KEY ("hubProductId") REFERENCES "HubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_hubProductId_fkey" FOREIGN KEY ("hubProductId") REFERENCES "HubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

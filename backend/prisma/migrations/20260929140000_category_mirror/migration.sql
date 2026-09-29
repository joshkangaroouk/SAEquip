-- CreateTable
CREATE TABLE "CategoryMirror" (
    "dudaCategoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryMirror_pkey" PRIMARY KEY ("dudaCategoryId")
);

-- CreateIndex
CREATE INDEX "CategoryMirror_parentId_idx" ON "CategoryMirror"("parentId");


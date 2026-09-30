-- CreateTable
CREATE TABLE "CategoryOrder" (
    "dudaCategoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryOrder_pkey" PRIMARY KEY ("dudaCategoryId")
);


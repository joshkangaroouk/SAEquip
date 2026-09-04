-- CreateTable
CREATE TABLE "DudaEditorAccount" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "staffEmail" TEXT NOT NULL,
    "dudaAccountName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DudaEditorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DudaEditorSiteAccess" (
    "id" TEXT NOT NULL,
    "dudaEditorAccountId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "grantedPermissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DudaEditorSiteAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DudaSsoAudit" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "staffEmail" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "dudaAccountName" TEXT,
    "outcome" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DudaSsoAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DudaEditorAccount_staffUserId_key" ON "DudaEditorAccount"("staffUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DudaEditorAccount_dudaAccountName_key" ON "DudaEditorAccount"("dudaAccountName");

-- CreateIndex
CREATE UNIQUE INDEX "DudaEditorSiteAccess_dudaEditorAccountId_siteName_key" ON "DudaEditorSiteAccess"("dudaEditorAccountId", "siteName");

-- AddForeignKey
ALTER TABLE "DudaEditorSiteAccess" ADD CONSTRAINT "DudaEditorSiteAccess_dudaEditorAccountId_fkey" FOREIGN KEY ("dudaEditorAccountId") REFERENCES "DudaEditorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

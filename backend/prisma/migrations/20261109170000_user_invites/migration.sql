-- User invites (2026-11): the super admin invites someone by email and gets a
-- 5-hour, single-use link; plus who granted each Website Editor (Duda SSO)
-- access, now that the dashboard can grant it.
--
-- Additive only: a new table and one nullable column. Written by hand from
-- `migrate diff --from-schema-datasource` (read-only); apply with
-- `prisma migrate deploy` (docs/redesign/15-user-invites-runbook.md) BEFORE
-- the code that reads them is deployed. The code live before it ignores both.

-- AlterTable
ALTER TABLE "DudaEditorSiteAccess" ADD COLUMN     "grantedBy" TEXT;

-- CreateTable
CREATE TABLE "UserInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "grantWebsiteEditor" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "acceptedUserId" TEXT,
    "editorGrantError" TEXT,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_tokenHash_key" ON "UserInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInvite_email_idx" ON "UserInvite"("email");

-- CreateIndex
CREATE INDEX "UserInvite_createdAt_idx" ON "UserInvite"("createdAt");


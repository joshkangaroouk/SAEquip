-- CreateEnum
CREATE TYPE "TranslationKind" AS ENUM ('DESCRIPTION', 'SPEC_LABEL', 'SPEC_VALUE', 'LIST_ITEM', 'LOGO_TEXT');

-- CreateEnum
CREATE TYPE "TranslationOrigin" AS ENUM ('MT', 'STAFF');

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "kind" "TranslationKind" NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "text" TEXT,
    "origin" "TranslationOrigin" NOT NULL,
    "engine" TEXT,
    "lastError" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DudaTranslation" (
    "locale" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "dudaId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DudaTranslation_pkey" PRIMARY KEY ("locale","entity","dudaId")
);

-- CreateIndex
CREATE INDEX "Translation_locale_origin_idx" ON "Translation"("locale", "origin");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_locale_kind_sourceHash_key" ON "Translation"("locale", "kind", "sourceHash");


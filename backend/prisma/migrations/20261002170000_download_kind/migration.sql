-- CreateEnum
CREATE TYPE "DownloadKind" AS ENUM ('DATASHEET', 'MANUAL', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "CertScheme" AS ENUM ('INMETRO', 'UKEX', 'IECEX', 'EX', 'COMPLIANCE');

-- AlterTable
ALTER TABLE "Download" ADD COLUMN     "certScheme" "CertScheme",
ADD COLUMN     "kind" "DownloadKind";


-- A certificate scheme if and only if the download is a CERTIFICATE.
-- COALESCE makes both sides plain booleans: a bare `"kind" = 'CERTIFICATE'` is
-- NULL for an untyped row, and a CHECK that evaluates to NULL PASSES — which
-- would let an untyped download carry a scheme.
ALTER TABLE "Download" ADD CONSTRAINT "Download_certScheme_iff_certificate"
  CHECK ((COALESCE("kind"::text, '') = 'CERTIFICATE') = ("certScheme" IS NOT NULL));

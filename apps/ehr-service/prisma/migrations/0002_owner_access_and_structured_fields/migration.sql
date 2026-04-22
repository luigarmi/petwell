-- AlterTable
ALTER TABLE "EhrRecord"
ADD COLUMN "reasonForVisitEncrypted" TEXT,
ADD COLUMN "anamnesisEncrypted" TEXT,
ADD COLUMN "physicalExamEncrypted" TEXT,
ADD COLUMN "treatmentsEncrypted" TEXT,
ADD COLUMN "imagingReportsEncrypted" TEXT;

-- AlterTable
ALTER TABLE "ClinicConsent"
ADD COLUMN "purpose" TEXT,
ADD COLUMN "scopeSummary" TEXT,
ADD COLUMN "ownerApprovedByUserId" TEXT,
ADD COLUMN "ownerApprovedAt" TIMESTAMP(3);

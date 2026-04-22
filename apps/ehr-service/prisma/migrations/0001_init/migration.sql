-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "EhrRecord" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "veterinarianId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "consultationEncrypted" TEXT NOT NULL,
    "diagnosisEncrypted" TEXT NOT NULL,
    "vaccinesEncrypted" TEXT NOT NULL,
    "prescriptionsEncrypted" TEXT NOT NULL,
    "labResultsEncrypted" TEXT NOT NULL,
    "clinicalNotesEncrypted" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EhrRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicConsent" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "sourceClinicId" TEXT NOT NULL,
    "targetClinicId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessAudit" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorClinicId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EhrRecord_petId_clinicId_idx" ON "EhrRecord"("petId", "clinicId");

-- CreateIndex
CREATE INDEX "EhrRecord_appointmentId_idx" ON "EhrRecord"("appointmentId");

-- CreateIndex
CREATE INDEX "EhrRecord_deletedAt_idx" ON "EhrRecord"("deletedAt");

-- CreateIndex
CREATE INDEX "ClinicConsent_petId_revokedAt_idx" ON "ClinicConsent"("petId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicConsent_petId_sourceClinicId_targetClinicId_key" ON "ClinicConsent"("petId", "sourceClinicId", "targetClinicId");

-- CreateIndex
CREATE INDEX "AccessAudit_petId_createdAt_idx" ON "AccessAudit"("petId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessAudit_recordId_idx" ON "AccessAudit"("recordId");

-- AddForeignKey
ALTER TABLE "AccessAudit" ADD CONSTRAINT "AccessAudit_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "EhrRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


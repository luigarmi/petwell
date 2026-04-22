-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "TelemedRoom" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "veterinarianId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "roomUrl" TEXT NOT NULL,
    "joinToken" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemedRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelemedRoom_appointmentId_key" ON "TelemedRoom"("appointmentId");

-- CreateIndex
CREATE INDEX "TelemedRoom_clinicId_startsAt_idx" ON "TelemedRoom"("clinicId", "startsAt");


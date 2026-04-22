-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "veterinarianId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBlock_clinicId_startsAt_endsAt_idx" ON "ScheduleBlock"("clinicId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ScheduleBlock_veterinarianId_startsAt_endsAt_idx" ON "ScheduleBlock"("veterinarianId", "startsAt", "endsAt");

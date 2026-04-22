-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('dog', 'cat', 'bird', 'rabbit', 'other');

-- CreateEnum
CREATE TYPE "PetSex" AS ENUM ('male', 'female', 'unknown');

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "PetSpecies" NOT NULL,
    "breed" TEXT NOT NULL,
    "sex" "PetSex" NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "microchip" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "isSpayedNeutered" BOOLEAN NOT NULL DEFAULT false,
    "mainClinicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pet_ownerId_idx" ON "Pet"("ownerId");

-- CreateIndex
CREATE INDEX "Pet_mainClinicId_idx" ON "Pet"("mainClinicId");

-- CreateIndex
CREATE INDEX "Pet_species_idx" ON "Pet"("species");

-- CreateIndex
CREATE INDEX "Pet_deletedAt_idx" ON "Pet"("deletedAt");


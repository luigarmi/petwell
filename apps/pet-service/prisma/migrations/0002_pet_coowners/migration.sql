-- AlterTable
ALTER TABLE "Pet"
ADD COLUMN "coOwnerIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

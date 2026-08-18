-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TECHNICIEN');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Seed a default organization and attach every pre-existing User/Chantier/
-- TermValue row to it, so this migration adds multi-tenancy without losing
-- or orphaning any existing data.
INSERT INTO "Organization" ("id", "name", "createdAt")
VALUES ('org_default_seed', 'Mon entreprise', CURRENT_TIMESTAMP);

-- AlterTable: User (nullable organizationId first, backfilled below, then required)
ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "organizationId" TEXT;

UPDATE "User" SET "organizationId" = 'org_default_seed' WHERE "organizationId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable: Chantier
ALTER TABLE "Chantier" ADD COLUMN "organizationId" TEXT;

UPDATE "Chantier" SET "organizationId" = 'org_default_seed' WHERE "organizationId" IS NULL;

ALTER TABLE "Chantier" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable: TermValue (drop old global unique constraint, add org-scoped one)
DROP INDEX "TermValue_field_idx";
DROP INDEX "TermValue_field_value_key";

ALTER TABLE "TermValue" ADD COLUMN "organizationId" TEXT;

UPDATE "TermValue" SET "organizationId" = 'org_default_seed' WHERE "organizationId" IS NULL;

ALTER TABLE "TermValue" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "ChantierAssignment" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChantierAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChantierAssignment_chantierId_userId_key" ON "ChantierAssignment"("chantierId", "userId");

-- CreateIndex
CREATE INDEX "TermValue_organizationId_field_idx" ON "TermValue"("organizationId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "TermValue_organizationId_field_value_key" ON "TermValue"("organizationId", "field", "value");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chantier" ADD CONSTRAINT "Chantier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantierAssignment" ADD CONSTRAINT "ChantierAssignment_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantierAssignment" ADD CONSTRAINT "ChantierAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermValue" ADD CONSTRAINT "TermValue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

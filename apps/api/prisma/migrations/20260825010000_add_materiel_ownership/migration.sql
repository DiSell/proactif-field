-- Materiel gets org scoping (mirrors Blocage/ActivityLog) and an
-- accountability trail. The table has never been reachable through the API
-- until this migration, so it is expected to be empty in every environment;
-- the backfill below is defensive only and a no-op against an empty table.
ALTER TABLE "Materiel" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Materiel" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Materiel" ADD COLUMN "updatedById" TEXT;

UPDATE "Materiel" m
SET "organizationId" = c."organizationId"
FROM "Chantier" c
WHERE m."chantierId" = c."id";

ALTER TABLE "Materiel" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Materiel" ALTER COLUMN "createdById" SET NOT NULL;

ALTER TABLE "Materiel" ADD CONSTRAINT "Materiel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Materiel" ADD CONSTRAINT "Materiel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Materiel" ADD CONSTRAINT "Materiel_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Materiel_chantierId_idx" ON "Materiel"("chantierId");
CREATE INDEX "Materiel_organizationId_idx" ON "Materiel"("organizationId");

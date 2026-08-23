CREATE TYPE "BlocagePriorite" AS ENUM ('FAIBLE', 'NORMALE', 'HAUTE');

ALTER TABLE "Blocage" RENAME COLUMN "authorId" TO "createdById";
ALTER TABLE "Blocage" RENAME CONSTRAINT "Blocage_authorId_fkey" TO "Blocage_createdById_fkey";
ALTER TABLE "Blocage" RENAME COLUMN "categorie" TO "titre";
ALTER TABLE "Blocage" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Blocage" ADD COLUMN "chantierId" TEXT;
ALTER TABLE "Blocage" ADD COLUMN "priorite" "BlocagePriorite" NOT NULL DEFAULT 'NORMALE';
ALTER TABLE "Blocage" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Blocage" ADD COLUMN "resolvedById" TEXT;

UPDATE "Blocage" b
SET "chantierId" = p."chantierId", "organizationId" = c."organizationId"
FROM "Plan" p
JOIN "Chantier" c ON c."id" = p."chantierId"
JOIN "Point" pt ON pt."planId" = p."id"
WHERE b."pointId" = pt."id";

UPDATE "Blocage" SET "titre" = 'Blocage' WHERE "titre" IS NULL OR BTRIM("titre") = '';
UPDATE "Blocage" SET "description" = COALESCE("commentaire", '') WHERE "description" IS NULL;

ALTER TABLE "Blocage" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Blocage" ALTER COLUMN "chantierId" SET NOT NULL;
ALTER TABLE "Blocage" ALTER COLUMN "titre" SET NOT NULL;
ALTER TABLE "Blocage" ALTER COLUMN "description" SET NOT NULL;
ALTER TABLE "Blocage" DROP COLUMN "commentaire";

ALTER TABLE "Blocage" ADD CONSTRAINT "Blocage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Blocage" ADD CONSTRAINT "Blocage_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Blocage" ADD CONSTRAINT "Blocage_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Blocage_organizationId_statut_idx" ON "Blocage"("organizationId", "statut");
CREATE INDEX "Blocage_chantierId_statut_idx" ON "Blocage"("chantierId", "statut");
CREATE INDEX "Blocage_pointId_statut_idx" ON "Blocage"("pointId", "statut");

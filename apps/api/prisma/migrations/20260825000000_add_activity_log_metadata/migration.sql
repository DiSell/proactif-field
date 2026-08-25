ALTER TABLE "ActivityLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "metadata" JSONB;

UPDATE "ActivityLog" a
SET "organizationId" = c."organizationId"
FROM "Chantier" c
WHERE a."chantierId" = c."id";

ALTER TABLE "ActivityLog" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ActivityLog_organizationId_createdAt_idx" ON "ActivityLog"("organizationId", "createdAt");

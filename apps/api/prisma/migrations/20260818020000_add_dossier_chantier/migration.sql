-- CreateEnum
CREATE TYPE "ChantierStatut" AS ENUM ('PREPARATION', 'PRET', 'EN_COURS', 'BLOQUE', 'TERMINE', 'CLOTURE');

-- CreateEnum
CREATE TYPE "BlocageStatut" AS ENUM ('OUVERT', 'RESOLU');

-- AlterTable: Chantier — new dossier fields (all safe with defaults/nullable
-- except `reference`, added nullable and backfilled below before being
-- made required).
ALTER TABLE "Chantier"
  ADD COLUMN "client" TEXT,
  ADD COLUMN "dateDebutPrevue" TIMESTAMP(3),
  ADD COLUMN "dateFinPrevue" TIMESTAMP(3),
  ADD COLUMN "entrepriseExecutante" TEXT,
  ADD COLUMN "responsableId" TEXT,
  ADD COLUMN "statut" "ChantierStatut" NOT NULL DEFAULT 'PREPARATION',
  ADD COLUMN "reference" TEXT;

-- Backfill: generate a per-organization sequential reference (CH-0001,
-- CH-0002, ...) for every pre-existing chantier, ordered by creation date.
UPDATE "Chantier" c
SET "reference" = 'CH-' || LPAD(sub.rn::text, 4, '0')
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt") AS rn
  FROM "Chantier"
) sub
WHERE c."id" = sub."id";

ALTER TABLE "Chantier" ALTER COLUMN "reference" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Chantier_organizationId_reference_key" ON "Chantier"("organizationId", "reference");

-- AddForeignKey
ALTER TABLE "Chantier" ADD CONSTRAINT "Chantier_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Plan — new optional metadata fields, no backfill needed.
ALTER TABLE "Plan"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "statut" TEXT,
  ADD COLUMN "version" TEXT;

-- AlterTable: Photo — optional link to a Blocage, no backfill needed.
ALTER TABLE "Photo" ADD COLUMN "blocageId" TEXT;

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "date" TIMESTAMP(3),
    "author" TEXT,
    "commentaire" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materiel" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "reference" TEXT,
    "quantitePrevue" DOUBLE PRECISION,
    "quantiteUtilisee" DOUBLE PRECISION,
    "unite" TEXT,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Materiel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blocage" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "categorie" TEXT,
    "description" TEXT,
    "commentaire" TEXT,
    "statut" "BlocageStatut" NOT NULL DEFAULT 'OUVERT',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blocage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_chantierId_createdAt_idx" ON "ActivityLog"("chantierId", "createdAt");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_blocageId_fkey" FOREIGN KEY ("blocageId") REFERENCES "Blocage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Materiel" ADD CONSTRAINT "Materiel_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocage" ADD CONSTRAINT "Blocage_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocage" ADD CONSTRAINT "Blocage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

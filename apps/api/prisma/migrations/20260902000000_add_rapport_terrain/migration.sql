-- CreateTable
CREATE TABLE "RapportTerrain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "typeTravaux" TEXT,
    "observation" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsAccuracy" DOUBLE PRECISION,
    "lieu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RapportTerrain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportTerrainItem" (
    "id" TEXT NOT NULL,
    "rapportTerrainId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "titre" TEXT,
    "commentaire" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsAccuracy" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RapportTerrainItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportTerrainPhoto" (
    "id" TEXT NOT NULL,
    "rapportTerrainItemId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "gpsAccuracy" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapportTerrainPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportTerrainPdf" (
    "id" TEXT NOT NULL,
    "rapportTerrainId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapportTerrainPdf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportTerrainActivityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rapportTerrainId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapportTerrainActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RapportTerrain_organizationId_createdAt_idx" ON "RapportTerrain"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "RapportTerrain_createdById_createdAt_idx" ON "RapportTerrain"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "RapportTerrainItem_rapportTerrainId_createdAt_idx" ON "RapportTerrainItem"("rapportTerrainId", "createdAt");

-- CreateIndex
CREATE INDEX "RapportTerrainPhoto_rapportTerrainItemId_idx" ON "RapportTerrainPhoto"("rapportTerrainItemId");

-- CreateIndex
CREATE INDEX "RapportTerrainActivityLog_rapportTerrainId_createdAt_idx" ON "RapportTerrainActivityLog"("rapportTerrainId", "createdAt");

-- CreateIndex
CREATE INDEX "RapportTerrainActivityLog_organizationId_createdAt_idx" ON "RapportTerrainActivityLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "RapportTerrain" ADD CONSTRAINT "RapportTerrain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrain" ADD CONSTRAINT "RapportTerrain_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainItem" ADD CONSTRAINT "RapportTerrainItem_rapportTerrainId_fkey" FOREIGN KEY ("rapportTerrainId") REFERENCES "RapportTerrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainItem" ADD CONSTRAINT "RapportTerrainItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainItem" ADD CONSTRAINT "RapportTerrainItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainPhoto" ADD CONSTRAINT "RapportTerrainPhoto_rapportTerrainItemId_fkey" FOREIGN KEY ("rapportTerrainItemId") REFERENCES "RapportTerrainItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainPdf" ADD CONSTRAINT "RapportTerrainPdf_rapportTerrainId_fkey" FOREIGN KEY ("rapportTerrainId") REFERENCES "RapportTerrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainPdf" ADD CONSTRAINT "RapportTerrainPdf_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainActivityLog" ADD CONSTRAINT "RapportTerrainActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainActivityLog" ADD CONSTRAINT "RapportTerrainActivityLog_rapportTerrainId_fkey" FOREIGN KEY ("rapportTerrainId") REFERENCES "RapportTerrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportTerrainActivityLog" ADD CONSTRAINT "RapportTerrainActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

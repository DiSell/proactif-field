-- CreateTable
CREATE TABLE "TermValue" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermValue_field_idx" ON "TermValue"("field");

-- CreateIndex
CREATE UNIQUE INDEX "TermValue_field_value_key" ON "TermValue"("field", "value");

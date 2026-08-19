-- AlterTable
ALTER TABLE "ChantierAssignment" ADD COLUMN "seenAt" TIMESTAMP(3);

-- Backfill: treat every pre-existing assignment as already seen (at the
-- time it was created), so this feature only flags genuinely new
-- assignments going forward rather than surfacing old ones as "new".
UPDATE "ChantierAssignment" SET "seenAt" = "createdAt" WHERE "seenAt" IS NULL;

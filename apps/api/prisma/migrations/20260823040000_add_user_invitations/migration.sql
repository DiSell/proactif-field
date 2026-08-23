ALTER TABLE "User" ADD COLUMN "inviteTokenHash" TEXT,
ADD COLUMN "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN "invitedAt" TIMESTAMP(3),
ADD COLUMN "invitationAcceptedAt" TIMESTAMP(3);
UPDATE "User" SET "invitationAcceptedAt" = "createdAt";
CREATE UNIQUE INDEX "User_inviteTokenHash_key" ON "User"("inviteTokenHash");

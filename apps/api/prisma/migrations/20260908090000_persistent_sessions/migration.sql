-- NULL means no automatic expiry. Epoch expiresAt revokes a session.
ALTER TABLE "Session" ALTER COLUMN "expiresAt" DROP NOT NULL;
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

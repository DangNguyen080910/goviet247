CREATE TABLE "NotificationJob" (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  "acceptedTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "runAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "completedAt" TIMESTAMPTZ(6),
  "lockedUntil" TIMESTAMPTZ(6),
  "lockToken" TEXT,
  "lastError" TEXT
);
CREATE INDEX "NotificationJob_completedAt_runAt_idx" ON "NotificationJob"("completedAt","runAt");
CREATE INDEX "NotificationJob_createdAt_idx" ON "NotificationJob"("createdAt");

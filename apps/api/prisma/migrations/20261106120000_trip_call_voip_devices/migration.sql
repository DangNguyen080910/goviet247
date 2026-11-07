-- CreateTable
CREATE TABLE "TripCallDevice" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "appKind" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "pushSessionId" TEXT NOT NULL,
    "pushExpiresAt" TIMESTAMPTZ(6),
    "generation" TEXT NOT NULL,
    "lastRegisteredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripCallDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripCallInvite" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "generation" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attemptAt" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "lastError" TEXT,

    CONSTRAINT "TripCallInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripCallDevice_userId_idx" ON "TripCallDevice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TripCallDevice_installationId_appKind_key" ON "TripCallDevice"("installationId", "appKind");

-- CreateIndex
CREATE UNIQUE INDEX "TripCallDevice_token_appKind_environment_key" ON "TripCallDevice"("token", "appKind", "environment");

-- CreateIndex
CREATE INDEX "TripCallInvite_callId_idx" ON "TripCallInvite"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "TripCallInvite_callId_deviceId_generation_key" ON "TripCallInvite"("callId", "deviceId", "generation");

-- AddForeignKey
ALTER TABLE "TripCallDevice" ADD CONSTRAINT "TripCallDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCallInvite" ADD CONSTRAINT "TripCallInvite_callId_fkey" FOREIGN KEY ("callId") REFERENCES "TripCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCallInvite" ADD CONSTRAINT "TripCallInvite_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "TripCallDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


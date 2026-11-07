-- AlterTable
ALTER TABLE "TripChatMessage" ADD COLUMN     "recordingCallId" TEXT;

-- CreateTable
CREATE TABLE "TripCall" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "calleeId" TEXT NOT NULL,
    "callerLabel" TEXT NOT NULL,
    "calleeLabel" TEXT NOT NULL,
    "callerAliases" TEXT[],
    "calleeAliases" TEXT[],
    "callerDevice" TEXT NOT NULL,
    "calleeDevice" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "callerSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calleeSeenAt" TIMESTAMPTZ(6),
    "callerJoined" BOOLEAN NOT NULL DEFAULT false,
    "calleeJoined" BOOLEAN NOT NULL DEFAULT false,
    "meeting" JSONB,
    "callerAttendee" JSONB,
    "calleeAttendee" JSONB,
    "captureId" TEXT,
    "captureArn" TEXT,
    "concatId" TEXT,
    "recordingKey" TEXT,
    "cleanupDoneAt" TIMESTAMPTZ(6),

    CONSTRAINT "TripCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripCallReservation" (
    "actorId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,

    CONSTRAINT "TripCallReservation_pkey" PRIMARY KEY ("actorId")
);

-- CreateIndex
CREATE INDEX "TripCall_status_createdAt_idx" ON "TripCall"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TripCall_endedAt_cleanupDoneAt_idx" ON "TripCall"("endedAt", "cleanupDoneAt");

-- CreateIndex
CREATE UNIQUE INDEX "TripCall_callerId_clientId_key" ON "TripCall"("callerId", "clientId");

-- CreateIndex
CREATE INDEX "TripCallReservation_callId_idx" ON "TripCallReservation"("callId");

-- AddForeignKey
ALTER TABLE "TripCall" ADD CONSTRAINT "TripCall_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCallReservation" ADD CONSTRAINT "TripCallReservation_callId_fkey" FOREIGN KEY ("callId") REFERENCES "TripCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;


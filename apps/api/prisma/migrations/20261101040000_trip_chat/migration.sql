CREATE TABLE "TripChatMessage" (
"id" TEXT PRIMARY KEY, "tripId" TEXT NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
"senderId" TEXT NOT NULL, "senderRole" TEXT NOT NULL, "senderLabel" TEXT NOT NULL, "clientId" TEXT NOT NULL,
"kind" TEXT NOT NULL, "text" TEXT, "audioKey" TEXT, "audioDeleteKey" TEXT, "deletedAt" TIMESTAMPTZ(6), "deletedBy" TEXT, "audioMime" TEXT, "durationMs" INTEGER,
"latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION, "locationLabel" TEXT,
"createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"pushAttemptAt" TIMESTAMPTZ(6), "pushDoneAt" TIMESTAMPTZ(6), "pushAttempts" INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX "TripChatMessage_tripId_senderId_clientId_key" ON "TripChatMessage"("tripId","senderId","clientId");
CREATE INDEX "TripChatMessage_tripId_createdAt_id_idx" ON "TripChatMessage"("tripId","createdAt","id");
CREATE INDEX "TripChatMessage_pushDoneAt_pushAttemptAt_idx" ON "TripChatMessage"("pushDoneAt","pushAttemptAt");
CREATE TABLE "TripChatRead" ("tripId" TEXT NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,"actorId" TEXT NOT NULL,"messageId" TEXT NOT NULL DEFAULT '',"readAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY("tripId","actorId"));
CREATE TABLE "TripChatAccess" ("id" TEXT PRIMARY KEY,"tripId" TEXT NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,"actorId" TEXT NOT NULL,"action" TEXT NOT NULL,"createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "TripChatAccess_tripId_createdAt_idx" ON "TripChatAccess"("tripId","createdAt");

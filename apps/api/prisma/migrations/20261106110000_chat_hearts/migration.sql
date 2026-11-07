CREATE TABLE "TripChatReaction" (
  "messageId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripChatReaction_pkey" PRIMARY KEY ("messageId", "actorId"),
  CONSTRAINT "TripChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TripChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

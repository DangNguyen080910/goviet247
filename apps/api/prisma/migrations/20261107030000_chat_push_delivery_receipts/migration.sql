ALTER TABLE "TripChatMessage" ADD COLUMN "pushDeliveredTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "TripChatMessage" ADD COLUMN "historyAt" TIMESTAMPTZ(6);
UPDATE "TripChatMessage" AS m SET "historyAt" = c."createdAt", "createdAt" = COALESCE(c."endedAt", m."createdAt") FROM "TripCall" AS c WHERE m."tripId" = c."tripId" AND m."senderId" = 'system-call' AND m."clientId" = 'call_' || c."id";

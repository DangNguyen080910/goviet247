-- Ordinary history stays shared. Only new acceptance notices use a private audience.
ALTER TABLE "TripChatMessage"
ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN "recipientId" TEXT;

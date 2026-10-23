CREATE TABLE "QuoteHistorySetting" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "QuoteHistorySetting_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "QuoteHistory" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  "customerKey" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "identityVerified" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "pickupAddress" TEXT,
  "stops" JSONB NOT NULL,
  "pickupTime" TIMESTAMPTZ(6) NOT NULL,
  "returnTime" TIMESTAMPTZ(6),
  "carType" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "fuelPreference" TEXT NOT NULL,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "driveMinutes" DOUBLE PRECISION,
  "finalPrice" INTEGER NOT NULL,
  "bookingTokenHash" TEXT NOT NULL,
  "tripId" TEXT,
  "bookedAt" TIMESTAMPTZ(6),
  CONSTRAINT "QuoteHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuoteHistory_bookingTokenHash_key" ON "QuoteHistory"("bookingTokenHash");
CREATE UNIQUE INDEX "QuoteHistory_tripId_key" ON "QuoteHistory"("tripId");
CREATE INDEX "QuoteHistory_createdAt_idx" ON "QuoteHistory"("createdAt");
CREATE INDEX "QuoteHistory_source_createdAt_idx" ON "QuoteHistory"("source", "createdAt");
CREATE INDEX "QuoteHistory_carType_createdAt_idx" ON "QuoteHistory"("carType", "createdAt");
INSERT INTO "QuoteHistorySetting" ("id", "enabled", "updatedAt") VALUES (1, true, CURRENT_TIMESTAMP);

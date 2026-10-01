ALTER TABLE "Trip" ADD COLUMN "audienceDriverIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Trip_audienceDriverIds_idx" ON "Trip" USING GIN ("audienceDriverIds");
ALTER TABLE "TripConfig" ADD COLUMN "returnSuggestionRadiusKm" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "returnSuggestionDays" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "TripConfig" (
    "id" SERIAL NOT NULL,
    "maxStops" INTEGER NOT NULL DEFAULT 10,
    "minDistanceKm" INTEGER NOT NULL DEFAULT 5,
    "maxDistanceKm" INTEGER NOT NULL DEFAULT 2000,
    "quoteExpireSeconds" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripConfig_pkey" PRIMARY KEY ("id")
);

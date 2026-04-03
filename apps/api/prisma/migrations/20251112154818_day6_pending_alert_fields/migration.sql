/*
  Warnings:

  - Added the required column `basePricePerKm` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `carType` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `direction` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pickupTime` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPrice` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Made the column `distanceKm` on table `Trip` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TripDirection" AS ENUM ('ONE_WAY', 'ROUND_TRIP');

-- CreateEnum
CREATE TYPE "CarType" AS ENUM ('CAR_5', 'CAR_7');

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_riderId_fkey";

-- AlterTable
ALTER TABLE "OtpSession" ADD COLUMN     "payloadJson" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'AUTH',
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "basePricePerKm" INTEGER NOT NULL,
ADD COLUMN     "carType" "CarType" NOT NULL,
ADD COLUMN     "direction" "TripDirection" NOT NULL,
ADD COLUMN     "directionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "holidayFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "pendingAlertAt" TIMESTAMP(3),
ADD COLUMN     "pendingAlertCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pendingAlertSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pickupTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "riderName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "riderPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "totalPrice" INTEGER NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "riderId" DROP NOT NULL,
ALTER COLUMN "pickupLat" DROP NOT NULL,
ALTER COLUMN "pickupLng" DROP NOT NULL,
ALTER COLUMN "dropoffLat" DROP NOT NULL,
ALTER COLUMN "dropoffLng" DROP NOT NULL,
ALTER COLUMN "distanceKm" SET NOT NULL;

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" SERIAL NOT NULL,
    "carType" "CarType" NOT NULL,
    "pricePerKm" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayConfig" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingConfig_carType_key" ON "PricingConfig"("carType");

-- CreateIndex
CREATE INDEX "idx_trip_status_createdAt" ON "Trip"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Trip_driverId_status_idx" ON "Trip"("driverId", "status");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

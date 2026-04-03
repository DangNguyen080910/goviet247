-- AlterTable
ALTER TABLE "DriverConfig" ADD COLUMN     "newTripAcceptDelaySeconds" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "driverAcceptOpenAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "DriverTripPenaltyStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterEnum
ALTER TYPE "CompanyCashTxnCategory" ADD VALUE 'DRIVER_CANCEL_PENALTY';

-- CreateTable
CREATE TABLE "DriverTripPenaltyLog" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "driverId" TEXT,
    "driverProfileId" TEXT,
    "driverNameSnapshot" TEXT,
    "driverPhoneSnapshot" TEXT,
    "tripStatusSnapshot" "TripStatus",
    "verifiedByIdSnapshot" INTEGER,
    "verifiedAtSnapshot" TIMESTAMP(3),
    "penaltyAmount" INTEGER NOT NULL,
    "status" "DriverTripPenaltyStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedByAdminId" INTEGER,

    CONSTRAINT "DriverTripPenaltyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverTripPenaltyLog_tripId_idx" ON "DriverTripPenaltyLog"("tripId");

-- CreateIndex
CREATE INDEX "DriverTripPenaltyLog_driverId_idx" ON "DriverTripPenaltyLog"("driverId");

-- CreateIndex
CREATE INDEX "DriverTripPenaltyLog_driverProfileId_idx" ON "DriverTripPenaltyLog"("driverProfileId");

-- CreateIndex
CREATE INDEX "DriverTripPenaltyLog_status_createdAt_idx" ON "DriverTripPenaltyLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DriverTripPenaltyLog_approvedByAdminId_idx" ON "DriverTripPenaltyLog"("approvedByAdminId");

-- AddForeignKey
ALTER TABLE "DriverTripPenaltyLog" ADD CONSTRAINT "DriverTripPenaltyLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

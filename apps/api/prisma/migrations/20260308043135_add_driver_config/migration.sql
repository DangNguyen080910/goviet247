-- CreateTable
CREATE TABLE "DriverConfig" (
    "id" SERIAL NOT NULL,
    "commissionPercent" INTEGER NOT NULL DEFAULT 10,
    "driverDepositAmount" INTEGER NOT NULL DEFAULT 500000,
    "maxActiveTrips" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverConfig_pkey" PRIMARY KEY ("id")
);

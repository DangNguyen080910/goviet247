-- CreateEnum
CREATE TYPE "DriverWalletTxnType" AS ENUM ('TOPUP', 'COMMISSION_HOLD', 'COMMISSION_REFUND', 'ADJUST_ADD', 'ADJUST_SUBTRACT');

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "balance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DriverWalletTransaction" (
    "id" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "type" "DriverWalletTxnType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "tripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverWalletTransaction_driverProfileId_idx" ON "DriverWalletTransaction"("driverProfileId");

-- CreateIndex
CREATE INDEX "DriverWalletTransaction_tripId_idx" ON "DriverWalletTransaction"("tripId");

-- CreateIndex
CREATE INDEX "DriverWalletTransaction_createdAt_idx" ON "DriverWalletTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "DriverWalletTransaction" ADD CONSTRAINT "DriverWalletTransaction_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverWalletTransaction" ADD CONSTRAINT "DriverWalletTransaction_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

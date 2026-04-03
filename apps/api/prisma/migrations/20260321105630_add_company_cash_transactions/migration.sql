/*
  Warnings:

  - You are about to alter the column `commissionPercent` on the `DriverConfig` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to alter the column `commissionPercentSnapshot` on the `Trip` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.

*/
-- CreateEnum
CREATE TYPE "CompanyCashTxnType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "CompanyCashTxnCategory" AS ENUM ('OWNER_CAPITAL', 'DRIVER_TOPUP', 'COMMISSION_IN', 'OTHER_IN', 'MARKETING', 'AWS', 'SERVER', 'SALARY', 'OPERATIONS', 'DRIVER_WITHDRAW', 'REFUND', 'OTHER_OUT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DriverWalletTxnType" ADD VALUE 'DRIVER_TAX_HOLD';
ALTER TYPE "DriverWalletTxnType" ADD VALUE 'DRIVER_TAX_REFUND';

-- AlterTable
ALTER TABLE "DriverConfig" ADD COLUMN     "driverPitPercent" DECIMAL(5,2) NOT NULL DEFAULT 1.50,
ADD COLUMN     "driverVatPercent" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
ALTER COLUMN "commissionPercent" SET DEFAULT 10.00,
ALTER COLUMN "commissionPercent" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "driverPitAmountSnapshot" INTEGER,
ADD COLUMN     "driverPitPercentSnapshot" DECIMAL(5,2),
ADD COLUMN     "driverTaxTotalSnapshot" INTEGER,
ADD COLUMN     "driverVatAmountSnapshot" INTEGER,
ADD COLUMN     "driverVatPercentSnapshot" DECIMAL(5,2),
ADD COLUMN     "requiredWalletAmountSnapshot" INTEGER,
ALTER COLUMN "commissionPercentSnapshot" SET DATA TYPE DECIMAL(5,2);

-- CreateTable
CREATE TABLE "CompanyCashTransaction" (
    "id" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "type" "CompanyCashTxnType" NOT NULL,
    "category" "CompanyCashTxnCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "source" TEXT,
    "referenceCode" TEXT,
    "createdByAdminId" INTEGER,
    "createdByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverContractAcceptance" (
    "id" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "contractCode" TEXT NOT NULL,
    "contractTitle" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "contractFileUrl" TEXT,
    "contractFileHash" TEXT,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "otpVerifiedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "appVersion" TEXT,
    "phoneE164" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverContractAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyCashTransaction_txnDate_idx" ON "CompanyCashTransaction"("txnDate");

-- CreateIndex
CREATE INDEX "CompanyCashTransaction_type_txnDate_idx" ON "CompanyCashTransaction"("type", "txnDate");

-- CreateIndex
CREATE INDEX "CompanyCashTransaction_category_txnDate_idx" ON "CompanyCashTransaction"("category", "txnDate");

-- CreateIndex
CREATE INDEX "CompanyCashTransaction_createdAt_idx" ON "CompanyCashTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "DriverContractAcceptance_driverProfileId_idx" ON "DriverContractAcceptance"("driverProfileId");

-- CreateIndex
CREATE INDEX "DriverContractAcceptance_contractCode_contractVersion_idx" ON "DriverContractAcceptance"("contractCode", "contractVersion");

-- CreateIndex
CREATE INDEX "DriverContractAcceptance_isActive_agreedAt_idx" ON "DriverContractAcceptance"("isActive", "agreedAt");

-- AddForeignKey
ALTER TABLE "CompanyCashTransaction" ADD CONSTRAINT "CompanyCashTransaction_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverContractAcceptance" ADD CONSTRAINT "DriverContractAcceptance_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

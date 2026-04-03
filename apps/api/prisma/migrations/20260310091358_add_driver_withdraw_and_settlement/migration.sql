-- CreateEnum
CREATE TYPE "DriverWithdrawStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DriverWalletTxnType" ADD VALUE 'WITHDRAW_REQUEST';
ALTER TYPE "DriverWalletTxnType" ADD VALUE 'WITHDRAW_REJECT_REFUND';
ALTER TYPE "DriverWalletTxnType" ADD VALUE 'WITHDRAW_PAID';

-- AlterTable
ALTER TABLE "DriverWalletTransaction" ADD COLUMN     "withdrawRequestId" TEXT;

-- CreateTable
CREATE TABLE "DriverBankAccount" (
    "id" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverWithdrawRequest" (
    "id" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "DriverWithdrawStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "approvedByAdminId" INTEGER,
    "paidByAdminId" INTEGER,
    "settlementWeek" TEXT,

    CONSTRAINT "DriverWithdrawRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverBankAccount_driverProfileId_idx" ON "DriverBankAccount"("driverProfileId");

-- CreateIndex
CREATE INDEX "DriverBankAccount_isDefault_idx" ON "DriverBankAccount"("isDefault");

-- CreateIndex
CREATE INDEX "DriverWithdrawRequest_driverProfileId_idx" ON "DriverWithdrawRequest"("driverProfileId");

-- CreateIndex
CREATE INDEX "DriverWithdrawRequest_bankAccountId_idx" ON "DriverWithdrawRequest"("bankAccountId");

-- CreateIndex
CREATE INDEX "DriverWithdrawRequest_status_idx" ON "DriverWithdrawRequest"("status");

-- CreateIndex
CREATE INDEX "DriverWithdrawRequest_createdAt_idx" ON "DriverWithdrawRequest"("createdAt");

-- CreateIndex
CREATE INDEX "DriverWithdrawRequest_settlementWeek_idx" ON "DriverWithdrawRequest"("settlementWeek");

-- CreateIndex
CREATE INDEX "DriverWalletTransaction_withdrawRequestId_idx" ON "DriverWalletTransaction"("withdrawRequestId");

-- AddForeignKey
ALTER TABLE "DriverWalletTransaction" ADD CONSTRAINT "DriverWalletTransaction_withdrawRequestId_fkey" FOREIGN KEY ("withdrawRequestId") REFERENCES "DriverWithdrawRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverBankAccount" ADD CONSTRAINT "DriverBankAccount_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverWithdrawRequest" ADD CONSTRAINT "DriverWithdrawRequest_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverWithdrawRequest" ADD CONSTRAINT "DriverWithdrawRequest_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "DriverBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

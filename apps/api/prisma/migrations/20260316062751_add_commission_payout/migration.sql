-- CreateEnum
CREATE TYPE "CommissionPayoutStatus" AS ENUM ('PAID');

-- CreateTable
CREATE TABLE "CommissionPayout" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "status" "CommissionPayoutStatus" NOT NULL DEFAULT 'PAID',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidByAdminId" INTEGER,
    "paidByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionPayout_paidAt_idx" ON "CommissionPayout"("paidAt");

-- CreateIndex
CREATE INDEX "CommissionPayout_createdAt_idx" ON "CommissionPayout"("createdAt");

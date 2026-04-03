-- CreateEnum
CREATE TYPE "WeeklyCommissionSettlementStatus" AS ENUM ('PENDING', 'TRANSFERRED');

-- CreateTable
CREATE TABLE "WeeklyCommissionSettlement" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "commissionHoldTotal" INTEGER NOT NULL DEFAULT 0,
    "commissionRefundTotal" INTEGER NOT NULL DEFAULT 0,
    "commissionNetTotal" INTEGER NOT NULL DEFAULT 0,
    "status" "WeeklyCommissionSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "transferredAt" TIMESTAMP(3),
    "transferredByAdminId" INTEGER,
    "transferredByAdminUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyCommissionSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCommissionSettlement_weekKey_key" ON "WeeklyCommissionSettlement"("weekKey");

-- CreateIndex
CREATE INDEX "WeeklyCommissionSettlement_status_idx" ON "WeeklyCommissionSettlement"("status");

-- CreateIndex
CREATE INDEX "WeeklyCommissionSettlement_fromDate_toDate_idx" ON "WeeklyCommissionSettlement"("fromDate", "toDate");

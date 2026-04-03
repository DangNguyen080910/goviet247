-- CreateEnum
CREATE TYPE "AdminCustomerActionType" AS ENUM ('SUSPEND', 'UNSUSPEND');

-- CreateTable
CREATE TABLE "AdminCustomerActionLog" (
    "id" TEXT NOT NULL,
    "riderProfileId" TEXT NOT NULL,
    "actorId" INTEGER,
    "actorUsername" TEXT NOT NULL,
    "action" "AdminCustomerActionType" NOT NULL,
    "fromStatus" "RiderStatus" NOT NULL,
    "toStatus" "RiderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminCustomerActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminCustomerActionLog_riderProfileId_idx" ON "AdminCustomerActionLog"("riderProfileId");

-- CreateIndex
CREATE INDEX "AdminCustomerActionLog_createdAt_idx" ON "AdminCustomerActionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminCustomerActionLog" ADD CONSTRAINT "AdminCustomerActionLog_riderProfileId_fkey" FOREIGN KEY ("riderProfileId") REFERENCES "RiderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

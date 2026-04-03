-- CreateEnum
CREATE TYPE "AdminDriverActionType" AS ENUM ('APPROVE_KYC', 'REJECT_KYC', 'SUSPEND', 'UNSUSPEND');

-- CreateTable
CREATE TABLE "AdminDriverActionLog" (
    "id" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "actorId" INTEGER,
    "actorUsername" TEXT NOT NULL,
    "action" "AdminDriverActionType" NOT NULL,
    "fromStatus" "DriverKycStatus" NOT NULL,
    "toStatus" "DriverKycStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminDriverActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminDriverActionLog_driverProfileId_idx" ON "AdminDriverActionLog"("driverProfileId");

-- CreateIndex
CREATE INDEX "AdminDriverActionLog_createdAt_idx" ON "AdminDriverActionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminDriverActionLog" ADD CONSTRAINT "AdminDriverActionLog_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

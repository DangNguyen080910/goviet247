-- CreateEnum
CREATE TYPE "SystemNotificationTargetType" AS ENUM ('ALL', 'USER');

-- AlterTable
ALTER TABLE "SystemNotification" ADD COLUMN     "targetType" "SystemNotificationTargetType" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "targetUserId" TEXT;

-- CreateIndex
CREATE INDEX "SystemNotification_audience_targetType_isActive_createdAt_idx" ON "SystemNotification"("audience", "targetType", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "SystemNotification_targetUserId_isActive_createdAt_idx" ON "SystemNotification"("targetUserId", "isActive", "createdAt");

-- AddForeignKey
ALTER TABLE "SystemNotification" ADD CONSTRAINT "SystemNotification_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

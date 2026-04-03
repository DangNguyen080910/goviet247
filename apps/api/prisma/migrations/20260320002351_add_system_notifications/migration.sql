-- CreateEnum
CREATE TYPE "SystemNotificationAudience" AS ENUM ('DRIVER', 'RIDER');

-- CreateTable
CREATE TABLE "SystemNotification" (
    "id" TEXT NOT NULL,
    "audience" "SystemNotificationAudience" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemNotification_audience_createdAt_idx" ON "SystemNotification"("audience", "createdAt");

-- CreateIndex
CREATE INDEX "SystemNotification_audience_isActive_createdAt_idx" ON "SystemNotification"("audience", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "SystemNotification_createdByAdminId_idx" ON "SystemNotification"("createdByAdminId");

-- AddForeignKey
ALTER TABLE "SystemNotification" ADD CONSTRAINT "SystemNotification_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

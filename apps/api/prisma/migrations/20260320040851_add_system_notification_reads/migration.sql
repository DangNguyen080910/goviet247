-- CreateTable
CREATE TABLE "SystemNotificationRead" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemNotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemNotificationRead_userId_readAt_idx" ON "SystemNotificationRead"("userId", "readAt");

-- CreateIndex
CREATE INDEX "SystemNotificationRead_notificationId_idx" ON "SystemNotificationRead"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemNotificationRead_notificationId_userId_key" ON "SystemNotificationRead"("notificationId", "userId");

-- AddForeignKey
ALTER TABLE "SystemNotificationRead" ADD CONSTRAINT "SystemNotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "SystemNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemNotificationRead" ADD CONSTRAINT "SystemNotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

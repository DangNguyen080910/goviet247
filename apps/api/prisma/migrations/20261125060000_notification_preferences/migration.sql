ALTER TABLE "SystemNotification" ADD COLUMN "isPinnedByDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SystemNotificationPreference" (
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isPinned" BOOLEAN,
  "isCollapsed" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "SystemNotificationPreference_pkey" PRIMARY KEY ("notificationId", "userId"),
  CONSTRAINT "SystemNotificationPreference_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "SystemNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SystemNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SystemNotificationPreference_userId_isPinned_idx" ON "SystemNotificationPreference"("userId", "isPinned");

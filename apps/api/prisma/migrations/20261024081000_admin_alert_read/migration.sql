ALTER TABLE "AdminAlertLog" ADD COLUMN "readAt" TIMESTAMPTZ(6), ADD COLUMN "readBy" TEXT;
CREATE INDEX "AdminAlertLog_readAt_sentAt_idx" ON "AdminAlertLog"("readAt", "sentAt");

-- CreateTable
CREATE TABLE "AdminAlertLog" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AdminAlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAlertLog_tripId_idx" ON "AdminAlertLog"("tripId");

-- AddForeignKey
ALTER TABLE "AdminAlertLog" ADD CONSTRAINT "AdminAlertLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

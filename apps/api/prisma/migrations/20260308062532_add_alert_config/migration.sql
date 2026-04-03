-- CreateTable
CREATE TABLE "AlertConfig" (
    "id" SERIAL NOT NULL,
    "pendingAlertStartMinutes" INTEGER NOT NULL DEFAULT 15,
    "pendingAlertRepeatMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertConfig_pkey" PRIMARY KEY ("id")
);

/*
  Warnings:

  - You are about to drop the column `pendingAlertRepeatMinutes` on the `AlertConfig` table. All the data in the column will be lost.
  - You are about to drop the column `pendingAlertStartMinutes` on the `AlertConfig` table. All the data in the column will be lost.
  - You are about to drop the column `pendingAlertAt` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `pendingAlertCount` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `pendingAlertSent` on the `Trip` table. All the data in the column will be lost.
  - Added the required column `alertType` to the `AdminAlertLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AdminAlertLog" ADD COLUMN     "alertType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AlertConfig" DROP COLUMN "pendingAlertRepeatMinutes",
DROP COLUMN "pendingAlertStartMinutes",
ADD COLUMN     "pendingTripEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pendingTripPhones" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pendingTripRepeatMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "pendingTripStartMinutes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "unassignedTripEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "unassignedTripPhones" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "unassignedTripRepeatMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "unassignedTripStartMinutes" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "pendingAlertAt",
DROP COLUMN "pendingAlertCount",
DROP COLUMN "pendingAlertSent",
ADD COLUMN     "pendingTripAlertAt" TIMESTAMP(3),
ADD COLUMN     "pendingTripAlertCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unassignedTripAlertAt" TIMESTAMP(3),
ADD COLUMN     "unassignedTripAlertCount" INTEGER NOT NULL DEFAULT 0;

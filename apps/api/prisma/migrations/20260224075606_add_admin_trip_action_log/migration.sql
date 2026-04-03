/*
  Warnings:

  - You are about to drop the column `actionAt` on the `AdminTripActionLog` table. All the data in the column will be lost.
  - You are about to drop the column `actionByAdminId` on the `AdminTripActionLog` table. All the data in the column will be lost.
  - You are about to drop the column `actionByUsername` on the `AdminTripActionLog` table. All the data in the column will be lost.
  - Added the required column `actorRole` to the `AdminTripActionLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actorUsername` to the `AdminTripActionLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AdminTripActionLog_actionByAdminId_idx";

-- AlterTable
ALTER TABLE "AdminTripActionLog" DROP COLUMN "actionAt",
DROP COLUMN "actionByAdminId",
DROP COLUMN "actionByUsername",
ADD COLUMN     "actorId" INTEGER,
ADD COLUMN     "actorRole" TEXT NOT NULL,
ADD COLUMN     "actorUsername" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "note" TEXT;

-- CreateIndex
CREATE INDEX "AdminTripActionLog_createdAt_idx" ON "AdminTripActionLog"("createdAt");

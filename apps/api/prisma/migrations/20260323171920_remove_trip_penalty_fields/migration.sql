/*
  Warnings:

  - You are about to drop the column `penaltyAmount` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `penaltyStatus` on the `Trip` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "penaltyAmount",
DROP COLUMN "penaltyStatus";

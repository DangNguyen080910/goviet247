/*
  Warnings:

  - You are about to drop the column `supportEmail` on the `SystemConfig` table. All the data in the column will be lost.
  - You are about to drop the column `supportPhone` on the `SystemConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SystemConfig" DROP COLUMN "supportEmail",
DROP COLUMN "supportPhone",
ADD COLUMN     "supportEmailDriver" TEXT NOT NULL DEFAULT 'driver@goviet247.com',
ADD COLUMN     "supportEmailRider" TEXT NOT NULL DEFAULT 'help@goviet247.com',
ADD COLUMN     "supportPhoneDriver" TEXT NOT NULL DEFAULT '0977100917',
ADD COLUMN     "supportPhoneRider" TEXT NOT NULL DEFAULT '0977100917';

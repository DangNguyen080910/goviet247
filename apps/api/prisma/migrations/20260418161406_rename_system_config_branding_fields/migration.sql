/*
  Warnings:

  - You are about to drop the column `defaultInAppSoundUrl` on the `SystemConfig` table. All the data in the column will be lost.
  - You are about to drop the column `driverMobileHeroImageUrl` on the `SystemConfig` table. All the data in the column will be lost.
  - You are about to drop the column `riderMobileHeroImageUrl` on the `SystemConfig` table. All the data in the column will be lost.
  - You are about to drop the column `riderWebHeroImageUrl` on the `SystemConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SystemConfig" DROP COLUMN "defaultInAppSoundUrl",
DROP COLUMN "driverMobileHeroImageUrl",
DROP COLUMN "riderMobileHeroImageUrl",
DROP COLUMN "riderWebHeroImageUrl",
ADD COLUMN     "riderMobileBackgroundImageUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "riderWebBackgroundImageUrl" TEXT NOT NULL DEFAULT '';

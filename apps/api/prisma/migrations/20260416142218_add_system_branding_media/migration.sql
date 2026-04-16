-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "brandLogoUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brandName" TEXT NOT NULL DEFAULT 'GoViet247',
ADD COLUMN     "defaultInAppSoundUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "driverMobileHeroImageUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "footerCopyright" TEXT NOT NULL DEFAULT '© 2023 GoViet247 - Công ty TNHH Công nghệ ViNa LightHouse',
ADD COLUMN     "riderMobileHeroImageUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "riderWebHeroImageUrl" TEXT NOT NULL DEFAULT '';

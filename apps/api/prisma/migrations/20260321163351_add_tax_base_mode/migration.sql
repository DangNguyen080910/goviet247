-- CreateEnum
CREATE TYPE "TaxBaseMode" AS ENUM ('GROSS_TRIP_AMOUNT', 'NET_AFTER_PLATFORM_COMMISSION');

-- AlterTable
ALTER TABLE "DriverConfig" ADD COLUMN     "driverPitBaseMode" "TaxBaseMode" NOT NULL DEFAULT 'GROSS_TRIP_AMOUNT',
ADD COLUMN     "driverVatBaseMode" "TaxBaseMode" NOT NULL DEFAULT 'GROSS_TRIP_AMOUNT';

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "driverPitBaseModeSnapshot" "TaxBaseMode",
ADD COLUMN     "driverVatBaseModeSnapshot" "TaxBaseMode";

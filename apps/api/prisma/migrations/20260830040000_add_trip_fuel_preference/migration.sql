CREATE TYPE "FuelPreference" AS ENUM ('ANY', 'ELECTRIC', 'GASOLINE');

ALTER TABLE "Trip"
ADD COLUMN "fuelPreference" "FuelPreference" NOT NULL DEFAULT 'ANY';

ALTER TABLE "PricingConfig"
ADD COLUMN "gasolineSurchargePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "DriverProfile" ADD COLUMN "operatingProvinceCode" VARCHAR(2) NOT NULL DEFAULT '79', ADD COLUMN "operatingProvinceConfirmedAt" TIMESTAMPTZ(6);
CREATE INDEX "DriverProfile_operatingProvinceCode_idx" ON "DriverProfile"("operatingProvinceCode");

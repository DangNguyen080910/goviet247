ALTER TABLE "PricingConfig"
  ADD COLUMN "holidaySurchargePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "holidayStartDate" VARCHAR(10),
  ADD COLUMN "holidayEndDate" VARCHAR(10),
  ADD COLUMN "holidayName" VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN "holidayNote" VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE "Trip" ADD COLUMN "holidaySurcharge" JSONB;
ALTER TABLE "PricingConfig" ADD CONSTRAINT "PricingConfig_holiday_percent_check"
  CHECK ("holidaySurchargePercent" >= 0 AND "holidaySurchargePercent" <= 100);
ALTER TABLE "PricingConfig" ADD CONSTRAINT "PricingConfig_holiday_range_check"
  CHECK (("holidayStartDate" IS NULL AND "holidayEndDate" IS NULL AND "holidaySurchargePercent" = 0)
    OR ("holidayStartDate" IS NOT NULL AND "holidayEndDate" IS NOT NULL AND "holidayStartDate" <= "holidayEndDate"));

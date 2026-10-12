ALTER TABLE "PricingConfig" ADD COLUMN "holidayPeriods" JSONB;
UPDATE "PricingConfig" SET "holidayPeriods" = CASE
 WHEN "holidayStartDate" IS NOT NULL AND "holidayEndDate" IS NOT NULL THEN jsonb_build_array(jsonb_build_object(
 'id', 'legacy', 'enabled', true, 'holidaySurchargePercent', "holidaySurchargePercent"::float,
 'holidayStartDate', "holidayStartDate", 'holidayEndDate', "holidayEndDate", 'holidayName', "holidayName", 'holidayNote', "holidayNote"))
 ELSE '[]'::jsonb END;
ALTER TABLE "Device" ADD COLUMN "pushSessionId" TEXT, ADD COLUMN "pushExpiresAt" TIMESTAMPTZ(6);

ALTER TABLE "Trip" ADD COLUMN "chatVisibleFrom" TIMESTAMPTZ(6);
-- Restore assignment boundaries for trips returned before this feature was deployed.
UPDATE "Trip" t SET "chatVisibleFrom" = history."boundary"
FROM (
  SELECT "tripId", MAX("createdAt") AS "boundary" FROM (
    SELECT "tripId", "createdAt" FROM "AdminTripActionLog"
      WHERE "toStatus" = 'PENDING' AND "fromStatus" IN ('ACCEPTED', 'CONTACTED')
    UNION ALL
    SELECT "tripId", "createdAt" FROM "DriverTripPenaltyLog"
  ) events GROUP BY "tripId"
) history WHERE t."id" = history."tripId";

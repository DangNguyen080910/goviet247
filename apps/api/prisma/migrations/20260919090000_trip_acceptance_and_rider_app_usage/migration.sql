ALTER TABLE "DriverProfile" ADD COLUMN "tripAcceptBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TYPE "AdminDriverActionType" ADD VALUE 'BLOCK_TRIP_ACCEPT';
ALTER TYPE "AdminDriverActionType" ADD VALUE 'UNBLOCK_TRIP_ACCEPT';
CREATE TABLE "RiderAppUsage" (
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiderAppUsage_pkey" PRIMARY KEY ("userId", "platform"),
  CONSTRAINT "RiderAppUsage_platform_check" CHECK ("platform" IN ('android', 'ios')),
  CONSTRAINT "RiderAppUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Historical evidence of Rider app use, not proof that an app is still installed.
INSERT INTO "RiderAppUsage" ("userId", "platform", "firstSeenAt", "lastSeenAt")
SELECT "userId", lower("platform"), min("createdAt"), max("updatedAt")
FROM "Device" WHERE upper("role") = 'RIDER' AND lower("platform") IN ('android', 'ios')
GROUP BY "userId", lower("platform");

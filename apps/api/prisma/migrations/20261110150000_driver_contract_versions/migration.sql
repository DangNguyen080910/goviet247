CREATE TABLE "DriverContractVersion" (
 "id" TEXT NOT NULL, "version" TEXT NOT NULL, "content" JSONB NOT NULL,
 "changeSummary" TEXT NOT NULL, "graceDays" INTEGER NOT NULL DEFAULT 7,
 "requireForNewTrips" BOOLEAN NOT NULL DEFAULT false, "createdBy" TEXT NOT NULL,
 "publishedBy" TEXT, "publishedAt" TIMESTAMPTZ(6),
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "DriverContractVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DriverContractVersion_version_key" ON "DriverContractVersion"("version");
CREATE INDEX "DriverContractVersion_publishedAt_idx" ON "DriverContractVersion"("publishedAt");

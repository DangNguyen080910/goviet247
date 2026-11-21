-- CreateTable
CREATE TABLE "DriverRulesVersion" (
    "id" TEXT NOT NULL,
    "version" SERIAL NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "baseVersionId" TEXT,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DriverRulesVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverRulesAcceptance" (
    "id" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "confirmation" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverRulesAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverRulesVersion_version_key" ON "DriverRulesVersion"("version");

-- CreateIndex
CREATE INDEX "DriverRulesVersion_publishedAt_idx" ON "DriverRulesVersion"("publishedAt");

-- CreateIndex
CREATE INDEX "DriverRulesAcceptance_versionId_acceptedAt_idx" ON "DriverRulesAcceptance"("versionId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DriverRulesAcceptance_driverProfileId_versionId_key" ON "DriverRulesAcceptance"("driverProfileId", "versionId");

-- AddForeignKey
ALTER TABLE "DriverRulesAcceptance" ADD CONSTRAINT "DriverRulesAcceptance_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverRulesAcceptance" ADD CONSTRAINT "DriverRulesAcceptance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DriverRulesVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A single editable draft, including concurrent requests outside the API.
CREATE UNIQUE INDEX "DriverRulesVersion_single_draft" ON "DriverRulesVersion" ((true)) WHERE "publishedAt" IS NULL;

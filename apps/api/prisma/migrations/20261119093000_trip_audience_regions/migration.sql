-- Preserve the regions chosen at approval time. Empty on older approvals;
-- display falls back to public / selected without guessing from driver locations.
ALTER TABLE "Trip"
ADD COLUMN "audienceRegions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

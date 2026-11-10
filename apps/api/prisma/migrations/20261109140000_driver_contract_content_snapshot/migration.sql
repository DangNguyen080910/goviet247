-- Additive only. Historical acceptances remain untouched; never backfill consent.
ALTER TABLE "DriverContractAcceptance" ADD COLUMN "contentSnapshot" JSONB;

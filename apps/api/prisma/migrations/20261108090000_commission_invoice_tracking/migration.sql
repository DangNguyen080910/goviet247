-- Keep invoice recognition independent of later Trip.updatedAt edits and of manual confirmations.
CREATE TABLE "CommissionInvoiceState" (
  "tripId" TEXT NOT NULL,
  "recognizedAt" TIMESTAMPTZ(6) NOT NULL,
  "legacyTimestamp" BOOLEAN NOT NULL DEFAULT false,
  "issuedAt" TIMESTAMPTZ(6),
  "invoiceNumber" TEXT,
  "confirmedAt" TIMESTAMPTZ(6),
  "confirmedBy" TEXT,
  CONSTRAINT "CommissionInvoiceState_pkey" PRIMARY KEY ("tripId"),
  CONSTRAINT "CommissionInvoiceState_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CommissionInvoiceState_issuedAt_recognizedAt_idx" ON "CommissionInvoiceState"("issuedAt", "recognizedAt");
INSERT INTO "CommissionInvoiceState" ("tripId","recognizedAt","legacyTimestamp")
SELECT "id","updatedAt",true FROM "Trip" WHERE "status"='COMPLETED';
CREATE FUNCTION record_commission_invoice_completion() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'COMPLETED' THEN
    INSERT INTO "CommissionInvoiceState" ("tripId","recognizedAt") VALUES (NEW."id",CURRENT_TIMESTAMP)
    ON CONFLICT ("tripId") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "trip_commission_invoice_completion" AFTER INSERT OR UPDATE OF "status" ON "Trip"
FOR EACH ROW EXECUTE FUNCTION record_commission_invoice_completion();

ALTER TABLE "Trip" ADD COLUMN "bookingRequestKey" TEXT, ADD COLUMN "bookingInputHash" TEXT;
CREATE UNIQUE INDEX "Trip_bookingRequestKey_key" ON "Trip"("bookingRequestKey");
CREATE TABLE "BookingQuote" (
 "tokenHash" TEXT NOT NULL PRIMARY KEY, "requestHash" TEXT NOT NULL, "route" JSONB NOT NULL,
 "pricing" JSONB NOT NULL, "expiresAt" TIMESTAMPTZ(6) NOT NULL,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BookingQuote_expiresAt_idx" ON "BookingQuote"("expiresAt");

ALTER TABLE "admin_users" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Device" ADD COLUMN "adminAuthVersion" TEXT;
CREATE FUNCTION goviet_admin_auth_version() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW."authVersion" := OLD."authVersion" + 1;
    NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER goviet_admin_auth_version_before_update BEFORE UPDATE ON "admin_users"
FOR EACH ROW EXECUTE FUNCTION goviet_admin_auth_version();

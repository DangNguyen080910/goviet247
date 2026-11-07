ALTER TABLE "Trip" ADD COLUMN "walletHoldId" TEXT;
ALTER TABLE "DriverWalletTransaction" ADD COLUMN "walletHoldId" TEXT;
CREATE INDEX "DriverWalletTransaction_walletHoldId_idx" ON "DriverWalletTransaction"("walletHoldId");

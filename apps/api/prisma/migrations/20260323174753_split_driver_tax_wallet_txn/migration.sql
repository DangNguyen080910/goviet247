/*
  Warnings:

  - The values [DRIVER_TAX_HOLD,DRIVER_TAX_REFUND] on the enum `DriverWalletTxnType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DriverWalletTxnType_new" AS ENUM ('TOPUP', 'COMMISSION_HOLD', 'COMMISSION_REFUND', 'TRIP_CANCEL_PENALTY', 'DRIVER_VAT_HOLD', 'DRIVER_VAT_REFUND', 'DRIVER_PIT_HOLD', 'DRIVER_PIT_REFUND', 'WITHDRAW_REQUEST', 'WITHDRAW_REJECT_REFUND', 'WITHDRAW_PAID', 'ADJUST_ADD', 'ADJUST_SUBTRACT');
ALTER TABLE "DriverWalletTransaction" ALTER COLUMN "type" TYPE "DriverWalletTxnType_new" USING ("type"::text::"DriverWalletTxnType_new");
ALTER TYPE "DriverWalletTxnType" RENAME TO "DriverWalletTxnType_old";
ALTER TYPE "DriverWalletTxnType_new" RENAME TO "DriverWalletTxnType";
DROP TYPE "DriverWalletTxnType_old";
COMMIT;

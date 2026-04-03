-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "driverTopupAccountHolderName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "driverTopupAccountNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "driverTopupBankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "driverTopupNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "driverTopupQrImageUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "driverTopupTransferPrefix" TEXT NOT NULL DEFAULT 'NAPVI';

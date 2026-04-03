-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "commissionAmountSnapshot" INTEGER,
ADD COLUMN     "commissionPercentSnapshot" INTEGER,
ADD COLUMN     "driverReceiveSnapshot" INTEGER;

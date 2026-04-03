/*
  Warnings:

  - You are about to drop the column `order` on the `TripStop` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TripStop` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tripId,seq]` on the table `TripStop` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `seq` to the `TripStop` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TripStop_tripId_order_key";

-- AlterTable
ALTER TABLE "TripStop" DROP COLUMN "order",
DROP COLUMN "updatedAt",
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "seq" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TripStop_tripId_seq_key" ON "TripStop"("tripId", "seq");

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" INTEGER,
ADD COLUMN     "verifiedNote" TEXT;

-- CreateIndex
CREATE INDEX "idx_trip_verified_status_createdAt" ON "Trip"("isVerified", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

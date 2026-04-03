-- CreateTable
CREATE TABLE "AdminTripActionLog" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "fromStatus" "TripStatus" NOT NULL,
    "toStatus" "TripStatus" NOT NULL,
    "actionByAdminId" INTEGER NOT NULL,
    "actionByUsername" VARCHAR(50) NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTripActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminTripActionLog_tripId_idx" ON "AdminTripActionLog"("tripId");

-- CreateIndex
CREATE INDEX "AdminTripActionLog_actionByAdminId_idx" ON "AdminTripActionLog"("actionByAdminId");

-- AddForeignKey
ALTER TABLE "AdminTripActionLog" ADD CONSTRAINT "AdminTripActionLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

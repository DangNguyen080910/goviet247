ALTER TABLE "TripConfig" ADD COLUMN "autoApproveNewTrips" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "autoApproveRequeuedTrips" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trip" ADD COLUMN "autoApprovalReviewReason" TEXT;

-- CreateEnum
CREATE TYPE "FeedbackActorRole" AS ENUM ('RIDER', 'DRIVER');

-- CreateEnum
CREATE TYPE "FeedbackSource" AS ENUM ('RIDER_PROFILE', 'RIDER_TRIP_HISTORY', 'DRIVER_MENU', 'DRIVER_TRIP_HISTORY');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tripId" TEXT,
    "actorRole" "FeedbackActorRole" NOT NULL,
    "source" "FeedbackSource" NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" INTEGER,
    "senderName" TEXT,
    "senderPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_actorRole_status_createdAt_idx" ON "Feedback"("actorRole", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_tripId_idx" ON "Feedback"("tripId");

-- CreateIndex
CREATE INDEX "Feedback_resolvedByAdminId_idx" ON "Feedback"("resolvedByAdminId");

-- CreateIndex
CREATE INDEX "Feedback_source_createdAt_idx" ON "Feedback"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_resolvedByAdminId_fkey" FOREIGN KEY ("resolvedByAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

// Path: goviet247/apps/api/src/services/tripStateService.js
import { prisma } from "../utils/db.js";

/**
 * State machine cho Trip
 *
 * Flow mới:
 *
 * PENDING
 *   -> ACCEPTED
 *   -> CANCELLED
 *
 * ACCEPTED
 *   -> CONTACTED
 *   -> PENDING     // tài xế trả chuyến về pool
 *   -> CANCELLED
 *
 * CONTACTED
 *   -> IN_PROGRESS
 *   -> PENDING     // tài xế trả chuyến về pool
 *   -> CANCELLED
 *
 * IN_PROGRESS
 *   -> COMPLETED
 *   -> CANCELLED
 *
 */

const ALLOWED = {
  PENDING: ["ACCEPTED", "CANCELLED"],

  ACCEPTED: ["CONTACTED", "PENDING", "CANCELLED"],

  CONTACTED: ["IN_PROGRESS", "PENDING", "CANCELLED"],

  IN_PROGRESS: ["COMPLETED", "CANCELLED"],

  COMPLETED: [],

  CANCELLED: [],
};

export async function updateTripStatus(tripId, newStatus) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  if (!ALLOWED[trip.status]?.includes(newStatus)) {
    throw new Error(`Invalid transition: ${trip.status} -> ${newStatus}`);
  }

  const data = {
    status: newStatus,
    version: { increment: 1 },
  };

  // Việt: Khi tài xế trả chuyến về pool thì phải tháo tài xế ra khỏi chuyến
  // để chuyến quay lại danh sách "Chuyến đang chờ"
  if (newStatus === "PENDING") {
    data.driverId = null;
    data.acceptedAt = null;
    data.cancelledAt = null;
    data.cancelReason = null;
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data,
  });

  return updated;
}
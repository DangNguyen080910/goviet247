// PostgreSQL row locks are held until the caller's transaction commits.
// Always lock profile before trip when both are needed.
export async function lockDriverProfile(tx, userId) {
  await tx.$queryRaw`SELECT "id" FROM "DriverProfile" WHERE "userId" = ${userId} FOR UPDATE`;
}

export async function lockTrip(tx, tripId) {
  await tx.$queryRaw`SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE`;
}

export function assertTripAcceptanceAllowed(profile) {
  if (profile?.tripAcceptBlocked) {
    throw Object.assign(new Error("Hiện không thể nhận chuyến."), {
      statusCode: 409, code: "TRIP_ACCEPT_UNAVAILABLE",
    });
  }
}

export function availableTripWhere(tripId, now) {
  return {
    id: tripId, status: "PENDING", driverId: null, acceptedAt: null,
    isVerified: true, verifiedAt: { not: null }, cancelledAt: null,
    OR: [{ driverAcceptOpenAt: null }, { driverAcceptOpenAt: { lte: now } }],
  };
}

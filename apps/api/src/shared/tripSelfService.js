// PENDING contains both review and approved/unassigned trips. Approval closes self-cancellation.
export function canSelfCancelTrip(trip) {
  return String(trip?.status || '').trim().toUpperCase() === 'PENDING' &&
    !trip.isVerified && !trip.verifiedAt && !trip.driverId && !trip.cancelledAt;
}

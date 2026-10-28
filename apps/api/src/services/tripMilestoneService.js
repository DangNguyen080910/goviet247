// Completion writers share this transaction lock so concurrent trips cannot skip a milestone.
export async function lockTripMilestones(tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(2470199)::text`;
}

export function upcomingTripMilestone(completedCount) {
  return Number.isSafeInteger(completedCount) && completedCount > 0 && completedCount % 100 === 99
    ? completedCount + 1 : null;
}

export async function recordTripMilestone(tx, tripId) {
  const completedCount = await tx.trip.count({ where: { status: "COMPLETED" } });
  const target = upcomingTripMilestone(completedCount);
  if (!target) return null;
  const existing = await tx.adminAlertLog.findFirst({
    where: { alertType: "TRIP_MILESTONE", level: target },
  });
  if (existing) return null;
  return tx.adminAlertLog.create({ data: {
    tripId, alertType: "TRIP_MILESTONE", level: target,
    message: `GoViet247 đã hoàn thành ${completedCount.toLocaleString("vi-VN")} chuyến! Chuẩn bị đón mốc chuyến thứ ${target.toLocaleString("vi-VN")} 🎊`,
    sentTo: "ADMIN", success: true,
  } });
}

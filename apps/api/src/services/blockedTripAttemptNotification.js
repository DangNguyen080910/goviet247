import { sendAdminPushNotification } from "./notificationService.js";
import { prisma } from "../utils/db.js";
import { canDriverSeeTrip } from "./tripAudiencePolicy.js";

const recentAttempts = new Map();
const COOLDOWN_MS = 30_000;

// Called only after the acceptance transaction has rejected a blocked driver.
// Notification failures must never change the rejection or unlock the driver.
export async function notifyBlockedTripAttempt({ io, driverId, tripId }) {
  if (!driverId || !tripId) return;
  const now = Date.now();
  for (const [key, at] of recentAttempts) {
    if (now - at >= COOLDOWN_MS) recentAttempts.delete(key);
  }
  const key = `${driverId}:${tripId}`;
  if (recentAttempts.has(key)) return;
  if (recentAttempts.size >= 10_000) return;
  recentAttempts.set(key, now);

  try {
    const [profile, trip] = await Promise.all([
      prisma.driverProfile.findUnique({
        where: { userId: driverId },
        select: { id: true, fullName: true, tripAcceptBlocked: true, user: { select: { displayName: true } } },
      }),
      prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, status: true, driverId: true, isVerified: true, verifiedAt: true, cancelledAt: true, audienceDriverIds: true },
      }),
    ]);
    if (!profile?.tripAcceptBlocked || !trip || trip.status !== "PENDING" || trip.driverId ||
        !trip.isVerified || !trip.verifiedAt || trip.cancelledAt || !canDriverSeeTrip(trip, driverId)) return;

    const driverName = profile.fullName || profile.user?.displayName || "Tài xế";
    const message = `${driverName} (mã tài xế: ${profile.id}) đang bị khoá nhận chuyến, vừa bấm nhận chuyến #${tripId.slice(-8).toUpperCase()}. Chuyến chưa được giao cho tài xế này.`;
    // Also suppress rapid repeats across API processes and preserve history.
    const previous = await prisma.adminAlertLog.findFirst({
      where: { tripId, alertType: "BLOCKED_TRIP_ACCEPT_ATTEMPT", message, sentAt: { gte: new Date(now - COOLDOWN_MS) } },
      select: { id: true },
    });
    if (previous) return;
    const alert = await prisma.adminAlertLog.create({
      data: { tripId, alertType: "BLOCKED_TRIP_ACCEPT_ATTEMPT", level: 1, message, sentTo: "admins", success: true },
    });
    io?.to("admins").emit("admin:blocked_trip_accept_attempt", {
      alertId: alert.id, tripId, driverProfileId: profile.id, driverId, driverName,
      createdAt: alert.sentAt,
    });
    await sendAdminPushNotification({
      title: "Tài xế bị khoá vừa bấm nhận chuyến",
      body: `${driverName} vừa bấm nhận chuyến #${tripId.slice(-8).toUpperCase()}. Mở Admin để kiểm tra và xử lý.`,
      data: { type: "BLOCKED_TRIP_ACCEPT_ATTEMPT", alertId: alert.id, tripId, driverProfileId: profile.id },
    });
  } catch (error) {
    console.error("[BlockedTripAttempt] Could not notify admins:", error?.message);
  }
}

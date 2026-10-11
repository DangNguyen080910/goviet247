function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function phoneVariants(value) {
  const digits = normalizeDigits(value);
  const variants = new Set();
  if (/^0[35789]\d{8}$/.test(digits)) {
    variants.add(digits);
    variants.add(`+84${digits.slice(1)}`);
    variants.add(`84${digits.slice(1)}`);
  } else if (/^84[35789]\d{8}$/.test(digits)) {
    variants.add(digits);
    variants.add(`+${digits}`);
    variants.add(`0${digits.slice(2)}`);
  }
  return [...variants];
}

export async function getVerifiedRiderPhoneVariants(db, userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return [];
  const phones = await db.phone.findMany({
    where: { userId: normalizedUserId, isVerified: true },
    select: { e164: true },
  });
  return [...new Set(phones.flatMap((phone) => phoneVariants(phone.e164)))];
}

export async function getTripRiderRecipientUserIds(db, trip) {
  const userIds = new Set();
  const ownerId = String(trip?.riderId || "").trim();
  if (ownerId) userIds.add(ownerId);
  const e164Phones = phoneVariants(trip?.riderPhone).filter((phone) =>
    /^\+84\d{9}$/.test(phone),
  );
  if (!e164Phones.length) return [...userIds];
  const phones = await db.phone.findMany({
    where: { e164: { in: e164Phones }, isVerified: true, userId: { not: null } },
    select: { userId: true },
  });
  for (const phone of phones) if (phone.userId) userIds.add(phone.userId);
  return [...userIds];
}

export function riderTripAccessWhere(userId, phoneNumbers = []) {
  const OR = [];
  const normalizedUserId = String(userId || "").trim();
  if (normalizedUserId) OR.push({ riderId: normalizedUserId });
  if (phoneNumbers.length) OR.push({ riderPhone: { in: phoneNumbers } });
  return OR.length ? { OR } : { id: "__no_rider_trip_access__" };
}

export async function emitRiderTripUpdate(io, db, trip, payload = {}) {
  if (!io || !trip?.id) return;
  let recipientIds;
  try {
    recipientIds = await getTripRiderRecipientUserIds(db, trip);
  } catch (error) {
    console.error("[RiderSocket] recipient lookup error:", error);
    recipientIds = trip.riderId ? [trip.riderId] : [];
  }
  for (const userId of recipientIds) {
    const event = {
      ...payload,
      tripId: trip.id,
      riderId: userId,
      status: trip.status,
      updatedAt: trip.updatedAt,
    };
    io.to(`rider:${userId}`).emit("rider:trip_changed", event);
    io.to(`rider:${userId}`).emit("rider:notification_changed", event);
  }
}

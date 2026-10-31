export function hasActiveTripContact(status) {
  return ["ACCEPTED", "CONTACTED", "IN_PROGRESS"].includes(String(status || "").toUpperCase());
}
export function phoneCallUrl(phone) {
  const raw = String(phone || "").trim();
  if (/[^+0-9().\s-]/.test(raw)) return null;
  const normalized = raw.replace(/[().\s-]/g, "");
  return /^\+?\d{6,15}$/.test(normalized) ? `tel:${normalized}` : null;
}
export function riderDriverContact(trip, driver) {
  if (!trip?.driverId || !hasActiveTripContact(trip.status) || !driver) return null;
  const phone = driver.phones?.[0]?.e164 || null;
  return {
    name: driver.driverProfile?.fullName || driver.displayName || "Tài xế",
    phone: phoneCallUrl(phone) ? phone : null,
  };
}

export function hasActiveTripContact(status) {
  return ["ACCEPTED", "CONTACTED", "IN_PROGRESS"].includes(String(status || "").trim().toUpperCase());
}
export function phoneCallUrl(phone) {
  const raw = String(phone || "").trim();
  if (/[^+0-9().\s-]/.test(raw)) return null;
  const normalized = raw.replace(/[().\s-]/g, "");
  return /^\+?\d{6,15}$/.test(normalized) ? `tel:${normalized}` : null;
}
// Rider clients never receive the driver's personal contact details.
export function riderDriverContact() {
  return null;
}

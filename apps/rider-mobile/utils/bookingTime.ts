export function vietnamNow() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16);
}

export function bookingTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const date = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(date.getTime())) return "";
  const roundTrip = new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16);
  return roundTrip === value ? date.toISOString() : "";
}

export function formatBookingTime(value: string): string {
  if (!value) return "Chọn giờ";
  const hour = Number(value.slice(11, 13));
  const period = hour === 0 ? "đêm" : hour < 12 ? "sáng" : hour === 12 ? "trưa" : hour < 18 ? "chiều" : "tối";
  return `${String(hour % 12 || 12).padStart(2, "0")}:${value.slice(14, 16)} ${period} (${value.slice(11, 16)})`;
}

export function setBookingClock(value: string, hour: number, minute: number, period: "AM" | "PM") {
  const day = (value || vietnamNow()).slice(0, 10);
  const hour24 = hour % 12 + (period === "PM" ? 12 : 0);
  return `${day}T${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Legacy web clients send wall-clock time without an offset. Trips use Vietnam time.
export function parseTripTime(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== "string") return new Date(NaN);
  const text = value.trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return new Date(NaN);
  const [, day, time, seconds = "00", fraction = "", zone = "+07:00"] = match;
  const wallClock = `${day}T${time}:${seconds}${fraction}`;
  // Reject calendar overflow (for example 31 February or 24:00).
  const calendar = new Date(`${wallClock}Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== `${day}T${time}:${seconds}`) {
    return new Date(NaN);
  }
  return new Date(`${wallClock}${zone}`);
}

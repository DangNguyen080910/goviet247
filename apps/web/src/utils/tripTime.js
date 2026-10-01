export function toDateTimeLocalValue(value) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const date = new Date(`${value}:00+07:00`);
  if (!Number.isFinite(date.getTime())) return "";
  const iso = date.toISOString();
  return toDateTimeLocalValue(iso) === value ? iso : "";
}

export function scheduleLocalToIso(value, original) {
  return original && value === toDateTimeLocalValue(original)
    ? original
    : fromDateTimeLocalValue(value);
}

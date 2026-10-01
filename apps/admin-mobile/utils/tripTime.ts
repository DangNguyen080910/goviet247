const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function formatScheduleInput(value?: string | null): string {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  // Read shifted UTC components so the device timezone never changes trip time.
  const local = new Date(timestamp + VN_OFFSET_MS).toISOString();
  return `${local.slice(8, 10)}/${local.slice(5, 7)}/${local.slice(0, 4)} ${local.slice(11, 16)}`;
}

export function parseScheduleInput(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+07:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString();
  return formatScheduleInput(iso) === value.trim() ? iso : null;
}

export function scheduleInputToIso(value: string, original?: string | null): string | null {
  // Preserve seconds/milliseconds when an unrelated field is edited.
  return original && value === formatScheduleInput(original) ? original : parseScheduleInput(value);
}

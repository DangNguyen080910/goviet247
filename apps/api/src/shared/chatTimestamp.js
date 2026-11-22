const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const twoDigits = value => String(value).padStart(2, '0');

/**
 * Format the message's creation instant as HH:mm dd/MM/yyyy in Vietnam (UTC+7).
 * Keep Web and mobile output consistent without relying on locale formatters.
 * @param {string | number | Date | null | undefined} value
 * @returns {string}
 */
export function formatChatTimestamp(value) {
  if (value == null || value === '') return '';
  const instant = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(instant)) return '';
  const vietnam = new Date(instant + VIETNAM_OFFSET_MS);
  if (!Number.isFinite(vietnam.getTime())) return '';
  const time = `${twoDigits(vietnam.getUTCHours())}:${twoDigits(vietnam.getUTCMinutes())}`;
  const date = `${twoDigits(vietnam.getUTCDate())}/${twoDigits(vietnam.getUTCMonth() + 1)}/${vietnam.getUTCFullYear()}`;
  return `${time} ${date}`;
}

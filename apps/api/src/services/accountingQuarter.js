// Vietnam does not observe daylight saving time. Store inclusive quarter
// boundaries as UTC instants so exports do not depend on the server timezone.
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getQuarterDateRange(year, quarter) {
  const requestedYear = Number(year);
  const safeYear = Number.isInteger(requestedYear) && requestedYear >= 1970 && requestedYear <= 9999
    ? requestedYear : new Date().getUTCFullYear();
  const safeQuarter = [1, 2, 3, 4].includes(Number(quarter)) ? Number(quarter) : 1;
  const startMonth = (safeQuarter - 1) * 3;
  const start = new Date(Date.UTC(safeYear, startMonth, 1) - VIETNAM_UTC_OFFSET_MS);
  const end = new Date(Date.UTC(safeYear, startMonth + 3, 1) - VIETNAM_UTC_OFFSET_MS - 1);
  return { year: safeYear, quarter: safeQuarter, start, end };
}

// A month takes precedence over quarter; all boundaries remain Vietnam local time.
export function getAccountingPeriod(year, quarter, month) {
  const range = getQuarterDateRange(year, quarter);
  if (month == null || month === "") return { ...range, month: null, periodKey: `Q${range.quarter}_${range.year}` };
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("Tháng không hợp lệ. Vui lòng chọn từ 1 đến 12.");
  return { year: range.year, quarter: Math.ceil(m / 3), month: m,
    start: new Date(Date.UTC(range.year, m - 1, 1) - VIETNAM_UTC_OFFSET_MS),
    end: new Date(Date.UTC(range.year, m, 1) - VIETNAM_UTC_OFFSET_MS - 1),
    periodKey: `T${String(m).padStart(2, "0")}_${range.year}` };
}

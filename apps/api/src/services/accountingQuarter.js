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

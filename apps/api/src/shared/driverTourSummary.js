import { destinationSummary } from './destinationService.js';
export function driverTourSummary(snapshot, { hidePaymentAndScope = false } = {}) {
  const summary = destinationSummary(snapshot);
  const result = hidePaymentAndScope ? summary.slice(0, -2) : [...summary];
  const display = snapshot?.tourDisplay;
  if (display && Number.isFinite(display.total) && display.total > 0) {
    result.push(`Phụ phí phục vụ tour: ${display.total.toLocaleString('vi-VN')}đ`);
  } else if (!display && Number(snapshot?.fee) > 0) {
    // Only the charter amount is known on legacy snapshots, never invent a
    // combined waiting/overnight/service amount for those trips.
    result.push(`Phí Bao xe đã xác nhận: ${Number(snapshot.fee).toLocaleString('vi-VN')}đ`);
  }
  return result;
}

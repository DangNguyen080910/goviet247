import { destinationSummary, vnDay, vnTime } from './destinationService.js';

export function driverTourSummary(snapshot, { hidePaymentAndScope = false } = {}) {
  const summary = destinationSummary(snapshot);
  // The final two entries are payment and scope notices, including legacy fallbacks.
  const rows = hidePaymentAndScope ? summary.slice(0, -2) : summary;
  // Replace only the old itemized charter-fee line; retain all service terms.
  const display = snapshot?.tourDisplay;
  const result = rows.filter(line => !String(line).startsWith('Phụ phí: ')
    && !(display?.arrival && display?.returnTime && /^\d{4}-\d{2}-\d{2}:/.test(String(line))));
  if (snapshot?.eligible && display?.arrival && display?.returnTime) {
    const sessions = new Map((snapshot.sessions || []).map(session => [session.date, session]));
    const first = Date.parse(vnDay(display.arrival) + 'T00:00:00+07:00');
    const last = Date.parse(vnDay(display.returnTime) + 'T00:00:00+07:00');
    const schedule = [];
    let standardDays = 0;
    for (let day = first, count = 0; day <= last && count < 367; day += 86400000, count++) {
      const date = vnDay(day);
      const session = sessions.get(date);
      const dayInfo = snapshot.days?.find(day => day.date === date);
      if (!session) standardDays++;
      schedule.push(session
        ? `${date}: ${snapshot.charterName} · ${session.flexible ? "Tối đa " + session.hours + " giờ trong khung " : ""}${vnTime(session.start)}–${vnTime(session.end)}${session.flexible ? " · Thống nhất lịch với khách" : " (" + session.hours + " giờ)"}`
        : `${date}: ${snapshot.standardName}${dayInfo ? dayInfo.standardStart ? " · Hỗ trợ đi ăn " + vnTime(dayInfo.standardStart) + "–" + vnTime(dayInfo.standardEnd) + "; hoàn tất trước giờ quay về" : " · Không còn khung hỗ trợ đi ăn tại điểm đến" : ""}`);
    }
    // destinationSummary puts the standard heading, description and hours after the anchor.
    // Hide that block only when every itinerary date has a booked charter session.
    if (!snapshot.days && schedule.length > 0 && standardDays === 0) result.splice(2, 3);
    result.splice(1, 0, `Lịch phục vụ: ${schedule.length} ngày · ${sessions.size} ngày Bao xe`, ...schedule);
  }
  if (display && Number.isFinite(display.total) && display.total > 0) {
    result.push(`Phụ phí phục vụ tour: ${display.total.toLocaleString('vi-VN')}đ — Đã bao gồm trong giá chuyến.`);
  } else if (!display && Number(snapshot?.fee) > 0) {
    // Legacy trips do not contain a full fee snapshot. Do not label charter-only money as total tour fees.
    result.push('Phí Bao xe tại điểm đến đã bao gồm trong giá chuyến.');
  }
  return result;
}

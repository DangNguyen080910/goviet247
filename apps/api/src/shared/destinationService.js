export const DEFAULT_DESTINATION_CONFIG = {
  enabled: true,
  title: "Nhu cầu sử dụng xe tại điểm đến",
  introduction: "Áp dụng cho chuyến khứ hồi có lưu trú qua đêm hoặc nhiều ngày.",
  standardName: "Tiêu chuẩn",
  standardDescription: "Hỗ trợ đi ăn sáng, trưa, tối; tối đa {trips} lượt khứ hồi/ngày trong phạm vi {radius} km theo đường ô tô tính từ nơi lưu trú đã xác nhận. Mỗi lượt đến một địa điểm ăn uống rồi quay về. Không cộng dồn lượt; không bao gồm tham quan, mua sắm. Ngày đến/về chỉ hỗ trợ các bữa trong thời gian lưu trú thực tế. Thống nhất giờ đón đi và đón về trước mỗi lượt.",
  standardRadiusKm: 5, standardTripsPerDay: 3, standardStartHour: 7, standardEndHour: 21,
  charterName: "Bao xe tại điểm đến",
  charterDescription: "Bao gồm đi ăn uống, tham quan, mua sắm trong phạm vi {radius} km theo đường ô tô tính từ nơi lưu trú đã xác nhận; tối đa {hours} giờ/ngày, trong khung {start}–{end}. Thời gian phục vụ gồm di chuyển và chờ. Khách và tài xế thống nhất các điểm chính và khoảng nghỉ trước mỗi ngày; tài xế phục vụ đúng lịch đã xác nhận. Vé tham quan và chi tiêu cá nhân của khách không bao gồm trong giá.",
  charterRadiusKm: 30, charterHoursPerDay: 8, charterStartHour: 7, charterEndHour: 21, charterDailyFee: 800000,
  outsideNotice: "Muốn đi ngoài phạm vi, cần liên hệ GoViet247 xác nhận lịch trình và giá cập nhật trước khi thực hiện.",
  allInclusiveNotice: "Đây là giá trọn gói, đã bao gồm phí cầu đường, cao tốc và chi phí ăn nghỉ của tài xế trong toàn hành trình. Không phát sinh thêm.",
  paymentNotice: "Thanh toán trực tiếp cho tài xế sau khi hoàn thành chuyến đi",
  scopeNotice: "Áp dụng cho lịch trình và gói phục vụ đã xác nhận. Yêu cầu thay đổi ngoài phạm vi cần được GoViet247 báo giá và khách đồng ý trước khi thực hiện.",
};
export function destinationConfig(raw) { return { ...DEFAULT_DESTINATION_CONFIG, ...(raw || {}) }; }
export function destinationDescription(c, charter = false) {
  const values = charter ? { radius: c.charterRadiusKm, hours: c.charterHoursPerDay, start: hour(c.charterStartHour), end: hour(c.charterEndHour) } : { radius: c.standardRadiusKm, trips: c.standardTripsPerDay };
  return (charter ? c.charterDescription : c.standardDescription).replace(/\{(\w+)\}/g, (all, key) => values[key] ?? all);
}
const hour = h => String(h).padStart(2, "0") + ":00";
export const vnDay = value => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 10);
export const vnTime = value => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(11, 16);
// The last itinerary stop is the confirmed lodging anchor; local stops never move it.
export function destinationWindows(c, direction, pickup, returnTime, outboundMinutes) {
  if (!c.enabled || direction !== "ROUND_TRIP" || !pickup || !returnTime || outboundMinutes == null) return [];
  const arrival = new Date(pickup).getTime() + Number(outboundMinutes) * 60000;
  const end = new Date(returnTime).getTime();
  if (!Number.isFinite(arrival) || !Number.isFinite(end) || end <= arrival || vnDay(arrival) === vnDay(end)) return [];
  const result = [];
  for (let day = Date.parse(vnDay(arrival) + "T00:00:00+07:00"), n = 0; day < end && n < 366; day += 86400000, n++) {
    const start = Math.max(arrival, day + c.charterStartHour * 3600000);
    const finish = Math.min(end, day + c.charterEndHour * 3600000);
    if (finish > start) result.push({ date: vnDay(start), start: new Date(start).toISOString(), end: new Date(finish).toISOString(), hours: Math.min(c.charterHoursPerDay, Math.round((finish-start)/36000)/100), flexible: true, fee: Math.round(c.charterDailyFee * (finish-start) / ((c.charterEndHour-c.charterStartHour)*3600000)) });
  }
  return result;
}
// Every itinerary date remains visible even when no charter interval is available.
export function destinationDays(c, direction, pickup, returnTime, outboundMinutes) {
  if (!c.enabled || direction !== 'ROUND_TRIP' || !pickup || !returnTime || outboundMinutes == null) return [];
  const arrival = new Date(pickup).getTime() + Number(outboundMinutes) * 60000;
  const end = new Date(returnTime).getTime();
  if (!Number.isFinite(arrival) || !Number.isFinite(end) || end <= arrival || vnDay(arrival) === vnDay(end)) return [];
  const charter = new Map(destinationWindows(c, direction, pickup, returnTime, outboundMinutes).map(w => [w.date, w]));
  const days = [];
  for (let day = Date.parse(vnDay(arrival) + 'T00:00:00+07:00'), n = 0; day <= Date.parse(vnDay(end) + 'T00:00:00+07:00') && n < 367; day += 86400000, n++) {
    const date = vnDay(day), start = Math.max(arrival, day + c.standardStartHour * 3600000), finish = Math.min(end, day + c.standardEndHour * 3600000);
    days.push({ date, standardStart: finish > start ? new Date(start).toISOString() : null, standardEnd: finish > start ? new Date(finish).toISOString() : null, charter: charter.get(date) || null });
  }
  return days;
}
export function destinationDayText(day, selected, c) {
  if (selected && day.charter) return `${vnTime(day.charter.start)}–${vnTime(day.charter.end)} · Tối đa ${day.charter.hours} giờ`;
  return day.standardStart ? `${vnTime(day.standardStart)}–${vnTime(day.standardEnd)}` : '';
}
export function destinationSelectedFee(days, dates) {
  return days.reduce((sum, day) => sum + (dates.includes(day.date) ? Number(day.charter?.fee || 0) : 0), 0);
}
export function destinationSessionText(session) {
  return session.flexible ? `${vnTime(session.start)}–${vnTime(session.end)} · Tối đa ${session.hours} giờ` : `${vnTime(session.start)}–${vnTime(session.end)} (${session.hours} giờ)`;
}
// Old trips can contain a partial charter schedule. Keep its scope honest
// without showing prices or a day-by-day list in customer/driver summaries.
export function destinationSelection(snapshot) {
  if (["STANDARD", "CHARTER"].includes(snapshot?.selectionMode)) return snapshot.selectionMode;
  const sessions = Array.isArray(snapshot?.sessions) ? snapshot.sessions : [];
  if (!sessions.length) return "STANDARD";
  const days = Array.isArray(snapshot?.days) ? snapshot.days : [];
  const eligibleDays = days.filter(day => Object.hasOwn(day, "charter") ? Boolean(day.charter) : true);
  const selected = new Set(sessions.map(session => session.date));
  return eligibleDays.length && eligibleDays.every(day => selected.has(day.date)) ? "CHARTER" : "LEGACY_MIXED";
}
export function destinationPackageLabel(snapshot) {
  const selection = destinationSelection(snapshot);
  const standard = snapshot?.standardName || DEFAULT_DESTINATION_CONFIG.standardName;
  const charter = snapshot?.charterName || DEFAULT_DESTINATION_CONFIG.charterName;
  return selection === "STANDARD" ? standard : selection === "CHARTER" ? charter : `${charter} theo lịch đã xác nhận`;
}
export function destinationSummary(snapshot) {
  const terms = snapshot || {}, rows = [];
  if (terms.eligible) {
    const selection = destinationSelection(terms);
    rows.push(terms.title, destinationPackageLabel(terms));
    if (selection !== "CHARTER") rows.push(terms.standardDescription, `Giờ hỗ trợ ${terms.standardName}: ${terms.standardWindow}`);
    if (selection !== "STANDARD") rows.push(terms.charterDescription);
    rows.push(terms.outsideNotice);
  }
  return [...rows.filter(Boolean),
    terms.allInclusiveNotice || DEFAULT_DESTINATION_CONFIG.allInclusiveNotice,
    terms.paymentNotice || DEFAULT_DESTINATION_CONFIG.paymentNotice,
    terms.scopeNotice || DEFAULT_DESTINATION_CONFIG.scopeNotice];
}

// Quote notices apply to every trip, independently of destination package eligibility.
export function destinationQuoteSummary(snapshot, config) {
  if (snapshot?.eligible === true) return destinationSummary(snapshot);
  const c = destinationConfig(config);
  return [snapshot?.allInclusiveNotice || c.allInclusiveNotice, snapshot?.paymentNotice || c.paymentNotice];
}

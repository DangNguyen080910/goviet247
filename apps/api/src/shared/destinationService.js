export const DEFAULT_DESTINATION_CONFIG = {
  enabled: true,
  title: "Nhu cầu sử dụng xe tại điểm đến",
  introduction: "Áp dụng cho chuyến khứ hồi có lưu trú qua đêm hoặc nhiều ngày.",
  standardName: "Tiêu chuẩn",
  standardDescription: "Hỗ trợ đi ăn sáng, trưa, tối; tối đa {trips} lượt khứ hồi/ngày trong phạm vi {radius} km theo đường ô tô tính từ nơi lưu trú đã xác nhận. Mỗi lượt đến một địa điểm ăn uống rồi quay về. Không cộng dồn lượt; không bao gồm tham quan, mua sắm. Ngày đến/về chỉ hỗ trợ các bữa trong thời gian lưu trú thực tế. Thống nhất giờ đón và đón về trước mỗi lượt.",
  standardRadiusKm: 5, standardTripsPerDay: 3, standardStartHour: 7, standardEndHour: 21,
  charterName: "Bao xe tại điểm đến",
  charterDescription: "Bao gồm đi ăn uống, tham quan, mua sắm trong phạm vi {radius} km theo đường ô tô tính từ nơi lưu trú đã xác nhận; tối đa {hours} giờ/ngày, trong khung {start}–{end}. Thời gian phục vụ gồm di chuyển và chờ. Khách và tài xế thống nhất các điểm chính và khoảng nghỉ trước mỗi ngày; tài xế phục vụ đúng lịch đã xác nhận. Vé tham quan và chi tiêu cá nhân của khách không bao gồm trong giá.",
  charterRadiusKm: 30, charterHoursPerDay: 8, charterStartHour: 7, charterEndHour: 21, charterDailyFee: 800000,
  outsideNotice: "Muốn đi ngoài phạm vi, vui lòng thêm điểm đến trước khi tính giá. Điểm thêm không trở thành mốc mở rộng phạm vi phục vụ. Chuyến đã đặt cần liên hệ GoViet247 xác nhận lịch trình và giá cập nhật trước khi thực hiện.",
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
    const finish = Math.min(end, day + c.charterEndHour * 3600000, start + c.charterHoursPerDay * 3600000);
    if (finish > start) result.push({ date: vnDay(start), start: new Date(start).toISOString(), end: new Date(finish).toISOString(), hours: Math.round((finish-start)/36000)/100 });
  }
  return result;
}
export function destinationSummary(snapshot) {
  const terms = snapshot || {};
  const rows = [];
  if (terms.eligible) {
    rows.push(snapshot.title, "Mốc phục vụ: " + snapshot.anchorAddress, snapshot.standardName + " — Đã bao gồm trong giá", snapshot.standardDescription, `Giờ hỗ trợ Tiêu chuẩn: ${snapshot.standardWindow}`);
    if (snapshot.sessions.length) {
      rows.push(snapshot.charterName, snapshot.charterDescription);
      for (const s of snapshot.sessions) rows.push(`${s.date}: ${vnTime(s.start)}–${vnTime(s.end)} (${s.hours} giờ)`);
      rows.push(`Phụ phí: ${snapshot.sessions.length} ngày × ${snapshot.dailyFee.toLocaleString("vi-VN")}đ = ${snapshot.fee.toLocaleString("vi-VN")}đ. Ngày không chọn Bao xe áp dụng Tiêu chuẩn.`);
    }
    rows.push(snapshot.outsideNotice);
  }
  return [
    ...rows,
    terms.allInclusiveNotice || DEFAULT_DESTINATION_CONFIG.allInclusiveNotice,
    terms.paymentNotice || DEFAULT_DESTINATION_CONFIG.paymentNotice,
    terms.scopeNotice || DEFAULT_DESTINATION_CONFIG.scopeNotice,
  ];
}

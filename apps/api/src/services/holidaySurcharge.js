// Date-only strings deliberately avoid converting an admin calendar date to UTC.
export function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateHolidayConfig(config) {
  const percent = Number(config.holidaySurchargePercent ?? 0);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100 || Math.abs(percent * 100 - Math.round(percent * 100)) > 0.000001) {
    return "Phụ thu lễ, Tết phải từ 0 đến 100%, tối đa 2 chữ số thập phân.";
  }
  const start = config.holidayStartDate;
  const end = config.holidayEndDate;
  if ((start != null && !isCalendarDate(start)) || (end != null && !isCalendarDate(end))) return "Ngày áp dụng phụ thu lễ, Tết không hợp lệ.";
  if ((start && !end) || (!start && end) || (percent > 0 && (!start || !end))) return "Vui lòng chọn đủ ngày bắt đầu và ngày kết thúc phụ thu lễ, Tết.";
  if (start && end && start > end) return "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  for (const [field, max] of [["holidayName", 100], ["holidayNote", 500]]) {
    if (config[field] != null && (typeof config[field] !== "string" || config[field].length > max)) return `Nội dung lễ, Tết không hợp lệ (giới hạn ${max} ký tự).`;
  }
  return "";
}

const calendarVN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
});
function dateVN(date) {
  const parts = Object.fromEntries(calendarVN.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const displayDate = date => date.split("-").reverse().join("/");

export function calculateHolidaySurcharge(config, pickup, basePrice) {
  const percent = Number(config.holidaySurchargePercent ?? 0);
  if (validateHolidayConfig(config) || percent <= 0 || !Number.isFinite(pickup?.getTime()) || !Number.isFinite(basePrice) || basePrice < 0) return null;
  const day = dateVN(pickup);
  if (day < config.holidayStartDate || day > config.holidayEndDate) return null;
  const name = (config.holidayName || "").trim();
  const note = (config.holidayNote || "").trim();
  const description = `Áp dụng cho chuyến khởi hành từ ${displayDate(config.holidayStartDate)} đến hết ${displayDate(config.holidayEndDate)}${name ? ` nhân dịp ${name}` : ""}.${note ? ` ${note}` : ""}`;
  return {
    percent, amount: Math.round(basePrice * percent / 100), basePrice,
    startDate: config.holidayStartDate, endDate: config.holidayEndDate,
    name, note, description,
  };
}

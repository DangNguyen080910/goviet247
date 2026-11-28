import { createHash } from "node:crypto";
import { destinationConfig, destinationDescription, destinationWindows, destinationDays, destinationPackageAvailable, charterPricingHours, charterTripFee, destinationSelection } from "../shared/destinationService.js";
export { destinationConfig };
export function validateDestinationConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Cấu hình phục vụ không hợp lệ.";
  const c = destinationConfig(raw);
  if (typeof c.enabled !== "boolean") return "Trạng thái không hợp lệ.";
  for (const key of ["title", "introduction", "standardName", "standardDescription", "charterName", "charterDescription", "outsideNotice", "allInclusiveNotice", "paymentNotice", "scopeNotice"]) if (typeof c[key] !== "string" || !c[key].trim() || c[key].length > 3000) return `${key}: cần nội dung từ 1 đến 3000 ký tự.`;
  for (const [key, min, max] of [["standardRadiusKm",1,500],["standardTripsPerDay",1,10],["charterRadiusKm",1,500],["charterHoursPerDay",1,24],["charterDailyFee",0,100000000],["standardStartHour",0,23],["standardEndHour",1,24],["charterStartHour",0,23],["charterEndHour",1,24]]) if (!Number.isInteger(c[key]) || c[key]<min || c[key]>max) return `${key}: phải là số nguyên từ ${min} đến ${max}.`;
  if (c.standardEndHour <= c.standardStartHour) return "Khung giờ gói Không bao xe không hợp lệ.";
  if (charterPricingHours(c) === null) return "Giờ kết thúc Bao xe phải sau giờ bắt đầu.";
  if (Object.keys(raw).some(key => !(key in c) || !Object.hasOwn(destinationConfig(), key))) return "Có trường cấu hình không hợp lệ.";
  return "";
}
function buildLegacyDestinationSnapshot(raw, input) {
  const c = destinationConfig(raw);
  const windows = destinationWindows(c, input.direction, input.pickupTime, input.returnTime, input.outboundDriveMinutes);
  if (input.returnTime && new Date(input.returnTime)-new Date(input.pickupTime)>366*86400000) throw Object.assign(new Error("Thời gian chuyến không được vượt quá 366 ngày."),{status:400});
  const selectionMode = input.destinationServiceMode;
  if (selectionMode !== undefined && !["STANDARD", "CHARTER"].includes(selectionMode)) throw Object.assign(new Error("Vui lòng chọn Tiêu chuẩn hoặc Bao xe."), {status:400});
  if (selectionMode === "CHARTER" && !windows.length) throw Object.assign(new Error("Chuyến này chưa có khung phục vụ Bao xe phù hợp."), {status:400});
  // New clients select one package for the entire stay. Derive every eligible
  // service date on the server; client dates cannot shorten a charter package.
  // Omitted mode retains released clients' and held quotes' legacy semantics.
  const dates = selectionMode === "CHARTER" ? windows.map(window => window.date)
    : selectionMode === "STANDARD" ? [] : input.destinationServiceDates ?? [];
  if (!Array.isArray(dates) || dates.some(d => typeof d !== "string") || new Set(dates).size !== dates.length || dates.length > 366) throw Object.assign(new Error("Ngày Bao xe không hợp lệ."), { status: 400 });
  const sessions = dates.map(date => windows.find(w => w.date === date));
  if (sessions.some(s => !s)) throw Object.assign(new Error("Ngày Bao xe phải nằm trong thời gian lưu trú và khung giờ phục vụ."), { status: 400 });
  sessions.sort((a,b) => a.start.localeCompare(b.start));
  const anchorAddress = String(input.destinationAnchorAddress || input.dropoffAddress || "Điểm đến cuối cùng trong lịch trình").trim();
  if (windows.length && !anchorAddress) throw Object.assign(new Error("Vui lòng xác nhận nơi lưu trú tại điểm đến."), {status:400});
  return { version: selectionMode === undefined ? 3 : 4, ...(selectionMode === undefined ? {} : {selectionMode}), days: destinationDays(c, input.direction, input.pickupTime, input.returnTime, input.outboundDriveMinutes), eligible: windows.length>0, title:c.title, anchorAddress,
    standardRadiusKm:c.standardRadiusKm, standardName:c.standardName, standardDescription:destinationDescription(c),
    standardWindow:`${String(c.standardStartHour).padStart(2,"0")}:00–${String(c.standardEndHour).padStart(2,"0")}:00`,
    charterName:c.charterName, charterDescription:destinationDescription(c,true),
    sessions, dailyFee:c.charterDailyFee, fee:sessions.reduce((sum, session) => sum + session.fee, 0),
    outsideNotice:c.outsideNotice, allInclusiveNotice:c.allInclusiveNotice, paymentNotice:c.paymentNotice, scopeNotice:c.scopeNotice };
}
export function buildDestinationSnapshot(raw, input) {
  if (input.destinationServiceMode === undefined) return buildLegacyDestinationSnapshot(raw, input);
  const c = destinationConfig(raw);
  if (input.returnTime && new Date(input.returnTime)-new Date(input.pickupTime)>366*86400000) throw Object.assign(new Error("Thời gian chuyến không được vượt quá 366 ngày."),{status:400});
  const requestedMode = input.destinationServiceMode;
  if (!["STANDARD", "CHARTER"].includes(requestedMode)) {
    throw Object.assign(new Error("Vui lòng chọn Không bao xe hoặc Bao xe."), { status: 400 });
  }
  const selectionMode = requestedMode;
  const eligible = destinationPackageAvailable(c, input.direction, input.pickupTime, input.returnTime, input.outboundDriveMinutes);
  const charter = selectionMode === "CHARTER";
  if (charter && !eligible) throw Object.assign(new Error("Chuyến này chưa đủ lịch trình để tính Bao xe."), { status: 400 });
  const anchorAddress = String(input.destinationAnchorAddress || input.dropoffAddress || "Điểm đến cuối cùng trong lịch trình").trim();
  if (eligible && !anchorAddress) throw Object.assign(new Error("Vui lòng xác nhận điểm đến."), { status: 400 });
  const days = destinationDays(c, input.direction, input.pickupTime, input.returnTime, input.outboundDriveMinutes, true);
  const sessions = charter ? days.map(day => day.charter).filter(Boolean) : [];
  return { version: 5, selectionMode, days, eligible, title:c.title, anchorAddress,
    standardRadiusKm:c.standardRadiusKm, standardName:c.standardName, standardDescription:destinationDescription(c),
    standardWindow:`${String(c.standardStartHour).padStart(2,"0")}:00–${String(c.standardEndHour).padStart(2,"0")}:00`,
    charterName:c.charterName, charterDescription:destinationDescription(c,true),
    sessions, dailyFee:c.charterDailyFee,
    fee: charter ? charterTripFee(c, sessions) : 0,
    outsideNotice:c.outsideNotice, allInclusiveNotice:c.allInclusiveNotice, paymentNotice:c.paymentNotice, scopeNotice:c.scopeNotice };
}
export const destinationSignature = snapshot => {
  // Display metadata does not change the customer's quoted service selection.
  const { tourDisplay, ...terms } = snapshot;
  return createHash("sha256").update(JSON.stringify(terms)).digest("hex");
};
export function assertDestinationQuote(input, snapshot, issuedSignature) {
  // Held quotes retain the server-issued signature. JSONB may reorder snapshot keys;
  // hashing the deserialized object would reject unchanged quotes. Never use a client
  // value for issuedSignature. Freshly calculated quotes retain the legacy hash.
  const expected = issuedSignature ?? destinationSignature(snapshot);
  if (input.destinationServiceSignature && input.destinationServiceSignature !== expected) throw Object.assign(new Error("Điều kiện phục vụ đã thay đổi. Vui lòng tính giá lại trước khi đặt."), { status:409 });
  if (!input.destinationServiceSignature && (destinationSelection(snapshot) === "CHARTER" || snapshot.sessions?.length)) throw Object.assign(new Error("Vui lòng tính giá Bao xe trước khi đặt."), {status:409});
}

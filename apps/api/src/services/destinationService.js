import { createHash } from "node:crypto";
import { destinationConfig, destinationDescription, destinationWindows } from "../shared/destinationService.js";
export { destinationConfig };
export function validateDestinationConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Cấu hình phục vụ không hợp lệ.";
  const c = destinationConfig(raw);
  if (typeof c.enabled !== "boolean") return "Trạng thái không hợp lệ.";
  for (const key of ["title", "introduction", "standardName", "standardDescription", "charterName", "charterDescription", "outsideNotice", "allInclusiveNotice", "paymentNotice", "scopeNotice"]) if (typeof c[key] !== "string" || !c[key].trim() || c[key].length > 3000) return `${key}: cần nội dung từ 1 đến 3000 ký tự.`;
  for (const [key, min, max] of [["standardRadiusKm",1,500],["standardTripsPerDay",1,10],["charterRadiusKm",1,500],["charterHoursPerDay",1,24],["charterDailyFee",0,100000000],["standardStartHour",0,23],["standardEndHour",1,24],["charterStartHour",0,23],["charterEndHour",1,24]]) if (!Number.isInteger(c[key]) || c[key]<min || c[key]>max) return `${key}: phải là số nguyên từ ${min} đến ${max}.`;
  if (c.standardEndHour <= c.standardStartHour || c.charterEndHour <= c.charterStartHour || c.charterHoursPerDay > c.charterEndHour-c.charterStartHour) return "Khung giờ phục vụ không hợp lệ hoặc số giờ vượt khung phục vụ.";
  if (Object.keys(raw).some(key => !(key in c) || !Object.hasOwn(destinationConfig(), key))) return "Có trường cấu hình không hợp lệ.";
  return "";
}
export function buildDestinationSnapshot(raw, input) {
  const c = destinationConfig(raw);
  const windows = destinationWindows(c, input.direction, input.pickupTime, input.returnTime, input.outboundDriveMinutes);
  if (input.returnTime && new Date(input.returnTime)-new Date(input.pickupTime)>366*86400000) throw Object.assign(new Error("Thời gian chuyến không được vượt quá 366 ngày."),{status:400});
  const dates = input.destinationServiceDates ?? [];
  if (!Array.isArray(dates) || dates.some(d => typeof d !== "string") || new Set(dates).size !== dates.length || dates.length > 366) throw Object.assign(new Error("Ngày Bao xe không hợp lệ."), { status: 400 });
  const sessions = dates.map(date => windows.find(w => w.date === date));
  if (sessions.some(s => !s)) throw Object.assign(new Error("Ngày Bao xe phải nằm trong thời gian lưu trú và khung giờ phục vụ."), { status: 400 });
  sessions.sort((a,b) => a.start.localeCompare(b.start));
  const anchorAddress = String(input.destinationAnchorAddress || input.dropoffAddress || "Điểm đến cuối cùng trong lịch trình").trim();
  if (windows.length && !anchorAddress) throw Object.assign(new Error("Vui lòng xác nhận nơi lưu trú tại điểm đến."), {status:400});
  return { version: 1, eligible: windows.length>0, title:c.title, anchorAddress,
    standardName:c.standardName, standardDescription:destinationDescription(c),
    standardWindow:`${String(c.standardStartHour).padStart(2,"0")}:00–${String(c.standardEndHour).padStart(2,"0")}:00`,
    charterName:c.charterName, charterDescription:destinationDescription(c,true),
    sessions, dailyFee:c.charterDailyFee, fee:sessions.length*c.charterDailyFee,
    outsideNotice:c.outsideNotice, allInclusiveNotice:c.allInclusiveNotice, paymentNotice:c.paymentNotice, scopeNotice:c.scopeNotice };
}
export const destinationSignature = snapshot => createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
export function assertDestinationQuote(input, snapshot) {
  if (input.destinationServiceSignature && input.destinationServiceSignature !== destinationSignature(snapshot)) throw Object.assign(new Error("Điều kiện phục vụ đã thay đổi. Vui lòng tính giá lại trước khi đặt."), { status:409 });
  if (snapshot.sessions.length && !input.destinationServiceSignature) throw Object.assign(new Error("Vui lòng tính giá Bao xe trước khi đặt."), {status:409});
}

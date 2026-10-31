export const VEHICLE_FUELS = ["ELECTRIC", "GASOLINE"];
export function fuelMatches(preference, vehicleFuelType) {
  return !preference || preference === "ANY" || VEHICLE_FUELS.includes(preference) && vehicleFuelType === preference;
}
export function availableFuelWhere(vehicleFuelType) {
  return { fuelPreference: { in: VEHICLE_FUELS.includes(vehicleFuelType) ? ["ANY", vehicleFuelType] : ["ANY"] } };
}
export function assertDriverFuel(trip, profile) {
  if (fuelMatches(trip.fuelPreference, profile.vehicleFuelType)) return;
  const required = trip.fuelPreference === "GASOLINE" ? "xe xăng" : "xe điện";
  if (!VEHICLE_FUELS.includes(profile.vehicleFuelType)) throw Object.assign(new Error(`Chuyến yêu cầu ${required}, nhưng hồ sơ xe của anh/chị chưa cập nhật loại nhiên liệu. Vui lòng liên hệ GoViet247 bổ sung trước khi nhận.`), {code:"FUEL_TYPE_REQUIRED",statusCode:409});
  throw Object.assign(new Error(`Chuyến này yêu cầu ${required}. Loại nhiên liệu trong hồ sơ xe của anh/chị không phù hợp nên không thể nhận chuyến.`), {code:"FUEL_MISMATCH",statusCode:409});
}

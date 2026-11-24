export type TripVehicle = {
  vehicleType: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehicleFuelType: string | null;
  vehicleYear: number | null;
  plateNumber: string | null;
};
export type TripVehicleBinding = { driverId: string | null; driverVehicle: TripVehicle | null };
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

export function mapTripVehicle(raw: unknown): TripVehicleBinding {
  const trip = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const driverId = text(trip.driverId) || text(trip.driver?.id);
  const profile = trip.driverVehicle || trip.driver?.driverProfile;
  // A trip's carType/fuelPreference describe the customer's request, never the driver's actual vehicle.
  if (!profile || typeof profile !== "object") return { driverId, driverVehicle: null };
  const year = Number(profile.vehicleYear);
  return { driverId, driverVehicle: {
    vehicleType: text(profile.vehicleType), vehicleBrand: text(profile.vehicleBrand),
    vehicleModel: text(profile.vehicleModel), vehicleColor: text(profile.vehicleColor),
    vehicleFuelType: text(profile.vehicleFuelType), plateNumber: text(profile.plateNumber),
    vehicleYear: profile.vehicleYear != null && Number.isInteger(year) && year >= 1980 && year <= 2200 ? year : null,
  } };
}

export function vehicleTypeLabel(value: unknown): string {
  const raw = text(value);
  if (!raw) return "Chưa cập nhật";
  const seats = raw.match(/^(?:CAR_|XE\s*)?(4|5|7|16)(?:\s*CHỖ)?$/iu)?.[1];
  return seats ? `Xe ${seats} chỗ` : raw;
}
export function vehicleFuelLabel(value: unknown, requested = false): string {
  const fuel = text(value)?.toUpperCase();
  if (fuel === "ELECTRIC") return "Xe điện";
  if (fuel === "GASOLINE") return "Xe xăng";
  if (requested && (!fuel || fuel === "ANY")) return "Không yêu cầu nhiên liệu";
  return text(value) || "Chưa cập nhật";
}
export function tripVehicleRows(raw: unknown): { hasDriver: boolean; request: string; rows: [string, string][] } {
  const trip = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const { driverId, driverVehicle: vehicle } = mapTripVehicle(trip);
  return {
    hasDriver: Boolean(driverId || vehicle),
    request: `${vehicleTypeLabel(trip.carType)} · ${vehicleFuelLabel(trip.fuelPreference, true)}`,
    rows: !vehicle ? [] : [
      ["Loại xe tài xế", vehicleTypeLabel(vehicle.vehicleType)],
      ["Hãng / Dòng xe", [vehicle.vehicleBrand, vehicle.vehicleModel].filter(Boolean).join(" · ") || "Chưa cập nhật"],
      ["Màu xe", vehicle.vehicleColor || "Chưa cập nhật"],
      ["Đời xe", vehicle.vehicleYear ? String(vehicle.vehicleYear) : "Chưa cập nhật"],
      ["Nhiên liệu xe tài xế", vehicleFuelLabel(vehicle.vehicleFuelType)],
      ["Biển số", vehicle.plateNumber || "Chưa cập nhật"],
    ],
  };
}

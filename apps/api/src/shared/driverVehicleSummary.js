// Both Admin clients show the driver's registered vehicle, independently of the customer's request.
export function driverVehicleSummary(trip) {
  const vehicle = trip?.driverVehicle || trip?.driver?.driverProfile || {};
  const rawType = typeof vehicle.vehicleType === 'string' ? vehicle.vehicleType.trim() : '';
  const seats = rawType.match(/^(?:CAR_|XE\s*)?(4|5|7|16)(?:\s*CHỖ)?$/iu)?.[1];
  const type = seats ? `Xe ${seats} chỗ` : rawType || 'Loại xe: Chưa cập nhật';
  const fuel = {ELECTRIC:'Xe điện',GASOLINE:'Xe xăng'}[String(vehicle.vehicleFuelType || '').toUpperCase()]
    || 'Nhiên liệu: Chưa cập nhật';
  const year = Number(vehicle.vehicleYear);
  const vintage = Number.isInteger(year) && year >= 1980 && year <= 2200
    ? `Đời ${year}` : 'Đời xe: Chưa cập nhật';
  return `${type} · ${fuel} · ${vintage}`;
}

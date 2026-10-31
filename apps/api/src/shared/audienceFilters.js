export function matchesAudienceFilters(driver, carType = "", fuelType = "") {
  return (!carType || driver.carType === carType) && (!fuelType || driver.vehicleFuelType === fuelType);
}
export function audienceFilterIds(drivers, carType = "", fuelType = "") {
  if (!carType && !fuelType) return [];
  return drivers.filter(driver => matchesAudienceFilters(driver, carType, fuelType)).map(driver => driver.userId);
}

// Operational groups for the current 34-province catalogue. Not live location.
export const AUDIENCE_REGIONS = [
  { value: 'NORTH', label: 'Miền Bắc', provinceCodes: ['01','04','08','11','12','14','15','19','20','22','24','25','31','33','37'] },
  { value: 'CENTRAL', label: 'Miền Trung', provinceCodes: ['38','40','42','44','46','48','51','52','56','66','68'] },
  { value: 'SOUTH', label: 'Miền Nam', provinceCodes: ['75','79','80','82','86','91','92','96'] },
  { value: 'UNCONFIRMED', label: 'Chưa xác nhận khu vực', provinceCodes: [] },
];
export function driverAudienceRegion(driver) {
  if (!driver.operatingProvinceConfirmedAt) return 'UNCONFIRMED';
  return AUDIENCE_REGIONS.find(region => region.provinceCodes.includes(driver.operatingProvinceCode))?.value || 'UNCONFIRMED';
}
export function parseAudienceRegions(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > AUDIENCE_REGIONS.length ||
      value.some(region => !AUDIENCE_REGIONS.some(option => option.value === region))) {
    throw new Error('Miền nhận chuyến không hợp lệ. Vui lòng chọn lại.');
  }
  return [...new Set(value)];
}
export function matchesAudienceFilters(driver, carType = "", fuelType = "", regions = []) {
  return (!carType || driver.carType === carType) && (!fuelType || driver.vehicleFuelType === fuelType) &&
    (!regions.length || regions.includes(driverAudienceRegion(driver)));
}
export function audienceFilterIds(drivers, carType = "", fuelType = "", regions = []) {
  if (!carType && !fuelType && !regions.length) return [];
  return drivers.filter(driver => matchesAudienceFilters(driver, carType, fuelType, regions)).map(driver => driver.userId);
}

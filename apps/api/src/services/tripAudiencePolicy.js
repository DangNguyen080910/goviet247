export function audienceWhere(userId) {
  return { OR: [{ audienceDriverIds: { isEmpty: true } }, { audienceDriverIds: { has: userId } }] };
}
export function canDriverSeeTrip(trip, userId) {
  return Array.isArray(trip.audienceDriverIds) && (trip.audienceDriverIds.length === 0 || trip.audienceDriverIds.includes(userId));
}
export function parseAudience(value, maxCount = 100) {
  if (!Array.isArray(value) || !value.length || value.length > maxCount || value.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error(`Chọn từ 1 đến ${maxCount} tài xế hợp lệ.`);
  }
  return [...new Set(value)];
}
export function audienceCarType(vehicleType) {
  const value = String(vehicleType || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  if (['CAR_5', 'CAR_7', 'CAR_16'].includes(value)) return value;
  const match = /^(?:XE\s*)?(5|7|16)\s*(?:CHO|SEATS?)?$/.exec(value);
  return match ? `CAR_${match[1]}` : null;
}
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null || !Number.isFinite(Number(v)))) return Infinity;
  const rad = n => Number(n) * Math.PI / 180;
  const a = Math.sin(rad(lat2-lat1)/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lng2-lng1)/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1,a)));
}

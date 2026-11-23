import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AUDIENCE_REGIONS } from '../shared/audienceFilters.js';
import { PROVINCES } from './driverOperatingProvince.js';
import { getPlaceDetail } from './mapService.js';

export const REGIONAL_PRICING_DEFAULT = { NORTH: 0, CENTRAL: 0, SOUTH: 0 };
const regionKeys = Object.keys(REGIONAL_PRICING_DEFAULT);
const fail = (message, status = 400) => Object.assign(new Error(message), { status, code: 'REGIONAL_PRICING_ERROR' });
export function validateRegionalPricingConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== 3 || Object.keys(raw).some(key => !regionKeys.includes(key))) return 'Vui lòng nhập đủ ba mức điều chỉnh giá Bắc, Trung, Nam.';
  for (const key of regionKeys) {
    if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]) || raw[key] < 0 || raw[key] > 100 || Math.abs(raw[key] * 100 - Math.round(raw[key] * 100)) > 1e-8) return 'Mức điều chỉnh giá miền phải từ 0 đến 100%, tối đa hai số thập phân.';
  }
  return '';
}
export function regionalPricingConfig(raw) {
  if (raw == null) return { ...REGIONAL_PRICING_DEFAULT };
  const error = validateRegionalPricingConfig(raw);
  if (error) throw fail(error);
  return Object.fromEntries(regionKeys.map(key => [key, raw[key]]));
}

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
const provinceKey = value => normalize(value).replace(/^(?:tinh|thanh pho|tp)\.?\s*/, '').trim();
const provinceByName = new Map(PROVINCES.map(province => [provinceKey(province.name), province.code]));
// Old map-provider names resolve to the current 34-province catalogue.
const oldNames = {
  'Hà Giang':'08', 'Bắc Kạn':'19', 'Yên Bái':'15', 'Vĩnh Phúc':'25', 'Hòa Bình':'25',
  'Bắc Giang':'24', 'Hải Dương':'31', 'Thái Bình':'33', 'Hà Nam':'37', 'Nam Định':'37',
  'Quảng Bình':'44', 'Thừa Thiên Huế':'46', 'Quảng Nam':'48', 'Kon Tum':'51', 'Bình Định':'52',
  'Ninh Thuận':'56', 'Phú Yên':'66', 'Đắk Nông':'68', 'Bình Thuận':'68', 'Bình Phước':'75',
  'Bình Dương':'79', 'Bà Rịa - Vũng Tàu':'79', 'Bà Rịa Vũng Tàu':'79', 'Long An':'80',
  'Tiền Giang':'82', 'Bến Tre':'86', 'Trà Vinh':'86', 'Kiên Giang':'91', 'Hậu Giang':'92',
  'Sóc Trăng':'92', 'Bạc Liêu':'96', 'HCM':'79', 'Sài Gòn':'79',
};
for (const [name, code] of Object.entries(oldNames)) provinceByName.set(provinceKey(name), code);
export const provinceCodeForPricing = name => provinceByName.get(provinceKey(name)) || null;
export function provinceFromPlace(place) {
  const explicit = provinceCodeForPricing(place?.province);
  if (explicit) return explicit;
  const parts = String(place?.fullAddress || '').split(',').map(part => part.trim()).filter(Boolean);
  if (['viet nam', 'vietnam'].includes(normalize(parts.at(-1)))) parts.pop();
  return provinceCodeForPricing(parts.at(-1));
}

const localPlaces = JSON.parse(readFileSync(new URL('../data/regional-pricing-places.json', import.meta.url), 'utf8'));
const cache = new Map();
async function trustedPlace(placeId) {
  if (Object.prototype.hasOwnProperty.call(localPlaces, placeId)) return localPlaces[placeId];
  if (placeId.startsWith('goviet247:')) throw fail('Địa điểm chưa được hỗ trợ. Vui lòng chọn lại từ gợi ý bản đồ.');
  const cached = cache.get(placeId);
  if (cached && cached.expires > Date.now()) return cached.place;
  const place = await getPlaceDetail(placeId, { timeoutMs: 8000 });
  if (!place) throw fail('Không xác định được địa điểm. Vui lòng chọn lại từ gợi ý bản đồ.');
  if (cache.size >= 1000) cache.delete(cache.keys().next().value);
  cache.set(placeId, { place, expires: Date.now() + 15 * 60 * 1000 });
  return place;
}

export async function buildRegionalSurcharge(input, rawConfig, baseAmount, resolvePlace = trustedPlace) {
  const config = regionalPricingConfig(rawConfig);
  // Zero defaults keep older clients working until an admin explicitly enables this feature.
  if (!regionKeys.some(key => config[key] > 0)) return { version: 1, config, regions: [], provinces: [], appliedRegion: null, percent: 0, baseAmount, amount: 0 };
  const points = input.routePricingPoints;
  if (!Array.isArray(points) || points.length < 2 || points.length > 21) throw fail('Vui lòng cập nhật ứng dụng và chọn lại điểm đón, các điểm đến để tính giá.');
  if (points.some(point => !point || typeof point.placeId !== 'string' || !point.placeId.trim() || point.placeId.length > 1000 || typeof point.address !== 'string' || !point.address.trim() || point.address.length > 1000)) throw fail('Vui lòng chọn đầy đủ địa điểm từ gợi ý bản đồ.');
  // At booking, the priced route must be the complete route being saved, not a cheaper substitute.
  if (input.pickupAddress !== undefined) {
    const stops = Array.isArray(input.stops) ? input.stops : [input.dropoffAddress];
    const dropoff = normalize(input.dropoffAddress);
    const returningToPickup = input.direction === 'ROUND_TRIP' && dropoff === normalize(input.pickupAddress);
    if (dropoff && dropoff !== normalize(stops.at(-1)) && !returningToPickup) throw fail('Điểm đến cuối không khớp lộ trình. Vui lòng chọn lại địa điểm và tính giá lại.', 409);
    const addresses = [input.pickupAddress, ...stops].map(normalize);
    if (addresses.length !== points.length || addresses.some((address, index) => address !== normalize(points[index].address))) throw fail('Lộ trình đã thay đổi. Vui lòng chọn lại địa điểm và tính giá lại.', 409);
  }
  const codes = [];
  const resolved = new Map();
  // Deduplicate lookups, but validate every selected point. Only booked stops count, never pass-through provinces.
  for (const point of points) {
    if (!resolved.has(point.placeId)) {
      try { resolved.set(point.placeId, await resolvePlace(point.placeId)); }
      catch (error) { if (error.code === 'REGIONAL_PRICING_ERROR') throw error; throw fail('Chưa xác định được khu vực từ bản đồ. Vui lòng thử tính giá lại.', 503); }
    }
    const place = resolved.get(point.placeId);
    if (normalize(place?.fullAddress) !== normalize(point.address)) throw fail('Địa điểm đã thay đổi. Vui lòng chọn lại từ gợi ý bản đồ.', 409);
    const code = provinceFromPlace(place);
    if (!code) throw fail('Không xác định được tỉnh/thành của một địa điểm. Vui lòng chọn lại từ gợi ý bản đồ.');
    if (!codes.includes(code)) codes.push(code);
  }
  const provinces = PROVINCES.filter(province => codes.includes(province.code));
  const regions = AUDIENCE_REGIONS.filter(region => region.provinceCodes.some(code => codes.includes(code))).map(region => region.value);
  const appliedRegion = regions.reduce((best, region) => best === null || config[region] > config[best] ? region : best, null);
  const percent = appliedRegion ? config[appliedRegion] : 0;
  return { version: 1, config, regions, provinces, appliedRegion, percent, baseAmount, amount: Math.round(baseAmount * percent / 100) };
}

export const regionalPricingSignature = snapshot => createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
export function assertRegionalQuote(input, snapshot, issuedSignature) {
  // Use only the signature stored/calculated by the server, independent of JSONB key order.
  if ((snapshot?.percent > 0 || input.regionalPricingSignature) && input.regionalPricingSignature !== (issuedSignature ?? regionalPricingSignature(snapshot))) throw fail('Giá chuyến đã thay đổi. Vui lòng tính giá lại trước khi đặt.', 409);
}

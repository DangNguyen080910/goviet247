import { readFileSync } from "node:fs";
import { parseTripTime } from "../utils/tripTime.js";
import { createHash, randomBytes } from 'node:crypto';
import { autocomplete, getPlaceDetail, getRoute, getKnownMapPlace } from './mapService.js';
import { quotePrice } from './pricingService.js';
import { prisma } from '../utils/db.js';
import { provinceFromPlace } from './regionalPricing.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const clean = value => String(value || '').normalize('NFC').trim().replace(/\s+/g,' ');
const comparable = value => clean(value).toLocaleLowerCase('vi-VN').replace(/,?\s*(việt nam|viet nam|vietnam)$/u,'').replace(/\s*,\s*/g,',');
const localPlaces = JSON.parse(readFileSync(new URL('../data/booking-trusted-places.json',import.meta.url),'utf8'));
const normalizeInput = (input = {}) => ({...input,direction:input.direction || 'ONE_WAY',carType:input.carType || 'CAR_5'});
const fail = message => Object.assign(new Error(message),{status:409,code:'QUOTE_CHANGED'});
function itinerary(input) {
  const points = Array.isArray(input.routePricingPoints) ? input.routePricingPoints : [];
  const pickup = clean(input.pickupAddress || input.historyContext?.pickupAddress || points[0]?.address);
  const rawStops = input.stops || input.historyContext?.stops || points.slice(1).map(p=>p.address);
  if (!Array.isArray(rawStops)) throw fail('Danh sách điểm đến không hợp lệ.');
  const stops = rawStops.map(clean).filter(Boolean);
  if (!stops.length && input.dropoffAddress) stops.push(clean(input.dropoffAddress));
  if (input.dropoffAddress && stops.length && comparable(input.dropoffAddress) !== comparable(stops.at(-1))) throw fail('Điểm đến cuối không khớp lộ trình. Vui lòng tính giá lại.');
  return {pickup,stops,points};
}
export function quoteRequestHash(input) {
  input = normalizeInput(input);
  const {pickup,stops} = itinerary(input);
  const iso = value => {
    if (!value) return null;
    const date = parseTripTime(value);
    if (!Number.isFinite(date?.getTime())) throw fail('Ngày giờ chuyến không hợp lệ.');
    return date.toISOString();
  };
  return hash(JSON.stringify([comparable(pickup),stops.map(comparable),input.carType,input.direction,
    iso(input.pickupTime),iso(input.returnTime),input.fuelPreference || 'ANY',
    input.destinationServiceMode === undefined ? [...(input.destinationServiceDates || [])].sort() : {mode:input.destinationServiceMode},
    comparable(input.destinationAnchorAddress || input.dropoffAddress || stops.at(-1))]));
}
export function createBookingQuoteService({db = prisma, search = autocomplete, detail = getPlaceDetail, route = getRoute, price = quotePrice, knownPlace = getKnownMapPlace} = {}) {
  const placeCache = new Map();
  async function place(point, address) {
    if (address.length > 2000 || (point?.placeId != null && (typeof point.placeId !== 'string' || point.placeId.length > 1000))) throw fail('Địa chỉ không hợp lệ. Vui lòng chọn lại từ danh sách gợi ý.');
    const key = JSON.stringify([point?.placeId || '',address]);
    const cached = placeCache.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    let result;
    const canonicalId = value => { const id=String(value || ''); return /^(goong|vietmap)\|/.test(id) ? id : /^(auto|geocode|vm):/i.test(id) ? 'vietmap|'+id : 'goong|'+id; };
    const sameId = (a,b) => canonicalId(a)===canonicalId(b);
    const matchesAddress = place => [place?.fullAddress,place?.oldAddress,place?.newAddress].some(value=>value && comparable(value)===comparable(address));
    const local = point?.placeId ? localPlaces[point.placeId] : Object.values(localPlaces).find(matchesAddress);
    if (local && matchesAddress(local)) result = local;
    if (!result) result = knownPlace(address,point?.placeId);
    if (!result && point?.placeId && !point.placeId.startsWith('goviet247:')) {
      const found=await detail(point.placeId);
      if(matchesAddress(found))result=found;
    }
    if (!result) {
      const matches = await search(address);
      const match = matches.find(p => matchesAddress(p) && (!point?.placeId || sameId(p.placeId,point.placeId)));
      if(match?.placeId)result=await detail(match.placeId);
      // Store apps send a canonical address from Place Detail, without its place ID.
      // That text need not be identical to the autocomplete description.
      if(!result && !point?.placeId){
        for(const candidate of matches.slice(0,5)){
          if(!candidate?.placeId)continue;
          const found=await detail(candidate.placeId);
          if(matchesAddress(found)){result=found;break;}
        }
      }
    }
    if (!result || result.lat == null || result.lng == null || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lng)) || Math.abs(Number(result.lat)) > 90 || Math.abs(Number(result.lng)) > 180) throw fail('Chưa xác minh được địa chỉ. Vui lòng chọn lại địa chỉ từ danh sách gợi ý.');
    const value = {lat:Number(result.lat),lng:Number(result.lng),address,provinceCode:provinceFromPlace(result),name:String(result.name || "")};
    // The same verified canonical address is also reusable without a place ID
    // by legacy clients and the post-booking auto-approval worker.
    for (const cacheKey of new Set([key,JSON.stringify(['',address])])) {
      if (placeCache.size >= 1000 && !placeCache.has(cacheKey)) placeCache.delete(placeCache.keys().next().value);
      placeCache.set(cacheKey,{until:Date.now()+15*60000,value});
    }
    return value;
  }
  async function verifiedRoute(input) {
    input = normalizeInput(input);
    const pickupTime = parseTripTime(input.pickupTime);
    if (!Number.isFinite(pickupTime?.getTime())) throw fail('Ngày giờ đón không hợp lệ.');
    const {pickup,stops,points} = itinerary(input);
    if (!pickup || !stops.length || stops.length > 10) throw fail('Vui lòng chọn đầy đủ điểm đón và các điểm đến.');
    const addresses = [pickup,...stops];
    if (points.length && (points.length !== addresses.length || points.some((p,i)=>comparable(p.address)!==comparable(addresses[i])))) throw fail('Lộ trình đã thay đổi. Vui lòng tính giá lại.');
    if (!['ONE_WAY','ROUND_TRIP'].includes(input.direction)) throw fail('Loại chuyến không hợp lệ.');
    const back = parseTripTime(input.returnTime);
    if (input.direction === 'ROUND_TRIP' && (!Number.isFinite(back?.getTime()) || back <= pickupTime)) throw fail('Giờ bắt đầu quay về phải sau giờ đón khách.');
    const coords = (await Promise.all(addresses.map((address,i)=>place(points[i],address)))).map(({lat,lng})=>({lat,lng}));
    if (input.direction === 'ROUND_TRIP') coords.push(coords[0]);
    const found = await route(coords);
    if (!found || !Number.isFinite(found.distanceKm) || found.distanceKm <= 0 || !Number.isFinite(found.durationMinutes)) throw fail('Chưa xác minh được quãng đường. Vui lòng thử tính giá lại.');
    if (input.direction === 'ROUND_TRIP' && parseTripTime(input.returnTime)?.getTime() < pickupTime.getTime()+found.outboundDurationMinutes*60000) throw fail('Giờ quay về phải từ thời điểm xe dự kiến đã tới điểm đến trở đi.');
    return {pickupLat:coords[0].lat,pickupLng:coords[0].lng,dropoffLat:coords[stops.length].lat,dropoffLng:coords[stops.length].lng,distanceKm:found.distanceKm,driveMinutes:found.durationMinutes,
      totalDriveMinutes:found.durationMinutes,outboundDriveMinutes:found.outboundDurationMinutes,
      returnDriveMinutes:found.returnDurationMinutes,estimatedDurationMinutes:input.direction === 'ROUND_TRIP' ? Math.round((back-pickupTime)/60000)+found.returnDurationMinutes : found.durationMinutes};
  }
  function pricingSnapshot(data) {
    return {totalPrice:data.finalPrice,basePricePerKm:data.pricePerKm,holidayFactor:1+Number(data.holidaySurchargePercent || 0)/100,
      directionFactor:1,holidaySurcharge:data.holidaySurcharge,regionalSurcharge:data.regionalSurcharge,
      regionalPricingSignature:data.regionalPricingSignature,destinationService:data.destinationService,
      destinationServiceSignature:data.destinationServiceSignature,distanceKm:data.distanceKm};
  }
  async function issue(input, data, verified, token, seconds = 120) {
    token ||= randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now()+Math.max(1,Math.min(86400,Number(seconds)||120))*1000);
    await db.bookingQuote.create({data:{tokenHash:hash(token),requestHash:quoteRequestHash(input),route:verified,
      pricing:JSON.parse(JSON.stringify(pricingSnapshot(data))),expiresAt}});
    return {quoteToken:token,quoteExpiresAt:expiresAt.toISOString()};
  }
  async function booking(input) {
    input = normalizeInput(input);
    const token = input.quoteToken || input.quoteHistoryToken;
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
      const held = await db.bookingQuote.findUnique({where:{tokenHash:hash(token)}});
      if (held && held.expiresAt.getTime() > Date.now()) {
        if (held.requestHash !== quoteRequestHash(input)) throw fail('Thông tin chuyến đã thay đổi. Vui lòng tính giá lại.');
        return {pricing:held.pricing,route:held.route};
      }
      if (input.quoteToken) throw fail('Giá đã hết hạn. Vui lòng tính giá lại.');
    } else if (input.quoteToken) throw fail('Báo giá không hợp lệ. Vui lòng tính giá lại.');
    // Existing apps can book without a new field; still verify their addresses and route.
    const verified = await verifiedRoute(input);
    const result = await price({...input,...verified},db);
    if (!result.ok) throw Object.assign(new Error(result.message),{status:result.status || 400});
    return {pricing:pricingSnapshot(result.data),route:verified};
  }
  return {verifiedRoute,issue,booking,verifiedAddresses: addresses => Promise.all(addresses.map(address => place(null,clean(address))))};
}
export const bookingQuotes = createBookingQuoteService();
export function startBookingQuoteCleanup() {
  const timer = setInterval(()=>prisma.bookingQuote.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-3600000)}}})
    .catch(error=>console.error('[BookingQuotes] cleanup unavailable',error.code)),3600000);
  timer.unref();
}

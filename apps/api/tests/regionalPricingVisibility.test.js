import test from 'node:test';
import assert from 'node:assert/strict';
import { regionalPricingVisibility, withoutRegionalPricingDetails } from '../src/middleware/regionalPricingVisibility.js';
import { driverSurchargeLines } from '../src/shared/driverSurcharges.js';
import { regionalPricingLine } from '../src/shared/regionalPricing.js';
import { quotePrice } from '../src/services/pricingService.js';

const regional = { appliedRegion: 'NORTH', config: { NORTH: 10, CENTRAL: 5, SOUTH: 0 }, percent: 10, amount: 100000 };
const trip = {
  totalPrice: 1300000,
  driverReceive: 1200000,
  audienceRegions: ['NORTH', 'CENTRAL'],
  destinationService: { fee: 0, tourDisplay: { regionalSurcharge: regional, fuelSurchargePercent: 20, fuelSurchargeAmount: 200000 } },
};
function responseFor(path, body) {
  const res = { json(value) { this.body = value; return this; } };
  let proceeded = false;
  regionalPricingVisibility({ originalUrl: path }, res, () => { proceeded = true; });
  assert.ok(proceeded);
  assert.equal(res.json(body), res);
  return res.body;
}

test('Rider/Driver quote, booking, history and partner responses hide nested regional details without changing totals', () => {
  const date = new Date('2026-11-19T00:00:00Z');
  class Decimal { toJSON() { return '1300000'; } }
  const decimal = new Decimal();
  const original = {
    success: true, data: { ...trip, createdAt: date, fareEstimate: decimal, regionalSurcharge: regional, regionalPricingSignature: 'opaque-quote-signature' },
    items: [trip], tripConfig: { maxStops: 10, regionalPricingConfig: regional.config },
  };
  const before = JSON.stringify(original);
  for (const path of ['/api/pricing/quote', '/api/public/trips/quote', '/api/public/trips/config', '/api/public/trips/confirm-otp', '/api/trips', '/api/trips/my', '/api/trips/driver/available', '/api/trips/driver/my', '/api/partners/trips', '/api/driver/profile', '/API/TRIPS/driver/my', '/api/trips/my?returnUrl=/api/admin']) {
    const result = responseFor(path, original);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('regionalSurcharge'), path);
    assert.ok(!serialized.includes('regionalPricingConfig'), path);
    assert.ok(!serialized.includes('appliedRegion'), path);
    assert.equal(result.data.totalPrice, trip.totalPrice);
    assert.equal(result.data.driverReceive, trip.driverReceive);
    assert.equal(result.data.destinationService.tourDisplay.fuelSurchargeAmount, 200000);
    assert.equal(result.data.regionalPricingSignature, 'opaque-quote-signature');
    assert.deepEqual(result.data.audienceRegions, trip.audienceRegions);
    assert.equal(result.data.createdAt, date);
    assert.equal(result.data.fareEstimate, decimal);
    assert.equal(result.tripConfig.maxStops, 10);
    assert.equal(JSON.stringify(original), before, 'DB snapshot must stay intact');
  }
});

test('Admin Web/Mobile and legacy admin routes retain the original details', () => {
  const body = { items: [trip], item: { regionalPricingConfig: regional.config } };
  for (const path of ['/api/admin/trips', '/api/admin/trip-config', '/api/trips/admin/trips/assigned', '/API/TRIPS/ADMIN/trips/assigned']) {
    assert.equal(responseFor(path, body), body, path);
  }
});

test('driver and rider surcharge summaries omit regional adjustments even with a previously saved snapshot', () => {
  assert.deepEqual(driverSurchargeLines(trip), ['Đã gồm phụ thu xe xăng 20%: 200.000 đ']);
  assert.equal(regionalPricingLine(regional), 'Đã gồm điều chỉnh giá Miền Bắc 10%: 100.000 đ');
  assert.deepEqual(driverSurchargeLines({ destinationService: { tourDisplay: { regionalSurcharge: regional } } }), []);
  assert.equal(withoutRegionalPricingDetails(null), null);
});

test('positive regional price remains bookable after public redaction and retains its internal admin snapshot', async () => {
  const db = {
    pricingConfig: { findFirst: async () => ({ baseFare: 0, pricePerKm: 10000, pricePerHour: 0, minFare: 0, overnightFee: 0, overnightTriggerKm: 10000, overnightTriggerHours: 100 }) },
    tripConfig: { findFirst: async () => ({ regionalPricingConfig: regional.config }) },
  };
  const result = await quotePrice({ carType: 'CAR_5', direction: 'ONE_WAY', pickupTime: '2099-01-01T07:00:00+07:00', distanceKm: 100, driveMinutes: 120,
    routePricingPoints: [{ placeId: 'goviet247:province:tp-hcm', address: 'TP.HCM, Việt Nam' }, { placeId: 'goviet247:province:ha-noi', address: 'Hà Nội, Việt Nam' }],
  }, db);
  assert.equal(result.ok, true, result.message);
  const publicQuote = responseFor('/api/pricing/quote', { data: result.data }).data;
  assert.equal(publicQuote.finalPrice, 1100000);
  assert.equal(publicQuote.regionalSurcharge, undefined);
  assert.equal(publicQuote.destinationService.tourDisplay.regionalSurcharge, undefined);
  assert.equal(publicQuote.regionalPricingSignature, result.data.regionalPricingSignature);
  assert.equal(result.data.regionalSurcharge.amount, 100000);
  assert.equal(responseFor('/api/admin/trips', { trip: { destinationService: result.data.destinationService } }).trip.destinationService.tourDisplay.regionalSurcharge.amount, 100000);
});

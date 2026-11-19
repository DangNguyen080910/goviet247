import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRegionalSurcharge, regionalPricingConfig, validateRegionalPricingConfig, provinceCodeForPricing, provinceFromPlace, regionalPricingSignature, assertRegionalQuote } from '../src/services/regionalPricing.js';
import { regionalRoutePoints, regionalPricingLine } from '../src/shared/regionalPricing.js';
import { driverSurchargeLines } from '../src/shared/driverSurcharges.js';
import { quotePrice } from '../src/services/pricingService.js';
import { destinationConfig } from '../src/services/destinationService.js';
const config = { NORTH: 10, CENTRAL: 5, SOUTH: 0 };
const places = JSON.parse(readFileSync(new URL('../src/data/regional-pricing-places.json', import.meta.url), 'utf8'));
const point = id => ({ placeId: `goviet247:province:${id}`, address: places[`goviet247:province:${id}`].fullAddress });
const north = point('ha-noi'), central = point('da-nang'), south = point('tp-hcm');
const route = (...points) => ({ routePricingPoints: points });

test('defaults preserve the common fare and configuration rejects malformed, negative or excessive rates', () => {
  assert.deepEqual(regionalPricingConfig(null), { NORTH: 0, CENTRAL: 0, SOUTH: 0 });
  assert.equal(validateRegionalPricingConfig({ ...config, NORTH: 10.25 }), '');
  for (const invalid of [null, [], {}, { ...config, OTHER: 5 }, { ...config, NORTH: -1 }, { ...config, CENTRAL: 101 }, { ...config, SOUTH: '' }, { ...config, SOUTH: false }, { ...config, NORTH: NaN }, { ...config, NORTH: 0.001 }]) assert.ok(validateRegionalPricingConfig(invalid));
});

test('every trusted static place resolves to a province, including airport and legacy map names', () => {
  for (const [id, place] of Object.entries(places)) assert.ok(provinceFromPlace(place), `${id}: ${place.fullAddress}`);
  for (const [name, code] of [['Hà Nội','01'], ['TP.HCM','79'], ['Bình Dương','79'], ['Bà Rịa - Vũng Tàu','79'], ['Phú Yên','66'], ['Bình Thuận','68'], ['Thừa Thiên Huế','46'], ['Bạc Liêu','96']]) assert.equal(provinceCodeForPricing(name), code);
  assert.equal(provinceFromPlace({ fullAddress: 'Quán Hà Nội, Phường A, Đà Nẵng' }), '48');
  assert.equal(provinceFromPlace({ fullAddress: 'Quán Sài Gòn, địa điểm chưa rõ' }), null);
});

test('zero defaults work with older clients without making map requests', async () => {
  const saved = await buildRegionalSurcharge({}, null, 1000000, () => assert.fail('Map not needed'));
  assert.equal(saved.amount, 0); assert.equal(saved.percent, 0);
  assert.doesNotThrow(() => assertRegionalQuote({}, saved));
});

test('take the maximum selected region exactly once, regardless of direction, stop order or duplicates', async () => {
  for (const [points, percent] of [
    [[south, south], 0], [[south, central], 5], [[central, south], 5],
    [[south, north], 10], [[north, central, south, north], 10], [[south, central, central, central], 5],
  ]) {
    for (const direction of ['ONE_WAY', 'ROUND_TRIP']) {
      const result = await buildRegionalSurcharge({ ...route(...points), direction }, config, 1000000);
      assert.equal(result.percent, percent);
      assert.equal(result.amount, percent * 10000);
    }
  }
});

test('all selected stops are required and an unrelated driver region does not affect pricing', async () => {
  const points = [south, north, central];
  const input = { ...route(...points), pickupAddress: south.address, dropoffAddress: central.address, stops: [north.address, central.address], audienceRegions: ['SOUTH'] };
  assert.equal((await buildRegionalSurcharge(input, config, 1000000)).percent, 10);
  await assert.rejects(() => buildRegionalSurcharge({ ...input, ...route(south, central) }, config, 1000000), { status: 409 });
  await assert.rejects(() => buildRegionalSurcharge({ ...input, stops: [central.address, north.address] }, config, 1000000), { status: 409 });
  await assert.rejects(() => buildRegionalSurcharge({ ...route(south, south), pickupAddress: south.address, stops: [south.address], dropoffAddress: north.address }, config, 1000000), { status: 409 });
  const returning = { ...input, direction: 'ROUND_TRIP', dropoffAddress: south.address };
  assert.equal((await buildRegionalSurcharge(returning, config, 1000000)).percent, 10);
});

test('client-provided province labels cannot replace the server-resolved place', async () => {
  let calls = 0;
  const remote = { placeId: 'goong|remote', address: 'Điểm thật, Hà Nội', province: 'Hồ Chí Minh' };
  const result = await buildRegionalSurcharge(route(remote, remote), config, 1000000, async id => {
    calls++; assert.equal(id, remote.placeId); return { fullAddress: remote.address, province: 'Hà Nội' };
  });
  assert.equal(result.percent, 10); assert.equal(calls, 1);
  await assert.rejects(() => buildRegionalSurcharge(route(remote, remote), config, 1000000, async () => ({ fullAddress: 'Địa chỉ khác, Hà Nội', province: 'Hà Nội' })), { status: 409 });
});

test('missing, unknown, malformed and failed place lookups never default to the South', async () => {
  for (const input of [{}, route(north), route({ placeId: '', address: north.address }, south), route(...Array(22).fill(north))]) await assert.rejects(() => buildRegionalSurcharge(input, config, 1000000), { status: 400 });
  await assert.rejects(() => buildRegionalSurcharge(route({ placeId: 'goviet247:fake', address: 'fake' }, south), config, 1000000), { status: 400 });
  const p = { placeId: 'provider-id', address: 'Chưa rõ tỉnh' };
  await assert.rejects(() => buildRegionalSurcharge(route(p, p), config, 1000000, async () => ({ fullAddress: p.address })), { status: 400 });
  await assert.rejects(() => buildRegionalSurcharge(route(p, p), config, 1000000, async () => { throw new Error('Map unavailable'); }), { status: 503 });
});

test('regional signature rejects a missing quote or changed pricing; saved snapshots retain old fees', async () => {
  const saved = await buildRegionalSurcharge(route(south, north), config, 1000000);
  const input = { regionalPricingSignature: regionalPricingSignature(saved) };
  assert.doesNotThrow(() => assertRegionalQuote(input, saved));
  assert.throws(() => assertRegionalQuote({}, saved), { status: 409 });
  const changed = await buildRegionalSurcharge(route(south, north), { ...config, NORTH: 20 }, 1000000);
  assert.throws(() => assertRegionalQuote(input, changed), { status: 409 });
  assert.equal(saved.percent, 10); assert.equal(saved.amount, 100000);
});

const priceConfig = { baseFare: 0, pricePerKm: 10000, pricePerHour: 10000, minFare: 0, overnightFee: 300000,
  overnightTriggerKm: 10000, overnightTriggerHours: 100, gasolineSurchargePercent: 20,
  holidaySurchargePercent: 15, holidayStartDate: '2027-01-01', holidayEndDate: '2027-01-01', holidayName: 'Tết', holidayNote: '' };
const db = (regional = config, pricing = priceConfig) => ({ pricingConfig: { findFirst: async () => pricing }, tripConfig: { findFirst: async () => ({ regionalPricingConfig: regional, destinationServiceConfig: destinationConfig() }) } });
const request = { carType: 'CAR_5', direction: 'ONE_WAY', pickupTime: '2027-01-01T07:00:00+07:00', distanceKm: 100, driveMinutes: 120, ...route(south, north) };

test('regional, fuel and holiday adjustments share the base without compounding or charging twice', async () => {
  const result = await quotePrice({ ...request, fuelPreference: 'GASOLINE' }, db());
  assert.equal(result.ok, true, result.message);
  const d = result.data;
  assert.equal(d.priceBeforeFuelSurcharge, 1000000);
  assert.equal(d.fuelSurchargeAmount, 200000);
  assert.equal(d.holidaySurchargeAmount, 150000);
  assert.equal(d.regionalSurcharge.amount, 100000);
  assert.equal(d.finalPrice, 1450000);
  assert.deepEqual(d.destinationService.tourDisplay.regionalSurcharge, d.regionalSurcharge);
  assert.equal(driverSurchargeLines({ destinationService: d.destinationService }).length, 2);
  assert.equal(regionalPricingLine(d.regionalSurcharge), 'Đã gồm điều chỉnh giá Miền Bắc 10%: 100.000 đ');
});

test('regional changes leave the destination service fee separate and round only the final vehicle fare', async () => {
  const input = { ...request, direction: 'ROUND_TRIP', pickupTime: '2027-01-01T07:00:00+07:00', returnTime: '2027-01-03T12:00:00+07:00', outboundDriveMinutes: 120, driveMinutes: 240, destinationServiceDates: ['2027-01-02'], destinationAnchorAddress: 'Khách sạn' };
  const normal = await quotePrice(input, db(null));
  const changed = await quotePrice(input, db());
  assert.equal(normal.ok, true, normal.message); assert.equal(changed.ok, true, changed.message);
  const a = normal.data, b = changed.data;
  assert.equal(a.destinationService.fee, b.destinationService.fee);
  assert.equal(b.rawTotal - a.rawTotal, Math.round(a.priceBeforeFuelSurcharge * 0.1));
  assert.equal(b.finalPrice, Math.round((b.rawTotal - b.destinationService.fee) / 10000) * 10000 + b.destinationService.fee);
});

test('minimum fares and disabled vehicles keep their existing checks', async () => {
  const minimum = await quotePrice(request, db(config, { ...priceConfig, pricePerKm: 100, minFare: 200000 }));
  assert.equal(minimum.ok, true); assert.equal(minimum.data.regionalSurcharge.amount, 20000);
  const disabled = await quotePrice(request, { pricingConfig: { findFirst: async () => null } });
  assert.equal(disabled.status, 409);
});

test('client route builder retains all booked points; display uses saved amounts and omits zero', () => {
  const points = regionalRoutePoints({ placeId: north.placeId, fullAddress: north.address }, [{ placeId: central.placeId, fullAddress: central.address }, { placeId: south.placeId, fullAddress: south.address }]);
  assert.deepEqual(points, [north, central, south]);
  assert.equal(regionalPricingLine({ appliedRegion: 'NORTH', percent: 10, amount: 100000 }), 'Đã gồm điều chỉnh giá Miền Bắc 10%: 100.000 đ');
  for (const value of [null, {}, { appliedRegion: 'SOUTH', percent: 0, amount: 0 }]) assert.equal(regionalPricingLine(value), null);
});

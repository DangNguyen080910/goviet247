import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTripTime } from '../src/utils/tripTime.js';
import { quotePrice } from '../src/services/pricingService.js';
import { assertRegionalQuote, validateRegionalPricingConfig } from '../src/services/regionalPricing.js';
import { assertDestinationQuote } from '../src/services/destinationService.js';
import { regionalPricingVisibility } from '../src/middleware/regionalPricingVisibility.js';

function handler(file, name, deps) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const marker = source.includes(`export async function ${name}(`) ? `export async function ${name}(` : `function ${name}(`;
  const start = source.indexOf(marker), end = source.indexOf('\n}', start) + 2;
  assert.ok(start >= 0);
  return new Function(...Object.keys(deps), source.slice(start, end).replace('export ', '') + `; return ${name};`)(...Object.values(deps));
}
function response(path) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  if (path) regionalPricingVisibility({ originalUrl: path }, res, () => {});
  return res;
}
const quiet = { error() {}, log() {} };
const regional = { NORTH: 10, CENTRAL: 5, SOUTH: 0 };
const body = {
  carType: 'CAR_5', direction: 'ONE_WAY', pickupTime: '2099-01-01T07:00:00+07:00', distanceKm: 100, driveMinutes: 120,
  pickupAddress: 'TP.HCM, Việt Nam', dropoffAddress: 'Hà Nội, Việt Nam', stops: ['Hà Nội, Việt Nam'], riderName: 'Khách', riderPhone: '0901234567',
  destinationAnchorAddress: 'Hà Nội, Việt Nam',
  routePricingPoints: [{ placeId: 'goviet247:province:tp-hcm', address: 'TP.HCM, Việt Nam' }, { placeId: 'goviet247:province:ha-noi', address: 'Hà Nội, Việt Nam' }],
};
function fixture() {
  let settings = { ...regional };
  const writes = [], db = { pricingConfig: { findFirst: async () => ({ baseFare: 0, pricePerKm: 10000, pricePerHour: 0, minFare: 0, overnightFee: 0, overnightTriggerKm: 10000, overnightTriggerHours: 100 }) }, tripConfig: { findFirst: async () => ({ regionalPricingConfig: settings }) } };
  const calculateTripPrice = async input => {
    const result = await quotePrice(input, db);
    if (!result.ok) throw Object.assign(new Error(result.message), { status: result.status });
    return { ...result.data, totalPrice: result.data.finalPrice, basePricePerKm: result.data.pricePerKm };
  };
  const deps = { prisma: {}, calculateTripPrice, parseTripTime, validateTripDistance: async () => ({ ok: true }), getEffectiveTripConfig: async () => ({ maxStops: 10 }),
    assertRegionalQuote, assertDestinationQuote, createBookableTrip: async (_, data) => { writes.push(data); return { id: 'booked', ...data }; },
    linkQuoteToTrip: async () => {}, sendAdminPushNotification: async () => {}, console: quiet };
  const create = handler('routes/trips.js', 'createTripHandler', deps);
  const quote = handler('controllers/pricingController.js', 'quote', {
    validateTripDistance: deps.validateTripDistance, quotePrice: input => quotePrice(input, db), recordQuoteHistory: async () => null, console: quiet,
  });
  return { create, quote, calculateTripPrice, writes, setConfig(value) { settings = value; } };
}

test('quote and personal/company booking agree on regional price and persist the immutable snapshot', async () => {
  for (const partnerTripData of [undefined, { partnerCompanyId: 'company' }]) {
    const f = fixture(), quoted = response('/api/pricing/quote');
    await f.quote({ body }, quoted);
    assert.equal(quoted.statusCode, 200);
    assert.equal(quoted.body.data.finalPrice, 1100000);
    const q = quoted.body.data, created = response('/api/trips');
    assert.equal(q.regionalSurcharge, undefined);
    assert.equal(q.destinationService.tourDisplay.regionalSurcharge, undefined);
    await f.create({ user: { id: 'rider' }, partnerTripData, body: { ...body, fareEstimate: q.finalPrice, regionalPricingSignature: q.regionalPricingSignature, destinationServiceSignature: q.destinationServiceSignature } }, created);
    assert.equal(created.statusCode, 201, JSON.stringify(created.body));
    assert.ok(!JSON.stringify(created.body).includes('regionalSurcharge'));
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].totalPrice, 1100000);
    assert.equal(f.writes[0].destinationService.tourDisplay.regionalSurcharge.amount, 100000);
    f.setConfig({ NORTH: 20, CENTRAL: 0, SOUTH: 0 });
    assert.equal(f.writes[0].destinationService.tourDisplay.regionalSurcharge.percent, 10);
  }
});

test('changed settings, missing route points and substituted booking stops cannot create a cheaper trip', async () => {
  const f = fixture(), q = await f.calculateTripPrice(body);
  for (const patch of [{ regionalPricingSignature: undefined }, { routePricingPoints: undefined }, { stops: ['Đà Nẵng, Việt Nam'] }]) {
    const res = response();
    await f.create({ body: { ...body, fareEstimate: q.finalPrice, regionalPricingSignature: q.regionalPricingSignature, ...patch } }, res);
    assert.ok([400, 409].includes(res.statusCode), JSON.stringify(res.body));
  }
  f.setConfig({ ...regional, NORTH: 20 });
  const stale = response();
  await f.create({ body: { ...body, fareEstimate: q.finalPrice, regionalPricingSignature: q.regionalPricingSignature } }, stale);
  assert.equal(stale.statusCode, 409); assert.equal(f.writes.length, 0);
});

test('public OTP draft keeps the regional quote snapshot through confirmation', async () => {
  const f = fixture(), q = await f.calculateTripPrice(body);
  let draft, saved;
  const common = { prisma: {}, parseTripTime, validateTripDistance: async () => ({ ok: true }), assertDestinationQuote, assertRegionalQuote, console: quiet,
    toDate: handler('controllers/tripPublicController.js', 'toDate', { parseTripTime }),
    assertPickupTimeNotInPast: handler('controllers/tripPublicController.js', 'assertPickupTimeNotInPast', {}),
    respondToOtpLock: () => false, getOtpProviderUnavailablePayload: () => ({}) };
  const requestOtp = handler('controllers/tripPublicController.js', 'requestTripOtp', { ...common, calculateTripPrice: f.calculateTripPrice,
    requestTripOtpService: async (_, payload) => { draft = payload; return { sessionId: 'otp', resendAfter: 60 }; } });
  const requested = response();
  await requestOtp({ body: { ...body, regionalPricingSignature: q.regionalPricingSignature, destinationServiceSignature: q.destinationServiceSignature } }, requested);
  assert.equal(requested.statusCode, 200, JSON.stringify(requested.body));
  assert.equal(draft.destinationService.tourDisplay.regionalSurcharge.percent, 10);
  f.setConfig({ ...regional, NORTH: 30 });
  const confirm = handler('controllers/tripPublicController.js', 'confirmTrip', { ...common,
    verifyTripOtp: async () => ({ valid: true, payload: draft }), createBookableTrip: async (_, data) => { saved = data; return { id: 'otp-trip', ...data }; },
    linkQuoteToTrip: async () => {}, sendAdminPushNotification: async () => {} });
  const confirmed = response();
  await confirm({ body: { sessionId: 'otp', otpCode: '123456' } }, confirmed);
  assert.equal(confirmed.statusCode, 200, JSON.stringify(confirmed.body));
  assert.equal(saved.totalPrice, 1100000);
  assert.equal(saved.destinationService.tourDisplay.regionalSurcharge.percent, 10);
});

test('regional config uses guarded partial updates and rejects stale or malformed writes', async () => {
  const current = { id: 1, updatedAt: new Date('2026-11-19T10:00:00Z'), maxStops: 10, minDistanceKm: 10, maxDistanceKm: 2000, quoteExpireSeconds: 120 };
  const writes = [];
  const update = handler('controllers/tripConfigController.js', 'updateTripConfig', {
    getOrCreateTripConfig: async () => current, validateRegionalPricingConfig, console: quiet,
    prisma: { tripConfig: { update: async args => { writes.push(args); return { ...current, ...args.data }; } } },
  });
  for (const input of [{ regionalPricingConfig: { NORTH: -1 } }, { regionalPricingConfig: regional, expectedUpdatedAt: 'old' }]) {
    const res = response(); await update({ body: input }, res); assert.ok([400, 409].includes(res.statusCode));
  }
  assert.equal(writes.length, 0);
  const res = response();
  await update({ body: { regionalPricingConfig: regional, expectedUpdatedAt: current.updatedAt.toISOString() } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(writes[0].data, { regionalPricingConfig: regional });
  assert.equal(writes[0].where.updatedAt, current.updatedAt);
});

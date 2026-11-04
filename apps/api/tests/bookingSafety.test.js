import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBookableTrip } from '../src/services/carAvailability.js';
import { parseTripTime } from '../src/utils/tripTime.js';

const quiet = { log() {}, error() {} };
const noop = async () => {};
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function loadCreate(deps) {
  const source = readFileSync(new URL('../src/routes/trips.js', import.meta.url), 'utf8');
  const start = source.indexOf('export async function createTripHandler(');
  const end = source.indexOf("\nrouter.get('/booking-companies'", start);
  return new Function(...Object.keys(deps), source.slice(start, end).replace('export ', '') + ';return createTripHandler;')(...Object.values(deps));
}
function fixture({ stopFailure = false, socketFailure = false } = {}) {
  const committedTrips = [], committedStops = [];
  let transactionActive = false;
  const tripModel = { create: async ({ data }) => ({ id: 'booking', createdAt: new Date(), ...data }) };
  const db = {
    tripStop: { createMany: async ({ data }) => { if (stopFailure) throw Error('stop write failed'); committedStops.push(...data); } },
    $transaction: async fn => {
      const stagedTrips = [], stagedStops = [];
      const tx = {
        pricingConfig: { findUnique: async () => ({ isActive: true }) }, $queryRawUnsafe: noop,
        trip: { create: async arg => { const trip = await tripModel.create(arg); stagedTrips.push(trip); return trip; } },
        tripStop: { createMany: async ({ data }) => { assert.equal(transactionActive, true); if (stopFailure) throw Error('stop write failed'); stagedStops.push(...data); } },
        tripChatMessage: { createMany: noop },
      };
      transactionActive = true;
      try {
        const result = await fn(tx);
        committedTrips.push(...stagedTrips); committedStops.push(...stagedStops);
        return result;
      } finally { transactionActive = false; }
    },
  };
  const handler = loadCreate({
    prisma: db, createBookableTrip, parseTripTime, validateTripDistance: async () => ({ ok: true }),
    getEffectiveTripConfig: async () => ({ maxStops: 10 }),
    calculateTripPrice: async () => ({ totalPrice: 500000, basePricePerKm: 10000 }),
    assertDestinationQuote() {}, linkQuoteToTrip: noop, emitRiderTripUpdate: noop,
    sendAdminPushNotification: noop, console: quiet,
  });
  const req = { user: { id: 'rider' }, body: {
    pickupAddress: 'A', dropoffAddress: 'C', stops: ['B', 'C'], distanceKm: 50,
    pickupTime: '2099-01-01T08:00:00+07:00', carType: 'CAR_5',
  }, app: { get: () => socketFailure ? { to() { throw Error('socket down'); } } : null } };
  return { handler, req, committedTrips, committedStops };
}

test('ordinary booking commits the trip and ordered stops together', async () => {
  const f = fixture(); const res = response();
  await f.handler(f.req, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(f.committedTrips.length, 1);
  assert.deepEqual(f.committedStops.map(stop => [stop.tripId, stop.seq, stop.address]), [['booking', 1, 'B'], ['booking', 2, 'C']]);
  assert.equal('bookingStops' in f.committedTrips[0], false, 'transport-only data must not reach Prisma');
});

test('a failed stop write cannot leave a partially created booking', async () => {
  const f = fixture({ stopFailure: true }); const res = response();
  await f.handler(f.req, res);
  assert.equal(res.body.success, false);
  assert.equal(f.committedTrips.length, 0);
  assert.equal(f.committedStops.length, 0);
});

test('socket failure after booking commit still returns the created trip', async () => {
  const f = fixture({ socketFailure: true }); const res = response();
  await f.handler(f.req, res);
  assert.equal(f.committedTrips.length, 1);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(res.body.success, true);
  assert.equal(res.body.trip.id, 'booking');
});

test('OTP-confirmed booking succeeds even if realtime delivery fails after commit', async () => {
  const source = readFileSync(new URL('../src/controllers/tripPublicController.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/export /g, '');
  const payload = { riderName: 'Khách', riderPhone: '0900000000', pickupTime: '2099-01-01T08:00:00+07:00', carType: 'CAR_5', distanceKm: 50, totalPrice: 500000 };
  let saved = false;
  const deps = { prisma: {}, parseTripTime, verifyTripOtp: async () => ({ valid: true, payload }),
    validateTripDistance: async () => ({ ok: true }), createBookableTrip: async (_, data) => { saved = true; return { ...data, id: 'otp-trip' }; },
    linkQuoteToTrip: noop, sendAdminPushNotification: noop, console: quiet };
  const confirm = new Function(...Object.keys(deps), source + ';return confirmTrip;')(...Object.values(deps));
  const res = response();
  await confirm({ body: { sessionId: 'otp', otpCode: '123456' }, app: { get: () => ({ to() { throw Error('socket down'); } }) } }, res);
  assert.equal(saved, true);
  assert.equal(res.body.success, true, JSON.stringify(res.body));
  assert.equal(res.body.tripId, 'otp-trip');
});

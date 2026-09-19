import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import * as policy from '../src/services/tripAcceptancePolicy.js';
import { calculateDriverFinanceSnapshot } from '../src/services/driverFinanceService.js';
import { recordRiderAppUsage, summarizeRiderAppUsage } from '../src/services/riderAppUsage.js';

// Explicit opt-in, local disposable DB only. Never load DATABASE_URL/.env here.
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname === '/goviet247_test', 'Use a disposable local goviet247_test database');
}
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const integration = (name, fn) => test(name, { skip: !db }, fn);
const noop = async () => {};
function controller(file, names, dependencies) {
  // Run actual controller bodies, replacing only external deliveries (push/S3).
  const source = readFileSync(new URL(`../src/controllers/${file}`, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/export /g, '');
  return new Function(...Object.keys(dependencies), `${source}; return { ${names.join(',')} };`)(...Object.values(dependencies));
}
function trips(prisma = db, overrides = {}) {
  return controller('tripController.js', ['acceptTrip', 'cancelDriverTrip', 'changeTripStatus', 'createWithdrawRequest'], {
    prisma, ...policy, calculateDriverFinanceSnapshot, sendAdminPushNotification: noop,
    sendTripStatusChangedToRider: noop, sendSystemNotificationToDriver: noop,
    createMyDriverWithdrawRequest: withdrawals(prisma), ...overrides,
  });
}
function withdrawals(prisma = db) {
  return controller('driverProfileController.js', ['createMyDriverWithdrawRequest'], {
    prisma, z, ...policy, sendAdminPushNotification: noop,
  }).createMyDriverWithdrawRequest;
}
function admins(prisma = db) {
  return controller('adminController.js', ['makeAdminController'], {}).makeAdminController(prisma);
}
function request(body, id = 'a') { return { body, user: { id, uid: id }, app: { get: () => null } }; }
async function call(handler, req) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res); return res;
}
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function trip(id = 'trip', data = {}) {
  return db.trip.create({ data: { id, riderId: 'rider', pickupAddress: 'A', dropoffAddress: 'B', distanceKm: 10,
    status: 'PENDING', isVerified: true, verifiedAt: new Date(), basePricePerKm: 10000,
    carType: 'CAR_5', direction: 'ONE_WAY', pickupTime: new Date(), totalPrice: 100000, ...data } });
}
async function seed() {
  await db.$executeRawUnsafe('TRUNCATE TABLE "User", "Trip", "DriverConfig" CASCADE');
  await db.driverConfig.create({ data: { commissionPercent: 10, driverVatPercent: 0, driverPitPercent: 0, maxActiveTrips: 1 } });
  await db.user.create({ data: { id: 'rider', displayName: 'Khách', roles: { create: { role: 'RIDER' } } } });
  for (const id of ['a', 'b']) await db.user.create({ data: { id, primaryRole: 'DRIVER', roles: { create: { role: 'DRIVER' } },
    driverProfile: { create: { id: `profile-${id}`, status: 'VERIFIED', balance: 100000,
      bankAccounts: { create: { bankName: 'Test', accountNumber: '123', accountHolderName: 'TEST', isDefault: true } } } } } });
}
beforeEach(async () => { if (db) await seed(); });
after(async () => { if (db) await db.$disconnect(); });
integration('two drivers race: one winner, one wallet hold, one rider notification', async () => {
  await trip(); const api = trips();
  const results = await Promise.all(['a','b'].map(id => call(api.acceptTrip, request({ tripId: 'trip' }, id))));
  assert.equal(results.filter(r => r.body.success).length, 1);
  const claimed = await db.trip.findUnique({ where: { id: 'trip' } });
  assert.equal(claimed.status, 'ACCEPTED');
  const profiles = await db.driverProfile.findMany();
  assert.equal(profiles.find(p => p.userId === claimed.driverId).balance, 90000);
  assert.equal(profiles.find(p => p.userId !== claimed.driverId).balance, 100000);
  assert.equal(await db.driverWalletTransaction.count(), 1);
  assert.equal(await db.systemNotification.count(), 1);
});
integration('same driver races different trips: active-trip limit and balance stay correct', async () => {
  await trip('one'); await trip('two');
  const api = trips(); const results = await Promise.all(['one','two'].map(tripId => call(api.acceptTrip, request({ tripId }))));
  assert.equal(results.filter(r => r.body.success).length, 1);
  assert.equal(await db.trip.count({ where: { status: 'ACCEPTED' } }), 1);
  assert.equal((await db.driverProfile.findUnique({ where: { id: 'profile-a' } })).balance, 90000);
});
integration('blocked driver has no side effects; other driver can claim', async () => {
  await trip(); await db.driverProfile.update({ where: { id: 'profile-a' }, data: { tripAcceptBlocked: true } });
  const api = trips(); const result = await call(api.acceptTrip, request({ tripId: 'trip' }));
  assert.equal(result.statusCode, 409); assert.equal(result.body.code, 'TRIP_ACCEPT_UNAVAILABLE');
  assert.equal(await db.driverWalletTransaction.count(), 0); assert.equal(await db.systemNotification.count(), 0);
  assert.equal((await db.trip.findUnique({ where: { id: 'trip' } })).status, 'PENDING');
  assert.equal((await call(api.acceptTrip, request({ tripId: 'trip' }, 'b'))).body.success, true);
});
integration('block committed while accept waits is observed before any debit', async () => {
  await trip(); const locked = gate(), release = gate();
  const block = db.$transaction(async tx => {
    await policy.lockDriverProfile(tx, 'a');
    await tx.driverProfile.update({ where: { id: 'profile-a' }, data: { tripAcceptBlocked: true } });
    locked.resolve(); await release.promise;
  });
  await locked.promise;
  const accepting = call(trips().acceptTrip, request({ tripId: 'trip' }));
  release.resolve(); await block;
  assert.equal((await accepting).body.code, 'TRIP_ACCEPT_UNAVAILABLE');
  assert.equal(await db.driverWalletTransaction.count(), 0);
});
integration('accept that already holds driver lock can finish before admin block', async () => {
  await trip(); const locked = gate(), release = gate();
  const api = trips(db, { lockDriverProfile: async (tx, id) => { await policy.lockDriverProfile(tx,id); locked.resolve(); await release.promise; } });
  const accepting = call(api.acceptTrip, request({ tripId: 'trip' })); await locked.promise;
  const blocking = call(admins().updateDriverTripAcceptance, { ...request({ blocked: true, reason: 'test' }), params: { id: 'profile-a' }, admin: { username: 'test' } });
  release.resolve(); assert.equal((await accepting).body.success, true); assert.equal((await blocking).body.success, true);
  assert.equal((await db.driverProfile.findUnique({ where: { id: 'profile-a' } })).tripAcceptBlocked, true);
  assert.equal((await db.trip.findUnique({ where: { id: 'trip' } })).driverId, 'a');
});
integration('toggle is idempotent, audited, keeps KYC and sends no driver notification', async () => {
  const api = admins();
  const change = blocked => call(api.updateDriverTripAcceptance, { ...request({ blocked, reason: 'test' }), params: { id: 'profile-a' }, admin: { username: 'test' } });
  await change(true); await change(true); await change(false);
  assert.equal(await db.adminDriverActionLog.count(), 2);
  assert.equal(await db.systemNotification.count(), 0);
  const profile = await db.driverProfile.findUnique({ where: { id: 'profile-a' } });
  assert.equal(profile.status, 'VERIFIED'); assert.equal(profile.tripAcceptBlocked, false);
  const bad = await call(api.updateDriverTripAcceptance, { ...request({ blocked: 'false', reason: 'test' }), params: { id: 'profile-a' } });
  assert.equal(bad.statusCode, 400);
});
integration('wallet write failure rolls back debit, claim and notification', async () => {
  await trip();
  const failing = new Proxy(db, { get(target, key) {
    if (key !== '$transaction') return Reflect.get(target, key);
    return fn => target.$transaction(tx => fn(new Proxy(tx, { get(inner, prop) {
      if (prop === 'driverWalletTransaction') return { create: async () => { throw new Error('injected wallet failure'); } };
      return Reflect.get(inner, prop);
    } })));
  } });
  assert.equal((await call(trips(failing).acceptTrip, request({ tripId: 'trip' }))).body.success, false);
  assert.equal((await db.driverProfile.findUnique({ where: { id: 'profile-a' } })).balance, 100000);
  assert.equal((await db.trip.findUnique({ where: { id: 'trip' } })).driverId, null);
  assert.equal(await db.systemNotification.count(), 0);
});
integration('duplicate cancellation records penalty only once, even for a blocked driver', async () => {
  await trip(); const api = trips(); await call(api.acceptTrip, request({ tripId: 'trip' }));
  await db.driverProfile.update({ where: { id: 'profile-a' }, data: { tripAcceptBlocked: true } });
  const results = await Promise.all([1,2].map(() => call(api.cancelDriverTrip, request({ tripId: 'trip' }))));
  assert.equal(results.filter(r => r.body.success).length, 1);
  assert.equal(await db.driverTripPenaltyLog.count(), 1);
  assert.equal(await db.driverWalletTransaction.count({ where: { type: 'TRIP_CANCEL_PENALTY' } }), 1);
  assert.equal((await db.trip.findUnique({ where: { id: 'trip' } })).driverId, null);
});
integration('socket failure after commit still returns successful acceptance', async () => {
  await trip(); const req = request({ tripId: 'trip' }); req.app.get = () => ({ to() { throw new Error('socket down'); } });
  assert.equal((await call(trips().acceptTrip, req)).body.success, true);
  assert.equal(await db.driverWalletTransaction.count(), 1);
});
integration('withdraw and accept race cannot overspend or overwrite wallet', async () => {
  await trip(); await db.driverProfile.update({ where: { id: 'profile-a' }, data: { balance: 55000 } });
  const results = await Promise.all([
    call(trips().acceptTrip, request({ tripId: 'trip' })),
    call(withdrawals(), request({ amount: 50000 })),
  ]);
  assert.equal(results.filter(r => r.body.success).length, 1);
  const profile = await db.driverProfile.findUnique({ where: { id: 'profile-a' } });
  assert.ok([45000, 5000].includes(profile.balance));
});
integration('legacy withdrawal endpoint reserves funds and preserves request alias', async () => {
  const result = await call(trips().createWithdrawRequest, request({ amount: 50000 }));
  assert.equal(result.body.success, true); assert.ok(result.body.request.id);
  assert.equal((await db.driverProfile.findUnique({ where: { id: 'profile-a' } })).balance, 50000);
  assert.equal(await db.driverWalletTransaction.count({ where: { type: 'WITHDRAW_REQUEST' } }), 1);
});
integration('app usage deduplicates users/platforms and customer summary spans pages', async () => {
  await recordRiderAppUsage(db, 'rider', 'android'); await recordRiderAppUsage(db, 'rider', 'android');
  await recordRiderAppUsage(db, 'rider', 'ios'); await recordRiderAppUsage(db, 'rider', 'web');
  await db.user.create({ data: { id: 'other', roles: { create: { role: 'RIDER' } } } });
  const { getCustomers } = controller('adminCustomerController.js', ['getCustomers'], { prisma: db, summarizeRiderAppUsage });
  const result = await call(getCustomers, { query: { pageSize: '1', appPlatform: 'recorded' } });
  assert.equal(result.body.items.length, 1); assert.equal(result.body.meta.total, 1);
  assert.deepEqual(result.body.appUsageSummary, { total: 2, recorded: 1, unrecorded: 1, android: 1, ios: 1, both: 1 });
  assert.equal(result.body.items[0].riderAppUsages.length, 2);
});

integration('commission and taxes are held exactly once with a continuous wallet ledger', async () => {
  await db.driverConfig.updateMany({ data: { driverVatPercent: 3, driverPitPercent: 1.5 } });
  await trip(); const result = await call(trips().acceptTrip, request({ tripId: 'trip' }));
  assert.equal(result.body.success, true);
  assert.equal(result.body.wallet.requiredWalletAmount, 14500);
  const rows = await db.driverWalletTransaction.findMany({ orderBy: { balanceBefore: 'desc' } });
  assert.equal(rows.length, 3); assert.equal(rows[0].balanceBefore, 100000);
  assert.equal(rows[0].balanceAfter, rows[1].balanceBefore);
  assert.equal(rows[1].balanceAfter, rows[2].balanceBefore);
  assert.equal(rows[2].balanceAfter, 85500);
});
integration('admin return-to-review racing acceptance cannot unassign a successfully accepted trip', async () => {
  await trip();
  const admin = controller('adminTripController.js', ['adminChuyenVeChoDuyet'], { prisma: db, ...policy, sendAdminPushNotification: noop });
  const [accepted, returned] = await Promise.all([
    call(trips().acceptTrip, request({ tripId: 'trip' })),
    call(admin.adminChuyenVeChoDuyet, { ...request({}), params: { id: 'trip' }, admin: { username: 'test' } }),
  ]);
  assert.equal([accepted,returned].filter(r => r.body.success).length, 1);
  const current = await db.trip.findUnique({ where: { id: 'trip' } });
  if (accepted.body.success) { assert.equal(current.driverId, 'a'); assert.equal(current.isVerified, true); }
  else { assert.equal(current.driverId, null); assert.equal(current.isVerified, false); assert.equal(await db.driverWalletTransaction.count(), 0); }
});
integration('blocked driver can continue an already accepted trip', async () => {
  await trip(); const api = trips(); await call(api.acceptTrip, request({ tripId: 'trip' }));
  await db.driverProfile.update({ where: { id: 'profile-a' }, data: { tripAcceptBlocked: true } });
  const response = await call(api.changeTripStatus, request({ tripId: 'trip', newStatus: 'CONTACTED' }));
  assert.equal(response.body.success, true);
  assert.equal((await db.trip.findUnique({ where: { id: 'trip' } })).status, 'CONTACTED');
});

integration('legacy withdrawal retains the verified-driver restriction', async () => {
  await db.driverProfile.update({ where: { id: 'profile-a' }, data: { status: 'SUSPENDED' } });
  const response = await call(trips().createWithdrawRequest, request({ amount: 50000 }));
  assert.equal(response.statusCode, 403);
  assert.equal(await db.driverWithdrawRequest.count(), 0);
});

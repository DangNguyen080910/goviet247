import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  phoneVariants, getVerifiedRiderPhoneVariants, getTripRiderRecipientUserIds,
  riderTripAccessWhere, emitRiderTripUpdate,
} from '../src/services/riderTripAccess.js';

const quiet = { log() {}, error() {}, warn() {} };
const noop = async () => {};
function load(relative, supplied, result) {
  const source = readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8');
  const imports = {};
  for (const match of source.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?\n/gm)) {
    for (const name of match[1].replace(/[{}]/g, '').split(',')) {
      const key = name.trim();
      if (key) imports[key] = noop;
    }
  }
  const bindings = { ...imports, console: quiet, ...supplied };
  const code = source.replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/^export default .*;\n?/gm, '')
    .replace(/export (?=(?:async )?function)/g, '');
  return new Function(...Object.keys(bindings), `${code}; return ${result};`)(...Object.values(bindings));
}
function matches(value, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return condition.some((child) => matches(value, child));
    if (key === 'AND') return condition.every((child) => matches(value, child));
    if (condition && typeof condition === 'object') {
      if ('in' in condition) return condition.in.includes(value[key]);
      if ('not' in condition) return value[key] !== condition.not;
      if ('contains' in condition) return String(value[key] || '').includes(condition.contains);
    }
    return value[key] === condition;
  });
}
function project(value, select) {
  if (!select) return { ...value };
  return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, value[key]]));
}
function fixture({ verified = true, passengerAccount = true, ownerId = 'booker' } = {}) {
  const phones = passengerAccount ? [{ userId: 'passenger', isVerified: verified, e164: '+84900000001' }] : [];
  const trips = [
    { id: 'shared-trip', riderId: ownerId, riderPhone: '0900000001', driverId: 'driver', status: 'PENDING', cancelledAt: null, updatedAt: new Date(), driver: null },
    { id: 'other-trip', riderId: 'other', riderPhone: '0900000099', driverId: null, status: 'COMPLETED', driver: null },
  ];
  const notices = [
    { id: 'approved', audience: 'RIDER', targetType: 'USER', targetUserId: ownerId, isActive: true, title: 'Approved', message: 'Approved [tripId:shared-trip]' },
    { id: 'accepted', audience: 'RIDER', targetType: 'USER', targetUserId: ownerId, isActive: true, title: 'Accepted', message: 'Accepted [tripId:shared-trip]' },
    { id: 'unrelated', audience: 'RIDER', targetType: 'USER', targetUserId: 'other', isActive: true, message: 'Private [tripId:other-trip]' },
    { id: 'public', audience: 'RIDER', targetType: 'ALL', isActive: true, message: 'Announcement' },
  ];
  const db = {
    phone: { findMany: async ({ where, select }) => phones.filter((p) => matches(p, where)).map((p) => project(p, select)) },
    trip: {
      findMany: async ({ where, select }) => trips.filter((p) => matches(p, where)).map((p) => project(p, select)),
      findUnique: async ({ where, select }) => { const t = trips.find((p) => p.id === where.id); return t ? project(t, select) : null; },
      update: async ({ where, data, select }) => {
        const trip = trips.find((p) => matches(p, where));
        if (!trip) throw Object.assign(new Error('Trip changed'), { code: 'P2025' });
        return project(Object.assign(trip, data), select);
      },
    },
    systemNotification: {
      findMany: async ({ where, select }) => notices.filter((p) => matches(p, where)).map((p) => project(p, select)),
      create: async ({ data }) => { const n = { id: `notice-${notices.length}`, ...data }; notices.push(n); return n; },
    },
    device: { findMany: async () => [] },
  };
  db.$transaction = async (fn) => fn(db);
  return { db, phones, trips, notices };
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function controller(db) {
  return load('controllers/tripController.js', {
    prisma: db, getVerifiedRiderPhoneVariants, riderTripAccessWhere, phoneVariants, emitRiderTripUpdate,
  }, '{ listMyCustomerTrips, getTripById, createRiderTripNotification, adminVerifyTrip }');
}
function notifications(db) {
  const routes = new Map();
  const verifyToken = () => {};
  load('routes/systemPublicRoutes.js', {
    Router: () => ({ get: (path, ...handlers) => routes.set(path, handlers) }),
    pkg: { PrismaClient: class { constructor() { return db; } } }, verifyToken, getVerifiedRiderPhoneVariants,
  }, 'router');
  return { routes, verifyToken };
}

test('Vietnamese phone formats match exactly and reject invalid/incomplete numbers', () => {
  const expected = ['0900000001', '+84900000001', '84900000001'].sort();
  for (const input of ['0900000001', '+84900000001', '84900000001', '090 000 0001']) {
    assert.deepEqual(phoneVariants(input).sort(), expected);
  }
  for (const input of ['', '0000000000', '900000001', '09000000010', 'shared-trip']) assert.deepEqual(phoneVariants(input), []);
});

test('only verified phones belonging to the authenticated user grant access', async () => {
  const f = fixture({ verified: false });
  assert.deepEqual(await getVerifiedRiderPhoneVariants(f.db, 'passenger'), []);
  assert.deepEqual(await getVerifiedRiderPhoneVariants(f.db, 'other'), []);
  f.phones[0].isVerified = true;
  assert.equal((await getVerifiedRiderPhoneVariants(f.db, 'passenger')).includes('0900000001'), true);
});

test('recipient accounts include owner plus verified passenger and never duplicate', async () => {
  const f = fixture();
  assert.deepEqual(await getTripRiderRecipientUserIds(f.db, f.trips[0]), ['booker', 'passenger']);
  assert.deepEqual(await getTripRiderRecipientUserIds(f.db, { ...f.trips[0], riderId: 'passenger' }), ['passenger']);
  f.phones[0].isVerified = false;
  assert.deepEqual(await getTripRiderRecipientUserIds(f.db, f.trips[0]), ['booker']);
});

test('booking before app signup remains owned by booker, becomes visible after phone verification', async () => {
  const f = fixture({ passengerAccount: false });
  assert.deepEqual(await getTripRiderRecipientUserIds(f.db, f.trips[0]), ['booker']);
  const c = controller(f.db);
  let res = response();
  await c.listMyCustomerTrips({ user: { id: 'passenger' } }, res);
  assert.deepEqual(res.body.items, []);
  f.phones.push({ userId: 'passenger', isVerified: true, e164: '+84900000001' });
  res = response();
  await c.listMyCustomerTrips({ user: { id: 'passenger' } }, res);
  assert.deepEqual(res.body.items.map((t) => [t.id, t.canManage]), [['shared-trip', false]]);
  res = response();
  await c.listMyCustomerTrips({ user: { id: 'booker' } }, res);
  assert.equal(res.body.items[0].canManage, true);
});

test('trip detail admits owner, driver and verified passenger; rejects unrelated/unverified users', async () => {
  const f = fixture();
  const c = controller(f.db);
  for (const userId of ['booker', 'driver', 'passenger', 'other']) {
    const res = response();
    await c.getTripById({ params: { id: 'shared-trip' }, user: { id: userId } }, res);
    assert.equal(res.statusCode, userId === 'other' ? 404 : 200);
  }
  f.phones[0].isVerified = false;
  const res = response();
  await c.getTripById({ params: { id: 'shared-trip' }, user: { id: 'passenger' } }, res);
  assert.equal(res.statusCode, 404);
});

test('legacy notification endpoint retains installed-app behavior', async () => {
  const f = fixture();
  const { routes } = notifications(f.db);
  const res = response();
  await routes.get('/system-notifications').at(-1)({ query: { audience: 'RIDER', userId: 'booker' } }, res);
  assert.deepEqual(res.body.items.map((n) => n.id), ['approved', 'accepted', 'public']);
});

test('authenticated passenger sees historical trip notices, no unrelated/private owner notices', async () => {
  const f = fixture();
  f.notices.push({ id: 'owner-only', audience: 'RIDER', targetType: 'USER', targetUserId: 'booker', isActive: true, message: 'Private account notice' });
  const { routes, verifyToken } = notifications(f.db);
  const route = routes.get('/rider-notifications');
  assert.equal(route[0], verifyToken);
  const res = response();
  await route.at(-1)({ query: { userId: 'booker', audience: 'DRIVER' }, user: { id: 'passenger' } }, res);
  assert.deepEqual(res.body.items.map((n) => n.id), ['approved', 'accepted', 'public']);
  assert.equal(res.body.items[0].tripId, 'shared-trip');
  assert.equal('targetUserId' in res.body.items[0], false);
  assert.equal(res.body.items[0].message.includes('[tripId:'), false);
});

test('new notification endpoint denies missing identity and does not share through unverified phone', async () => {
  const f = fixture({ verified: false });
  const { routes } = notifications(f.db);
  const handler = routes.get('/rider-notifications').at(-1);
  let res = response();
  await handler({ query: { userId: 'booker' } }, res);
  assert.equal(res.statusCode, 401);
  res = response();
  await handler({ query: { userId: 'booker' }, user: { id: 'passenger' } }, res);
  assert.deepEqual(res.body.items.map((n) => n.id), ['public']);
});

function push(db, messages) {
  return load('services/notificationService.js', {
    pkg: { PrismaClient: class { constructor() { return db; } } },
    getTripRiderRecipientUserIds,
    fetch: async (_url, options) => { messages.push(...JSON.parse(options.body)); return { ok: true, json: async () => ({ data: [] }) }; },
  }, 'sendTripStatusChangedToRider');
}

test('push safely skips accounts without registered devices', async () => {
  const f = fixture(); const messages = [];
  await assert.doesNotReject(push(f.db, messages)(f.trips[0]));
  assert.deepEqual(messages, []);
});

test('status push targets both accounts with recipient-specific navigation data', async () => {
  const f = fixture(); const messages = [];
  const devices = ['booker', 'passenger', 'other'].map((userId) => ({ userId, role: 'rider', pushToken: `ExponentPushToken[${userId}]` }));
  f.db.device.findMany = async ({ where }) => devices.filter((d) => matches(d, where));
  await push(f.db, messages)({ ...f.trips[0], status: 'CONTACTED' });
  assert.deepEqual(messages.map((m) => m.data.riderId), ['booker', 'passenger']);
  assert.ok(messages.every((m) => m.data.tripId === 'shared-trip' && m.data.status === 'CONTACTED'));
});

test('realtime trip and notification updates reach both users while the app is open', async () => {
  const f = fixture(); const events = [];
  const io = { to: (room) => ({ emit: (name, data) => events.push({ room, name, data }) }) };
  await emitRiderTripUpdate(io, f.db, f.trips[0], { reason: 'driver_accept_trip' });
  assert.deepEqual(events.map((e) => [e.room, e.name]), [
    ['rider:booker', 'rider:trip_changed'], ['rider:booker', 'rider:notification_changed'],
    ['rider:passenger', 'rider:trip_changed'], ['rider:passenger', 'rider:notification_changed'],
  ]);
  assert.ok(events.every((e) => e.data.tripId === 'shared-trip'));
});

test('guest trip updates are retained for later verified signup', async () => {
  const f = fixture({ passengerAccount: false, ownerId: null });
  await controller(f.db).createRiderTripNotification(f.db, { ...f.trips[0], status: 'CONTACTED' });
  assert.equal(f.notices.at(-1).targetUserId, null);
  f.phones.push({ userId: 'passenger', isVerified: true, e164: '+84900000001' });
  const res = response();
  await notifications(f.db).routes.get('/rider-notifications').at(-1)({ query: {}, user: { id: 'passenger' } }, res);
  assert.ok(res.body.items.some((n) => n.id === f.notices.at(-1).id));
});

function cancellationRoutes(f, pushed) {
  const routes = new Map();
  const router = {};
  for (const method of ['get', 'post', 'patch']) router[method] = (path, ...handlers) => routes.set(`${method} ${path}`, handlers);
  load('routes/trips.js', {
    Router: () => router, pkg: { PrismaClient: class { constructor() { return f.db; } } },
    createRiderTripNotification: controller(f.db).createRiderTripNotification,
    sendTripStatusChangedToRider: async (trip) => pushed.push(trip.id),
  }, 'router');
  return routes.get('post /:id/cancel-by-rider').at(-1);
}

test('view-only passenger cannot cancel; owner cancellation saves a trip notice and sends push', async () => {
  const f = fixture(); const pushed = [];
  const handler = cancellationRoutes(f, pushed);
  const request = (userId) => ({ params: { id: 'shared-trip' }, user: { id: userId }, body: {}, app: { get: () => null } });
  let res = response();
  await handler(request('passenger'), res);
  assert.equal(res.statusCode, 403);
  assert.equal(f.trips[0].status, 'PENDING');
  res = response();
  await handler(request('booker'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(f.trips[0].status, 'CANCELLED');
  assert.deepEqual(pushed, ['shared-trip']);
  assert.equal(f.notices.at(-1).title, 'Chuyến đã huỷ');
});


test('approval handler persists history and broadcasts to both authenticated rider rooms', async () => {
  const f = fixture();
  Object.assign(f.trips[0], { driverId: null, isVerified: false });
  f.db.driverConfig = { findFirst: async () => ({ newTripAcceptDelaySeconds: 0 }) };
  const events = [];
  const io = { to: (room) => ({ emit: (name, data) => events.push({ room, name, data }) }) };
  const res = response();
  await controller(f.db).adminVerifyTrip({ params: { id: 'shared-trip' }, body: {}, admin: { id: 1 }, app: { get: () => io } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(f.notices.at(-1).title, 'Chuyến đã được duyệt');
  for (const room of ['rider:booker', 'rider:passenger']) {
    assert.ok(events.some((e) => e.room === room && e.name === 'rider:trip_changed'));
    assert.ok(events.some((e) => e.room === room && e.name === 'rider:notification_changed'));
  }
});

test('admin cancellation includes passenger phone in selected result, persists notice and sends push', async () => {
  const f = fixture(); f.trips[0].driverId = null;
  f.db.adminTripActionLog = { create: async ({ data }) => data };
  const events = [], pushed = [];
  const io = { to: (room) => ({ emit: (name, data) => events.push({ room, name, data }) }) };
  const handler = load('controllers/adminTripController.js', {
    prisma: f.db, emitRiderTripUpdate,
    sendTripStatusChangedToRider: async (trip) => pushed.push(trip.riderPhone),
  }, 'adminHuyChuyen');
  const res = response();
  await handler({ params: { id: 'shared-trip' }, body: { cancel_reason: 'Khách yêu cầu huỷ', cancel_origin: 'CUSTOMER' },
    admin: { id: 1, username: 'admin', role: 'ADMIN' }, app: { get: () => io } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(f.notices.at(-1).title, 'Chuyến đã huỷ');
  assert.deepEqual(pushed, ['0900000001']);
  assert.ok(events.some((e) => e.room === 'rider:passenger' && e.name === 'rider:trip_changed'));
});

test('concurrent driver acceptance stops owner cancellation without saving a cancellation notice', async () => {
  const f = fixture(); const pushed = [];
  const initialNotices = f.notices.length;
  f.db.trip.update = async ({ where }) => {
    assert.equal(where.status, 'PENDING');
    assert.equal(where.riderId, 'booker');
    assert.equal(where.cancelledAt, null);
    f.trips[0].status = 'ACCEPTED';
    throw Object.assign(new Error('Trip changed'), { code: 'P2025' });
  };
  const res = response();
  await cancellationRoutes(f, pushed)({ params: { id: 'shared-trip' }, user: { id: 'booker' }, body: {}, app: { get: () => null } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(f.notices.length, initialNotices);
  assert.deepEqual(pushed, []);
});

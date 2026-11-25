// Run only against a disposable local database and an isolated generated Prisma client.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { notificationFeed, driverNotificationScope, createNotificationPreferenceHandler } from '../apps/api/src/services/notificationPreferences.js';
const url = new URL(process.env.NOTIFICATION_PREF_TEST_DB_URL || 'http://invalid');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/goviet247_notification_test_[a-f0-9]+$/.test(url.pathname)) throw new Error('A disposable local test database is required.');
if (!process.env.NOTIFICATION_PREF_TEST_CLIENT) throw new Error('Isolated generated Prisma client required.');
const { PrismaClient } = createRequire(import.meta.url)(process.env.NOTIFICATION_PREF_TEST_CLIENT);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  await db.user.createMany({ data: [{ id: 'u' }, { id: 'other' }, { id: 'passenger' }, { id: 'booker' }] });
  await db.systemNotification.createMany({ data: Array.from({ length: 70 }, (_, index) => ({
    id: `notice-${index}`, title: 'Test', message: 'Body', audience: 'DRIVER', isPinnedByDefault: index === 0,
    createdAt: new Date(1700000000000 + index * 1000),
  })) });
  await db.systemNotificationRead.create({ data: { notificationId: 'notice-0', userId: 'u' } });
  async function change(id, body, userId = 'u') {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await createNotificationPreferenceHandler(db)({ params: { id }, body: { audience: 'DRIVER', ...body }, user: { id: userId } }, res);
    return res;
  }
  assert.equal((await change('notice-1', { isPinned: true })).code, 200);
  let items = await notificationFeed(db, driverNotificationScope('u'), 'u');
  assert.deepEqual(items.slice(0, 2).map(item => item.id), ['notice-1', 'notice-0']);
  assert.equal(items.length, 52);
  await change('notice-0', { isPinned: false });
  await db.systemNotification.update({ where: { id: 'notice-0' }, data: { isPinnedByDefault: false } });
  await db.systemNotification.update({ where: { id: 'notice-0' }, data: { isPinnedByDefault: true } });
  items = await notificationFeed(db, driverNotificationScope('u'), 'u', 'notice-0');
  assert.equal(items[0].isPinned, false);
  assert.equal((await notificationFeed(db, driverNotificationScope('other'), 'other', 'notice-0'))[0].isPinned, true);
  await change('notice-2', { isCollapsed: false });
  const collapseOnly = await db.systemNotificationPreference.findUnique({ where: { notificationId_userId: { notificationId: 'notice-2', userId: 'u' } } });
  assert.equal(collapseOnly.isPinned, null); assert.equal(collapseOnly.isCollapsed, false);
  await db.systemNotification.update({ where: { id: 'notice-2' }, data: { isPinnedByDefault: true } });
  assert.equal((await notificationFeed(db, driverNotificationScope('u'), 'u', 'notice-2'))[0].isPinned, true);
  await db.systemNotification.create({ data: { id: 'private', title: 'Private', message: 'Secret', audience: 'DRIVER', targetType: 'USER', targetUserId: 'other', isPinnedByDefault: true } });
  assert.equal((await change('private', { isPinned: true })).code, 404);
  assert.ok(!(await notificationFeed(db, driverNotificationScope('u'), 'u')).some(item => item.id === 'private'));
  await db.systemNotification.update({ where: { id: 'notice-1' }, data: { isActive: false } });
  assert.ok(!(await notificationFeed(db, driverNotificationScope('u'), 'u')).some(item => item.id === 'notice-1'));
  assert.equal((await change('notice-1', { isPinned: false })).code, 404);
  assert.equal(await db.systemNotificationRead.count(), 1);
  await db.$disconnect(); await db.$connect();
  assert.equal((await notificationFeed(db, driverNotificationScope('u'), 'u', 'notice-2'))[0].isCollapsed, false);
  await db.systemNotification.delete({ where: { id: 'notice-2' } });
  assert.equal(await db.systemNotificationPreference.count({ where: { notificationId: 'notice-2' } }), 0);
  console.log('PostgreSQL passed: old pins, personal overrides, collapse persistence, scoped access, unchanged read records and cascade deletion.');
} finally { await db.$disconnect(); }

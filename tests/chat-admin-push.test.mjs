import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeDriverDevices } from '../apps/api/src/services/driverPushAccess.js';

const source = readFileSync(new URL('../apps/api/src/services/tripChatService.js', import.meta.url), 'utf8');
const start = source.indexOf('export async function deliverChatPush(');
const end = source.indexOf('\nexport ', start + 1);
const body = source.slice(start, end).replace('export ', '');
const future = new Date(Date.now() + 3600000);
function fixture(ids, { readIds = [], expired = false, adminExpired = false } = {}) {
  let done = false;
  let queriedIds;
  const sent = [];
  const message = { id: 'm1', tripId: 'trip1', senderId: 'sender', senderRole: 'DRIVER',
    senderLabel: 'Tài xế', kind: 'TEXT', createdAt: new Date(), pushAttempts: 0 };
  const devices = ids.map(id => ({ userId: id, pushToken: `ExpoPushToken[${id}]`, pushSessionId: `session-${id}`, pushExpiresAt: id.startsWith('admin-') && adminExpired ? new Date(0) : future }));
  const prisma = {
    tripChatMessage: {
      findMany: async args => args.select ? [] : done ? [] : [message],
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }) => { if (data.pushDoneAt) done = true; return { ...message, ...data }; },
    },
    trip: { findUnique: async () => ({ id: 'trip1' }) },
    tripChatRead: { findMany: async () => readIds.map(actorId => ({ actorId })) },
    device: {
      findMany: async ({ where }) => { queriedIds = where.userId.in; return devices.filter(d => where.userId.in.includes(d.userId)); },
      deleteMany: async () => assert.fail('No tokens should be removed'),
    },
    session: { findMany: async () => devices.filter(d => !d.userId.startsWith('admin-')).map(d => ({ id: d.pushSessionId, userId: d.userId, expiresAt: expired ? new Date(0) : null })) },
  };
  const deps = { prisma, delivering: false, chatPushRecipientIds: async () => ids, activeDriverDevices,
    sendChatPushBatch: async batch => sent.push(...batch), removeAudio: async () => {}, console: { error() {} } };
  const deliver = new Function(...Object.keys(deps), body + ';return deliverChatPush;')(...Object.values(deps));
  return { deliver, sent, get done() { return done; }, get queriedIds() { return queriedIds; } };
}

test('Admin-only chat messages deliver once using the existing system sound/channel', async () => {
  const f = fixture(['admin-1', 'admin-2']);
  await f.deliver();
  assert.deepEqual(f.queriedIds, ['admin-1', 'admin-2']);
  assert.deepEqual(f.sent.map(item => item.to), ['ExpoPushToken[admin-1]', 'ExpoPushToken[admin-2]']);
  for (const item of f.sent) {
    assert.equal(item.data.type, 'TRIP_CHAT');assert.equal(item.sound, 'default');assert.equal(item.channelId, 'trip_chat_default_v1');
  }
  assert.equal(f.done, true);
  await f.deliver();
  assert.equal(f.sent.length, 2, 'a completed delivery must not repeat');
});
test('mixed chat delivery restores Admin/Staff alongside Rider and Driver', async () => {
  const f = fixture(['admin-1', 'rider1', 'driver1']);
  await f.deliver();
  assert.deepEqual(f.queriedIds, ['admin-1', 'rider1', 'driver1']);
  assert.deepEqual(f.sent.map(item => item.to).sort(), ['ExpoPushToken[admin-1]', 'ExpoPushToken[driver1]', 'ExpoPushToken[rider1]']);
  assert.equal(f.done, true);
});
test('read messages suppress chat push for Admin as well as other participants', async () => {
  const f = fixture(['admin-1', 'rider1', 'driver1'], { readIds: ['admin-1', 'rider1'] });
  await f.deliver();
  assert.deepEqual(f.queriedIds, ['driver1']);
  assert.deepEqual(f.sent.map(item => item.to), ['ExpoPushToken[driver1]']);
});
test('expired Admin push bindings and expired user sessions remain suppressed', async () => {
  const f = fixture(['admin-1', 'rider1'], { expired: true, adminExpired: true });
  await f.deliver();
  assert.deepEqual(f.sent, []);
  assert.equal(f.done, true);
});

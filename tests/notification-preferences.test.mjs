import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { notificationFeed, driverNotificationScope, createNotificationPreferenceHandler, notificationPreferences } from '../apps/api/src/services/notificationPreferences.js';
import { sortNotifications } from '../apps/api/src/shared/notificationPresentation.js';

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(child => matches(row, child));
    if (key === 'OR') return value.some(child => matches(row, child));
    if (value?.some) return (row[key] || []).some(child => matches(child, value.some));
    if (value?.none) return !(row[key] || []).some(child => matches(child, value.none));
    if (value?.in) return value.in.includes(row[key]);
    if (value?.contains) return String(row[key] || '').includes(value.contains);
    return row[key] === value;
  });
}
function fixture() {
  const notices = Array.from({ length: 65 }, (_, index) => ({ id: `n${index}`, audience: 'DRIVER', targetType: 'ALL',
    isActive: true, isPinnedByDefault: index === 0, title: 'Title', message: 'Body', createdAt: new Date(1700000000000 + index * 1000) }));
  const preferences = []; const reads = [{ notificationId: 'n0', userId: 'u', id: 'read', readAt: new Date() }];
  const phones = [{ userId: 'passenger', isVerified: true, e164: '+84900000001' }];
  const trips = [{ id: 'trip', riderPhone: '0900000001' }];
  let writes = 0;
  const rows = () => notices.map(row => ({ ...row, preferences: preferences.filter(p => p.notificationId === row.id) }));
  const db = {
    phone: { findMany: async ({ where }) => phones.filter(row => matches(row, where)) },
    trip: { findMany: async ({ where }) => trips.filter(row => matches(row, where)) },
    systemNotification: {
      findMany: async ({ where, take, include }) => rows().filter(row => matches(row, where)).sort((a, b) => b.createdAt - a.createdAt).slice(0, take ?? Infinity).map(row => ({ ...row,
        preferences: include?.preferences ? row.preferences.filter(p => matches(p, include.preferences.where)) : undefined,
        reads: include?.reads ? reads.filter(p => p.notificationId === row.id && matches(p, include.reads.where)) : [],
      })),
      findFirst: async ({ where }) => rows().find(row => matches(row, where)) || null,
    },
    systemNotificationPreference: { upsert: async ({ where, create, update }) => {
      writes++;
      let pref = preferences.find(row => matches(row, where.notificationId_userId));
      if (pref) Object.assign(pref, update);
      else { pref = { isPinned: null, isCollapsed: true, ...create }; preferences.push(pref); }
      return pref;
    } },
  };
  const handler = createNotificationPreferenceHandler(db);
  async function change(id, body, userId = 'u') {
    const response = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ params: { id }, body: { audience: 'DRIVER', ...body }, ...(userId ? { user: { id: userId } } : {}) }, response);
    return response;
  }
  return { db, notices, preferences, reads, phones, change, writes: () => writes };
}

test('old admin pins and personal pins survive the latest-fifty window without leaking another user preference', async () => {
  const f = fixture();
  await f.change('n1', { isPinned: true });
  await f.change('n2', { isPinned: true }, 'other');
  const items = await notificationFeed(f.db, driverNotificationScope('u'), 'u');
  assert.deepEqual(items.slice(0, 2).map(row => row.id), ['n1', 'n0']);
  assert.equal(items.length, 52); assert.equal(new Set(items.map(row => row.id)).size, 52);
  assert.ok(!items.some(row => row.id === 'n2'));
  assert.ok(items.every(row => !('preferences' in row)));
  assert.equal(items.find(row => row.id === 'n0').reads.length, 1);
});
test('a user unpin survives admin off/on and fresh reads while other users retain the default', async () => {
  const f = fixture();
  assert.equal((await f.change('n0', { isPinned: false })).code, 200);
  f.notices[0].isPinnedByDefault = false; f.notices[0].isPinnedByDefault = true;
  const user = await notificationFeed(f.db, driverNotificationScope('u'), 'u', 'n0');
  const other = await notificationFeed(f.db, driverNotificationScope('other'), 'other', 'n0');
  assert.equal(user[0].isPinned, false); assert.equal(other[0].isPinned, true);
});
test('collapse-only saves do not override future admin defaults or touch read state', async () => {
  const f = fixture(); const before = JSON.stringify(f.reads);
  const res = await f.change('n4', { isCollapsed: false });
  assert.equal(res.data.item.isCollapsed, false); assert.equal(f.preferences[0].isPinned, null);
  f.notices[4].isPinnedByDefault = true;
  let [item] = await notificationFeed(f.db, driverNotificationScope('u'), 'u', 'n4');
  assert.equal(item.isPinned, true); assert.equal(item.isCollapsed, false);
  await f.change('n4', { isPinned: false });
  [item] = await notificationFeed(f.db, driverNotificationScope('u'), 'u', 'n4');
  assert.equal(item.isCollapsed, false); assert.equal(item.isPinned, false);
  assert.equal(JSON.stringify(f.reads), before);
});
test('explicit personal pins remain after Admin removes the default', async () => {
  const f = fixture(); await f.change('n0', { isPinned: true }); f.notices[0].isPinnedByDefault = false;
  assert.equal((await notificationFeed(f.db, driverNotificationScope('u'), 'u', 'n0'))[0].isPinned, true);
});
test('invalid flags, missing login, another account target and inactive notifications never write preferences', async () => {
  const f = fixture();
  for (const body of [{ isPinned: 'false' }, { isCollapsed: 1 }, {}, { audience: 'ADMIN', isPinned: true }]) assert.equal((await f.change('n0', body)).code, 400);
  assert.equal((await f.change('n0', { isPinned: true }, '')).code, 401);
  f.notices[1].targetType = 'USER'; f.notices[1].targetUserId = 'other';
  assert.equal((await f.change('n1', { isPinned: true })).code, 404);
  f.notices[2].isActive = false;
  assert.equal((await f.change('n2', { isPinned: true })).code, 404);
  assert.equal((await f.change('missing', { isPinned: true })).code, 404);
  assert.equal(f.writes(), 0);
});
test('verified passenger can pin a related trip notice but cannot alter private owner or Driver notices', async () => {
  const f = fixture();
  f.notices.push({ ...f.notices[0], id: 'rider-trip', audience: 'RIDER', targetType: 'USER', targetUserId: 'booker', message: 'Update [tripId:trip]' });
  f.notices.push({ ...f.notices.at(-1), id: 'private', message: 'Private account notice' });
  assert.equal((await f.change('rider-trip', { audience: 'RIDER', isPinned: true }, 'passenger')).code, 200);
  assert.equal((await f.change('private', { audience: 'RIDER', isPinned: true }, 'passenger')).code, 404);
  assert.equal((await f.change('n0', { audience: 'RIDER', isPinned: true }, 'passenger')).code, 404);
  f.phones[0].isVerified = false;
  assert.equal((await f.change('rider-trip', { audience: 'RIDER', isPinned: false }, 'passenger')).code, 404);
});
test('anonymous public feed includes default pins but never account-targeted announcements', async () => {
  const f = fixture(); f.notices[1].targetType = 'USER'; f.notices[1].targetUserId = 'u'; f.notices[1].isPinnedByDefault = true;
  const items = await notificationFeed(f.db, { audience: 'DRIVER', targetType: 'ALL', isActive: true }, '');
  assert.equal(items[0].id, 'n0'); assert.ok(!items.some(row => row.id === 'n1'));
});
test('presentation defaults are collapsed and sorting preserves read state without mutating source arrays', () => {
  assert.deepEqual(notificationPreferences({}), { isPinnedByDefault: false, isPinned: false, isCollapsed: true });
  const input = [{ id: 'new', createdAt: '2026-11-25', isRead: false }, { id: 'old-pin', createdAt: '2026-01-01', isPinned: true, isRead: true }];
  assert.deepEqual(sortNotifications(input).map(row => row.id), ['old-pin', 'new']);
  assert.equal(input[0].id, 'new'); assert.equal(sortNotifications(input)[0].isRead, true);
});

function load(relative, mocks) {
  const source = readFileSync(new URL('../' + relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => { assert.ok(name in mocks, name); return mocks[name]; }, module, module.exports);
  return module.exports;
}
test('native controls render a three-line preview and save pin/collapse changes independently', async () => {
  let alerts = 0; const changes = [];
  const jsx = (type, props) => ({ type, props });
  const Content = load('apps/mobile-chat/NotificationContent.tsx', {
    react: { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: () => {} },
    'react-native': { Alert: { alert: () => alerts++ }, Text: 'Text', View: 'View', Pressable: 'Pressable' },
    'react/jsx-runtime': { jsx, jsxs: jsx },
  }).default;
  const content = Content({ item: { id: 'n0', isPinned: true }, message: 'Long text', onChange: async (id, patch) => changes.push([id, patch]) });
  assert.equal(content.props.children[0].props.numberOfLines, 3);
  const controls = content.props.children[1].props.children;
  controls[0].props.onPress(); await new Promise(resolve => setImmediate(resolve));
  controls[1].props.onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(changes, [['n0', { isCollapsed: false }], ['n0', { isPinned: false }]]); assert.equal(alerts, 0);
  const expanded = Content({ item: { id: 'n0', isCollapsed: false }, message: 'Body', onChange: async () => { throw new Error('offline'); } });
  assert.equal(expanded.props.children[0].props.numberOfLines, undefined);
  expanded.props.children[1].props.children[0].props.onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(alerts, 1);
});

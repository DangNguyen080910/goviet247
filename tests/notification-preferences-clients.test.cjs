const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8').replace(/import\.meta\.env\.VITE_API_BASE/g, '"https://offline.invalid"');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(id => { assert.ok(id in mocks, id); return mocks[id]; }, module, module.exports, ...Object.values(globals));
  return module.exports;
}
for (const role of ['driver', 'rider']) test(`${role} native client preserves preferences and PATCH changes use the right authenticated audience`, async () => {
  const item = { id: 'notice', title: 'Title', message: 'Body', createdAt: '2026-11-25', isActive: true, audience: role.toUpperCase(), isRead: true, isPinned: true, isCollapsed: false, isPinnedByDefault: true };
  const calls = [];
  const request = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => options.method === 'PATCH' ? { success: true, item: { ...item, isPinned: false } } : { success: true, items: [item], unreadCount: 0 } }; };
  const api = load(`apps/${role}-mobile/services/notificationApi.ts`, {
    '../constants/api': { API_BASE_URL: 'https://offline.invalid' },
    './storage': role === 'driver' ? { getDriverToken: async () => 'driver-session' } : { getRiderToken: async () => 'rider-session' },
    '../../mobile-chat/fetchWithTimeout.js': { fetchWithTimeout: request },
  }, { fetch: request });
  const rows = role === 'driver' ? (await api.fetchDriverNotifications()).items : await api.getSystemNotifications();
  assert.equal(rows[0].isPinned, true); assert.equal(rows[0].isCollapsed, false);
  const saved = await api.updateNotificationPreference('notice', { isPinned: false });
  assert.equal(saved.isPinned, false);
  const patch = calls.at(-1); assert.equal(patch.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(patch.options.body), { isPinned: false, audience: role.toUpperCase() });
  assert.equal(patch.options.headers.Authorization, `Bearer ${role}-session`);
  assert.ok(patch.url.endsWith('/api/public/system-notifications/notice/preferences'));
});
test('Rider Web reads personalized notices using its existing login and saves only preference changes', async () => {
  const calls = [];
  const fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ success: true, items: [], item: { id: 'n', isPinned: true } }) }; };
  const api = load('apps/web/src/api/systemNotificationsPublic.js', {
    '../../../mobile-chat/fetchWithTimeout.js': { fetchWithTimeout: fetch },
  }, { fetch, localStorage: { getItem: () => 'existing-session' } });
  await api.getPublicSystemNotifications({ audience: 'RIDER' });
  assert.equal(calls[0].url, 'https://offline.invalid/api/public/rider-notifications?audience=RIDER');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer existing-session');
  await api.updateNotificationPreference('n', { isCollapsed: false });
  assert.deepEqual(JSON.parse(calls[1].options.body), { audience: 'RIDER', isCollapsed: false });
});
test('anonymous Rider Web can read public announcements without requesting an OTP', async () => {
  let address;
  const api = load('apps/web/src/api/systemNotificationsPublic.js', { '../../../mobile-chat/fetchWithTimeout.js': {} }, {
    fetch: async url => { address = url; return { ok: true, json: async () => ({ success: true, items: [] }) }; },
    localStorage: { getItem: () => null },
  });
  await api.getPublicSystemNotifications({ audience: 'RIDER' });
  assert.equal(address, 'https://offline.invalid/api/public/system-notifications?audience=RIDER');
  await assert.rejects(api.updateNotificationPreference('n', { isPinned: true }), /đăng nhập/);
});

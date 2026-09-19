const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function acceptHandler(error) {
  const source = fs.readFileSync(path.join(root, 'apps/driver-mobile/app/dashboard.tsx'), 'utf8');
  const start = source.indexOf('    async (tripId: string) => {', source.indexOf('const handleAcceptTrip'));
  const end = source.indexOf('\n    },\n    [', start) + 6;
  assert.ok(start > 0 && end > start);
  const calls = [];
  const context = { availableTrips: [], getAcceptLockRemainingSeconds: () => 0,
    setAcceptingTripId: id => calls.push(['loading', id]),
    acceptDriverTrip: async () => { if (error) throw error; },
    loadAvailableTrips: async () => calls.push(['available']), loadMyTrips: async () => calls.push(['mine']),
    setActiveTab: tab => calls.push(['tab', tab]), showSuccess: () => calls.push(['success']),
    showError: () => calls.push(['error']), Error,
  };
  const js = ts.transpileModule(`const handler = ${source.slice(start, end)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const handler = vm.runInNewContext(js + '\nhandler;', context);
  return { handler, calls };
}
test('blocked acceptance silently clears loading and keeps available trips/tab', async () => {
  const { handler, calls } = acceptHandler(Object.assign(new Error('unavailable'), { code: 'TRIP_ACCEPT_UNAVAILABLE' }));
  await handler('trip'); assert.deepEqual(calls, [['loading','trip'], ['loading',null]]);
});
test('ordinary acceptance errors remain visible', async () => {
  const { handler, calls } = acceptHandler(new Error('insufficient wallet'));
  await handler('trip'); assert.deepEqual(calls, [['loading','trip'], ['error'], ['loading',null]]);
});
test('successful acceptance refreshes trips and opens my trips', async () => {
  const { handler, calls } = acceptHandler(); await handler('trip');
  assert.deepEqual(calls, [['loading','trip'], ['available'], ['mine'], ['tab','MY_TRIPS'], ['success'], ['loading',null]]);
});
for (const platform of ['android','ios','web']) test(`Rider usage telemetry on ${platform} is independent of push permissions`, async () => {
  const source = fs.readFileSync(path.join(root, 'apps/rider-mobile/services/authApi.ts'), 'utf8');
  const calls = [];
  const exports = {};
  const context = { exports, require: id => ({
    'react-native': { Platform: { OS: platform } }, '../constants/api': { API_BASE_URL: 'https://test.invalid' },
    './storage': { getRiderToken: async () => 'token', setRiderToken: async () => {}, removeRiderToken: async () => {} },
  })[id], fetch: async (url, options) => { calls.push([url, options]); return { ok: true, json: async () => ({ success: true, user: { id: 'rider' } }) }; } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  await exports.getMe('token');
  assert.equal(calls.length, platform === 'web' ? 1 : 2);
  if (platform !== 'web') { assert.ok(calls[1][0].endsWith('/devices/rider-app')); assert.equal(JSON.parse(calls[1][1].body).platform, platform); }
});

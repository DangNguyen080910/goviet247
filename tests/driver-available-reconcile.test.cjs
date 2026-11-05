const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'apps/driver-mobile/app/dashboard.tsx'), 'utf8');
const marker = dashboard.indexOf('    async function reconcileAvailableTrips()');
const start = dashboard.lastIndexOf('  useEffect(() => {', marker);
const endMarker = '  }, [loadAvailableTrips]);';
const end = dashboard.indexOf(endMarker, marker) + endMarker.length;
assert.ok(marker > 0 && start >= 0 && end > marker);
const js = ts.transpileModule(dashboard.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function polling(load) {
  let tick, onState, cleanup, calls = 0, removed = false;
  const app = { currentState: 'active', addEventListener: (_, fn) => { onState = fn; return { remove() { removed = true; } }; } };
  new Function('useEffect', 'AppState', 'loadAvailableTrips', 'setInterval', 'clearInterval', js)(
    fn => { cleanup = fn(); }, app, async () => { ++calls; return load(); },
    (fn, ms) => { assert.equal(ms, 5000); tick = fn; return 1; }, id => { assert.equal(id, 1); tick = undefined; },
  );
  return { tick: () => tick?.(), state(value) { app.currentState = value; onState(value); }, cleanup: () => cleanup(), get calls() { return calls; }, get removed() { return removed; } };
}

test('missed socket event: an active screen removes an already-accepted trip on the next poll without a tap or pull-to-refresh', async () => {
  let cards = [{ id: 'accepted' }, { id: 'pending' }];
  const poll = polling(async () => { cards = [{ id: 'pending' }]; });
  poll.tick(); await flush();
  assert.deepEqual(cards, [{ id: 'pending' }]);
  assert.equal(poll.calls, 1);
  poll.cleanup();
});
test('a slow HTTP response does not cause overlapping polling requests', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const poll = polling(() => pending);
  for (let i = 0; i < 20; ++i) poll.tick();
  assert.equal(poll.calls, 1);
  finish(); await flush();
  poll.tick(); await flush();
  assert.equal(poll.calls, 2);
  poll.cleanup();
});
test('no polling while backgrounded; returning to foreground refreshes immediately', async () => {
  const poll = polling(async () => {});
  poll.state('background'); poll.tick(); await flush();
  assert.equal(poll.calls, 0);
  poll.state('active'); await flush();
  assert.equal(poll.calls, 1);
  poll.cleanup();
  assert.equal(poll.removed, true);
  poll.tick(); poll.state('active'); await flush();
  assert.equal(poll.calls, 1);
});
test('availability polling recovers even while the realtime queue is stuck waiting for My Trips', async () => {
  const queueStart = dashboard.indexOf('  const reloadTripsFromRealtime = useCallback(');
  const queueEnd = dashboard.indexOf(', [loadAvailableTrips, loadMyTrips]);', queueStart);
  const body = dashboard.slice(queueStart, queueEnd).split('useCallback(')[1];
  let loads = 0;
  const reload = new Function('realtimeLoadingRef', 'realtimeReloadPendingRef', 'loadAvailableTrips', 'loadMyTrips', `return (${body});`)(
    { current: false }, { current: false }, async () => { ++loads; }, () => new Promise(() => {}),
  );
  void reload();
  const poll = polling(async () => { ++loads; });
  poll.tick(); await flush();
  assert.equal(loads, 2);
  poll.cleanup();
});

const apiJs = ts.transpileModule(fs.readFileSync(path.join(root, 'apps/driver-mobile/services/tripApi.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function api(fetchImpl) {
  let timeout, timeoutMs, cleared = 0;
  const exports = {};
  vm.runInNewContext(apiJs, { exports, AbortController,
    require: name => name === '../constants/api' ? { API_BASE_URL: 'https://test.invalid' } : { getDriverToken: async () => 'test-token' },
    fetch: fetchImpl, setTimeout: (fn, ms) => { timeout = fn; timeoutMs = ms; return 1; }, clearTimeout: () => { ++cleared; },
  });
  return { get: () => exports.getAvailableTrips(), abort: () => timeout(), get timeoutMs() { return timeoutMs; }, get cleared() { return cleared; } };
}
test('list requests bypass caches and release the timer on success', async () => {
  const f = api(async (_, options) => {
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ success: true, items: [{ id: 'pending' }] }) };
  });
  assert.deepEqual(await f.get(), [{ id: 'pending' }]);
  assert.equal(f.timeoutMs, 10000); assert.equal(f.cleared, 1);
});
test('a stalled list request aborts and a subsequent request can succeed', async () => {
  let count = 0;
  const f = api(async (_, { signal }) => {
    if (++count === 1) return new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('request aborted'))));
    return { ok: true, json: async () => ({ success: true, items: [] }) };
  });
  const waiting = f.get(); await flush(); f.abort();
  await assert.rejects(waiting, /request aborted/);
  assert.deepEqual(await f.get(), []);
  assert.equal(f.cleared, 2);
});
test('malformed or failed list responses are not interpreted as a valid empty list', async () => {
  for (const payload of [null, {}, { success: false }, { success: true, items: null }]) {
    const f = api(async () => ({ ok: true, json: async () => payload }));
    await assert.rejects(f.get(), /danh sách chuyến/);
    assert.equal(f.cleared, 1);
  }
});
test('API availability responses explicitly prevent HTTP caches', async () => {
  const source = fs.readFileSync(path.join(root, 'apps/api/src/controllers/tripController.js'), 'utf8');
  const a = source.indexOf('export async function listAvailableTrips('), b = source.indexOf('\n}', a) + 2;
  const list = new Function('prisma', 'getDriverConfigSnapshot', 'audienceWhere', source.slice(a, b).replace('export ', '') + ';return listAvailableTrips;')(
    { trip: { findMany: async ({ where }) => { assert.equal(where.status, 'PENDING'); assert.equal(where.driverId, null); return []; } } }, async () => ({}), () => ({}),
  );
  const headers = {};
  const res = { set(k, v) { headers[k] = v; }, json(data) { assert.equal(data.success, true); }, status() { assert.fail('list request failed'); } };
  await list({ user: { id: 'driver' } }, res);
  assert.equal(headers['Cache-Control'], 'no-store');
});

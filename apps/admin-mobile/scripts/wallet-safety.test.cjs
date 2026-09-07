const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const context = { exports: {}, require: (id) => { if (!(id in mocks)) throw new Error(id); return mocks[id]; }, console, setTimeout, ...globals };
  vm.runInNewContext(code, context); return context.exports;
}
function scenario() {
  const data = new Map(), receipts = new Map(), sent = [];
  let lost = false, old = false, clearFails = false;
  const storage = { getItem: async (key) => data.get(key) || null, setItem: async (key, value) => data.set(key, value), removeItem: async (key) => { if (clearFails) throw new Error('storage'); data.delete(key); } };
  const mocks = {
    '@react-native-async-storage/async-storage': storage,
    './storage': { getAdminUser: async () => ({ id: 'admin' }) },
    './adminRequest': { adminRequest: async (url, options) => {
      if (url.endsWith('capabilities')) return { walletOperationVersion: old ? 0 : 1 };
      sent.push(options.headers['Idempotency-Key']);
      const key = sent.at(-1);
      if (!receipts.has(key)) receipts.set(key, { walletOperationVersion: 1, item: { transaction: { id: key }, profile: { id: 'driver', balance: 500000 } } });
      if (lost) { lost = false; throw new Error('Network request failed'); }
      return receipts.get(key);
    } },
  };
  return { data, receipts, sent, module: () => load('walletOperations.ts', mocks), lose: () => { lost = true; }, old: () => { old = true; }, failClear: () => { clearFails = true; } };
}
const payload = { amount: 500000, note: 'Admin cộng ví' };
test('lost reply and app restart reuse the durable key without another credit', async () => {
  const s = scenario(); s.lose(); await assert.rejects(s.module().submitWalletOperation('driver', 'topup', payload));
  const relaunched = s.module(); assert.equal((await relaunched.readPendingWalletOperation()).amount, 500000);
  await relaunched.submitWalletOperation('driver', 'topup', payload);
  assert.equal(s.receipts.size, 1); assert.equal(s.sent[0], s.sent[1]); assert.equal(s.data.size, 0);
});
test('uncertain payment blocks a different amount or driver', async () => {
  const s = scenario(); s.lose(); const service = s.module(); await assert.rejects(service.submitWalletOperation('driver', 'topup', payload));
  await assert.rejects(service.submitWalletOperation('other', 'topup', payload));
  await assert.rejects(service.submitWalletOperation('driver', 'topup', { ...payload, amount: 1 })); assert.equal(s.sent.length, 1);
});
test('fast double tap sends one mutation', async () => {
  const s = scenario(), service = s.module(); const results = await Promise.allSettled([1, 2].map(() => service.submitWalletOperation('driver', 'topup', payload)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1); assert.equal(s.sent.length, 1);
});
test('older server is blocked before money request', async () => {
  const s = scenario(); s.old(); await assert.rejects(s.module().submitWalletOperation('driver', 'topup', payload)); assert.equal(s.sent.length, 0);
});
test('journal cleanup error never turns a confirmed payment into failure', async () => {
  const s = scenario(); s.failClear(); const result = await s.module().submitWalletOperation('driver', 'topup', payload); assert.equal(result.walletOperationVersion, 1);
  await s.module().submitWalletOperation('driver', 'topup', payload); assert.equal(s.receipts.size, 1);
});
test('empty/malformed successful API response is not treated as saved', async () => {
  const service = load('adminRequest.ts', {
    'react-native': { Alert: {} }, 'expo-router': { router: {} }, '../constants/api': { API_BASE_URL: 'http://test' },
    './storage': { getAdminToken: async () => 'test' }, './adminSocket': {},
  }, { fetch: async () => ({ ok: true, status: 200, json: async () => { throw new Error('invalid json'); } }) });
  await assert.rejects(service.adminRequest('/test', { method: 'POST' }));
});
test('shared request layer coalesces duplicate writes without retrying', async () => {
  let calls = 0;
  const service = load('adminRequest.ts', {
    'react-native': { Alert: {} }, 'expo-router': { router: {} }, '../constants/api': { API_BASE_URL: 'http://test' },
    './storage': { getAdminToken: async () => 'test' }, './adminSocket': {},
  }, { fetch: async () => { calls++; await new Promise(setImmediate); return { ok: true, status: 200, json: async () => ({ success: true }) }; } });
  await Promise.all([1, 2, 3].map(() => service.adminRequest('/test', { method: 'POST', body: '{}' })));
  assert.equal(calls, 1);
});

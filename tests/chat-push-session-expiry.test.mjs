import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeDriverDevices } from '../apps/api/src/services/driverPushAccess.js';

const past = new Date(0), future = new Date(Date.now() + 3600000);
const device = (id, extra = {}) => ({ userId: 'rider1', role: 'RIDER', pushSessionId: id, pushExpiresAt: past, ...extra });
const db = rows => ({ session: { findMany: async () => rows } });

test('Rider chat push survives a persistent upgrade with the old device JWT expiry', async () => {
  const d = device('legacy_upgraded');
  assert.deepEqual(await activeDriverDevices(db([{ id: d.pushSessionId, userId: d.userId, expiresAt: null }]), [d]), [d]);
});
test('expired, revoked, missing and mismatched sessions cannot receive chat push', async () => {
  for (const rows of [[], [{id:'session1',userId:'rider1',expiresAt:past}], [{id:'session1',userId:'other',expiresAt:null}]]) {
    assert.deepEqual(await activeDriverDevices(db(rows), [device('session1')]), []);
  }
  assert.deepEqual(await activeDriverDevices(db([{id:'legacy_revoked',userId:'rider1',expiresAt:past}]), [device('legacy_revoked',{pushExpiresAt:future})]), []);
});
test('untracked legacy devices still require a bounded unexpired token', async () => {
  const valid = device('legacy_valid', {pushExpiresAt:future});
  assert.deepEqual(await activeDriverDevices(db([]), [valid, device('legacy_expired'), device('legacy_immortal',{pushExpiresAt:null}), device(null)]), [valid]);
});
test('driver verification is still enforced when requested', async () => {
  const d = device('session1', {role:'DRIVER'});
  const database = {...db([{id:'session1',userId:'rider1',expiresAt:null}]), driverProfile:{findMany:async()=>[]}};
  assert.deepEqual(await activeDriverDevices(database,[d],{requireVerified:true}), []);
});

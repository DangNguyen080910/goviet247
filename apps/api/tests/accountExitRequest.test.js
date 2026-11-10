import test from 'node:test';
import assert from 'node:assert/strict';
import { accountExitRole, recordAccountExit, recordAccountReturn } from '../src/services/accountExitRequest.js';

function database() {
  const rows = new Map();
  return { rows, accountExitRequest: {
    async upsert({ where, create, update }) {
      const { userId, appRole } = where.userId_appRole;
      const key = `${userId}:${appRole}`;
      const old = rows.get(key);
      const row = old ? { ...old, ...update, requestCount: old.requestCount + update.requestCount.increment } : { ...create, returnedAt: null, requestCount: 1 };
      rows.set(key, row);
      return row;
    },
    async updateMany({ where, data }) {
      const row = rows.get(`${where.userId}:${where.appRole}`);
      if (!row || row.returnedAt || row.requestedAt > where.requestedAt.lte) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  } };
}
const t = n => new Date(`2026-11-10T${n}:00:00Z`);

test('authenticated app role takes precedence over primary role and rejects admin', () => {
  assert.equal(accountExitRole({ appRole: 'DRIVER', role: 'RIDER' }), 'DRIVER');
  assert.equal(accountExitRole({ role: 'RIDER' }), 'RIDER');
  assert.equal(accountExitRole({ appRole: 'ADMIN', role: 'DRIVER' }), null);
});

test('request and return stay separate for two roles sharing one user', async () => {
  const db = database();
  await recordAccountExit(db, 'u', 'DRIVER', t('10'));
  await recordAccountExit(db, 'u', 'RIDER', t('11'));
  await recordAccountReturn(db, 'u', 'RIDER', t('12'));
  assert.equal(db.rows.get('u:DRIVER').returnedAt, null);
  assert.deepEqual(db.rows.get('u:RIDER').returnedAt, t('12'));
  await recordAccountReturn(db, 'u', 'RIDER', t('13'));
  assert.deepEqual(db.rows.get('u:RIDER').returnedAt, t('12'));
});

test('new request resets return status, keeps count; old login cannot clear newer request', async () => {
  const db = database();
  await recordAccountExit(db, 'u', 'DRIVER', t('10'));
  await recordAccountReturn(db, 'u', 'DRIVER', t('11'));
  await recordAccountExit(db, 'u', 'DRIVER', t('12'));
  await recordAccountReturn(db, 'u', 'DRIVER', t('11'));
  assert.equal(db.rows.get('u:DRIVER').requestCount, 2);
  assert.equal(db.rows.get('u:DRIVER').returnedAt, null);
  assert.deepEqual(db.rows.get('u:DRIVER').requestedAt, t('12'));
});

test('normal login creates no request, invalid roles cannot write', async () => {
  const db = database();
  await recordAccountReturn(db, 'new', 'RIDER', t('10'));
  assert.equal(db.rows.size, 0);
  await assert.rejects(recordAccountExit(db, 'u', 'ADMIN'), /INVALID_ACCOUNT_EXIT_ROLE/);
});

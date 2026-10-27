import test from 'node:test';
import assert from 'node:assert/strict';
import { getDriverAccountingIdentityRows } from '../src/services/driverAccountingIdentity.js';
import { buildAccountingPdf } from '../src/services/accountingPdf.js';
test('quarter identity list deduplicates by account and retains missing identities', async () => {
  const start = new Date('2026-07-01'); const end = new Date('2026-09-30');
  const db = { trip: { findMany: async query => {
    assert.deepEqual(query.where, { status: 'COMPLETED', updatedAt: { gte: start, lte: end }, driverId: { not: null } });
    return [{ driverId: 'a' }, { driverId: 'a' }, { driverId: 'b' }, { driverId: 'c' }];
  } }, driverProfile: { findMany: async query => {
    assert.deepEqual(query.where.userId.in, ['a', 'b', 'c']);
    return [{ userId: 'a', id: 'profile-a', fullName: 'Nguyễn Văn An', citizenId: '001234567890', user: { phones: [{ e164: '+84900000000' }] } },
      { userId: 'b', id: 'profile-b', fullName: 'Nguyễn Văn An', citizenId: null, user: { phones: [] } }];
  } } };
  const rows = await getDriverAccountingIdentityRows(db, { start, end });
  assert.equal(rows.length, 4);
  assert.equal(rows[1][3], '001234567890');
  assert.equal(rows[2][3], 'Chưa cập nhật');
  assert.equal(rows[3][0], 'c');
  const pdf = await buildAccountingPdf(rows, { title: 'Thông tin tài xế đối chiếu kê khai thuế', quarter: 3, year: 2026, reportType: 'driverIdentity' });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});
test('empty quarter exports a header and avoids looking up all drivers', async () => {
  const rows = await getDriverAccountingIdentityRows({ trip: { findMany: async () => [] }, driverProfile: { findMany: () => { throw Error('must not query'); } } }, {});
  assert.equal(rows.length, 1);
});

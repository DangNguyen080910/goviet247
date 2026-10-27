import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
const source = readFileSync(new URL('../src/controllers/driverProfileController.js', import.meta.url), 'utf8');
const schema = new Function('z', 'isProvinceCode', 'DEFAULT_DRIVER_CONTRACT', source.slice(source.indexOf('const createDriverProfileSchema ='), source.indexOf('const createDriverBankAccountSchema =')) + '; return createDriverProfileSchema;')(z, () => true, { code: 'test', title: 'Test', version: 'v1' });
const payload = { fullName: 'Test Driver', vehicleType: 'CAR_5', vehicleBrand: 'Test', vehicleModel: 'Test', vehicleYear: 2026, plateNumber: '51A12345', documents: { CCCD_FRONT: 'a', CCCD_BACK: 'b', PORTRAIT: 'c', DRIVER_LICENSE: 'd', VEHICLE_REGISTRATION: 'e' }, contractAccepted: true };
test('registration retains leading zeros and supports legacy clients', () => {
  assert.equal(schema.parse({ ...payload, citizenId: ' 001234567890 ' }).citizenId, '001234567890');
  assert.equal(schema.parse(payload).citizenId, undefined);
});
test('registration rejects invalid or numeric CCCD values', () => {
  for (const citizenId of ['', '12345678901', '1234567890123', '00123456789A', 123456789012, null]) assert.equal(schema.safeParse({ ...payload, citizenId }).success, false);
});
const adminSource = readFileSync(new URL('../src/controllers/adminDriverProfileController.js', import.meta.url), 'utf8').replace(/^import.*;\n/gm, '').replace('export async function', 'async function');
test('admin rejects invalid CCCD before accessing database', async () => {
  const update = new Function('prisma', 'isProvinceCode', adminSource + '; return updateAdminDriverProfile;')({}, () => true);
  for (const citizenId of ['123', '00123456789A', 123456789012]) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await update({ body: { citizenId, reason: 'Correct document', expectedUpdatedAt: '2026-10-27T00:00:00Z' } }, res);
    assert.equal(res.statusCode, 400);
  }
});

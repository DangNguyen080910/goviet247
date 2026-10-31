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

test('vehicle color trims text, accepts legacy registration and rejects invalid values', () => {
  assert.equal(schema.parse({ ...payload, vehicleColor: '  Trắng ngọc trai  ' }).vehicleColor, 'Trắng ngọc trai');
  assert.equal(schema.parse(payload).vehicleColor, undefined);
  for (const vehicleColor of ['', '   ', 'x'.repeat(101), 123, null]) {
    assert.equal(schema.safeParse({ ...payload, vehicleColor }).success, false);
  }
});
test('admin stores vehicle color and records the correction', async () => {
  let saved, log;
  const date = new Date('2026-10-29T00:00:00Z');
  const tx = {
    $queryRaw: async () => [],
    driverProfile: {
      findUnique: async () => ({ id: 'driver1', userId: 'user1', vehicleColor: null, updatedAt: date, status: 'VERIFIED', user: { phones: [] } }),
      update: async args => { saved = args.data; },
    },
    user: { findUnique: async () => ({ displayName: 'Driver' }) },
    adminDriverActionLog: { create: async args => { log = args.data; } },
  };
  const update = new Function('prisma', 'isProvinceCode', adminSource + '; return updateAdminDriverProfile;')({ $transaction: fn => fn(tx) }, () => true);
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await update({ params: { id: 'driver1' }, body: { vehicleColor: '  Đỏ  ', vehicleFuelType: 'GASOLINE', reason: 'Bổ sung màu xe', expectedUpdatedAt: date.toISOString() } }, res);
  assert.equal(res.body.success, true);
  assert.equal(saved.vehicleColor, 'Đỏ');
  assert.equal(saved.vehicleFuelType, 'GASOLINE');
  assert.match(log.note, /Màu xe/);
});

test('registration supports explicit electric/gasoline fuel and legacy missing value only', () => {
  for(const vehicleFuelType of ['ELECTRIC','GASOLINE']) assert.equal(schema.parse({...payload,vehicleFuelType}).vehicleFuelType,vehicleFuelType);
  assert.equal(schema.parse(payload).vehicleFuelType,undefined);
  for(const vehicleFuelType of ['ANY','',null,123,'DIESEL']) assert.equal(schema.safeParse({...payload,vehicleFuelType}).success,false);
});

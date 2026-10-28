import test from 'node:test';
import assert from 'node:assert/strict';
import { riderPackageLines } from '../src/shared/riderTripPricing.js';
import { driverSurchargeLines } from '../src/shared/driverSurcharges.js';
test('ordinary and legacy trips never invent a package', () => {
 for (const value of [null, {}, { eligible:false, standardName:'A' }]) assert.deepEqual(riderPackageLines(value),[]);
});
test('mixed trip uses booked custom names and times for each day', () => {
 const s={eligible:true,standardName:'Gói ăn uống A',charterName:'Gói khám phá B',days:[{date:'2026-11-01',standardStart:'2026-11-01T04:42:00Z',standardEnd:'2026-11-01T14:00:00Z'},{date:'2026-11-02'},{date:'2026-11-03',standardStart:'2026-11-03T00:00:00Z',standardEnd:'2026-11-03T05:00:00Z'}],sessions:[{date:'2026-11-02',start:'2026-11-02T00:00:00Z',end:'2026-11-02T14:00:00Z',hours:8,flexible:true}]};
 const lines=riderPackageLines(s);
 assert.deepEqual(lines,['2026-11-01: Gói ăn uống A · 11:42–21:00','2026-11-02: Gói khám phá B · 07:00–21:00 · Tối đa 8 giờ','2026-11-03: Gói ăn uống A · 07:00–12:00']);
 assert.equal(lines.some(line=>line.includes('Tiêu chuẩn')),false);
});
test('surcharges can appear on an ordinary trip with no service package', () => {
 const trip={destinationService:{eligible:false,tourDisplay:{fuelSurchargePercent:20,fuelSurchargeAmount:418880}},holidaySurcharge:{percent:10,amount:209440}};
 assert.deepEqual(riderPackageLines(trip.destinationService),[]);
 assert.equal(driverSurchargeLines(trip).length,2);
});

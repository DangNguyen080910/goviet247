import test from 'node:test';
import assert from 'node:assert/strict';
import { driverSurchargeLines } from '../src/shared/driverSurcharges.js';
import { quotePrice } from '../src/services/pricingService.js';
test('shows booked amounts without adding or recalculating them', () => {
 const trip = { destinationService: { tourDisplay: { fuelSurchargePercent: 20, fuelSurchargeAmount: 418880, holidaySurcharge: { percent: 10, amount: 209440 } } } };
 assert.deepEqual(driverSurchargeLines(trip), ['Đã gồm phụ thu xe xăng 20%: 418.880 đ', 'Đã gồm phụ thu lễ, Tết 10%: 209.440 đ']);
});
test('legacy holiday is retained, unknown fuel and zero amounts remain hidden', () => {
 assert.deepEqual(driverSurchargeLines({ fuelPreference: 'GASOLINE', totalPrice: 2720000, holidaySurcharge: { percent: 10, amount: 209440 } }), ['Đã gồm phụ thu lễ, Tết 10%: 209.440 đ']);
 for (const value of [null, {}, { destinationService: { tourDisplay: { fuelSurchargePercent: 20, fuelSurchargeAmount: 0 } } }]) assert.deepEqual(driverSurchargeLines(value), []);
});
test('quote stores surcharge amounts inside the persisted destination snapshot', async () => {
 const db = { pricingConfig: { findFirst: async () => ({ baseFare: 50000, pricePerKm: 5000, pricePerHour: 10000, minFare: 100000, overnightFee: 350000, overnightTriggerKm: 600, overnightTriggerHours: 12, gasolineSurchargePercent: 20, holidaySurchargePercent: 10, holidayStartDate: '2027-01-01', holidayEndDate: '2027-01-01', holidayName: 'Tết', holidayNote: '' }) }, tripConfig: { findFirst: async () => ({}) } };
 const result = await quotePrice({ carType: 'CAR_5', direction: 'ONE_WAY', pickupTime: '2027-01-01T07:00:00+07:00', distanceKm: 100, driveMinutes: 120, fuelPreference: 'GASOLINE' },db);
 assert.equal(result.ok,true);
 const d = result.data, saved = d.destinationService.tourDisplay;
 assert.equal(saved.fuelSurchargeAmount,d.fuelSurchargeAmount);
 assert.equal(saved.holidaySurcharge.amount,d.holidaySurchargeAmount);
 assert.equal(driverSurchargeLines({destinationService:d.destinationService}).length,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { adminTripMoney } from '../src/services/adminTripMoney.js';
const cfg = { commissionPercent: 6, driverVatPercent: 3, driverPitPercent: 1.5 };
test('admin preserves saved net amount including zero and saved surcharges', () => {
 for (const driverReceiveSnapshot of [0, 895000]) {
  const trip = {status:'ACCEPTED',totalPrice:1000000,driverReceiveSnapshot,holidaySurcharge:{percent:10,amount:10000},destinationService:{tourDisplay:{fuelSurchargePercent:20,fuelSurchargeAmount:20000}}};
  const result=adminTripMoney(trip,{...cfg,commissionPercent:99});
  assert.equal(result.driverReceive,driverReceiveSnapshot);
  assert.equal(result.driverReceiveEstimated,false);
  assert.deepEqual(result.holidaySurcharge,trip.holidaySurcharge);
  assert.deepEqual(result.destinationService,trip.destinationService);
 }
});
test('pending trips show a labelled estimate, historical missing snapshots stay unknown', () => {
 const preview=adminTripMoney({status:'PENDING',totalPrice:1000000},cfg);
 assert.equal(preview.driverReceive,895000);
 assert.equal(preview.driverReceiveEstimated,true);
 assert.equal(adminTripMoney({status:'COMPLETED',totalPrice:1000000},cfg).driverReceive,null);
});

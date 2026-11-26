import * as vehiclePolicy from '../src/services/tripVehiclePolicy.js';
import test from "node:test";
import assert from "node:assert/strict";
import { tripAcceptFeedback } from "../src/shared/tripAcceptFeedback.js";
import { assertCurrentContractForNewTrip } from '../src/services/driverContract.js';
test("blocked acceptance and unknown errors direct drivers to support", () => {
  const expected = "Bạn không thể nhận chuyến này. Vui lòng liên hệ Zalo team support GoViet247 để được hỗ trợ.";
  assert.equal(tripAcceptFeedback({ code: "TRIP_ACCEPT_UNAVAILABLE", message: "blocked" }), expected);
  assert.equal(tripAcceptFeedback({ code: "UNKNOWN", message: "internal detail" }), expected);
});
test("preserves confirmed reasons and variable wallet amounts", () => {
  for (const code of ["VEHICLE_CAPACITY_MISMATCH", "VEHICLE_FUEL_MISMATCH", "DRIVER_VEHICLE_INFO_REQUIRED", "TRIP_VEHICLE_INVALID", "TRIP_FUEL_INVALID", "INSUFFICIENT_BALANCE", "ACTIVE_TRIP_LIMIT", "TRIP_CANCELLED", "TRIP_ALREADY_ACCEPTED", "TRIP_ALREADY_YOURS", "TRIP_NOT_OPEN"]) {
    assert.equal(tripAcceptFeedback({ code, message: "Confirmed reason 95.000đ" }), "Confirmed reason 95.000đ");
  }
});
test("uncertain network result never claims someone else won the trip", () => {
  const message = tripAcceptFeedback({ code: "NETWORK_UNCONFIRMED" });
  assert.match(message, /Đơn của tôi/);
  assert.doesNotMatch(message, /tài xế khác/);
});
test("auth errors are actionable and internal errors are not exposed", () => {
  assert.match(tripAcceptFeedback({ status: 401 }), /đăng nhập lại/);
  assert.doesNotMatch(tripAcceptFeedback({ message: "Snapshot tài chính không hợp lệ" }), /Snapshot/);
});

import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/controllers/tripController.js', import.meta.url), 'utf8');
const begin = source.indexOf('export async function acceptTrip(');
const finish = source.indexOf('\n}', begin) + 2;
const acceptBody = source.slice(begin, finish).replace('export ', '');
test('paused contract enforcement keeps KYC, trip availability, opening time, limits and wallet checks', async () => {
  const baseTrip = { carType:'CAR_5', fuelPreference:'ANY', id:'trip1', status:'PENDING', isVerified:true, verifiedAt:new Date(), totalPrice:1000000 };
  const cases = [
    [{ ...baseTrip, status:'CANCELLED' }, 0, 100000, 'TRIP_CANCELLED'],
    [{ ...baseTrip, status:'ACCEPTED', driverId:'other' }, 0, 100000, 'TRIP_ALREADY_ACCEPTED'],
    [{ ...baseTrip, status:'ACCEPTED', driverId:'driver1' }, 0, 100000, 'TRIP_ALREADY_YOURS'],
    [{ ...baseTrip, driverAcceptOpenAt:new Date(Date.now()+60000) }, 0, 100000, 'TRIP_NOT_OPEN'],
    [baseTrip, 3, 100000, 'ACTIVE_TRIP_LIMIT'],
    [baseTrip, 0, 50000, 'INSUFFICIENT_BALANCE'],
    [baseTrip, 0, 100000, 'DRIVER_NOT_VERIFIED', 'PENDING'],
  ];
  for (const [trip, activeCount, balance, expectedCode, status = 'VERIFIED'] of cases) {
    const tx = { driverProfile:{ findUnique:async () => ({ id:'profile1', status, balance, vehicleType:'CAR_5' }) }, trip:{ findUnique:async () => trip } };
    const dependencies = {...vehiclePolicy, assertCurrentContractForNewTrip:(db,profile)=>assertCurrentContractForNewTrip(db,profile,{}),
      prisma:{ $transaction:fn => fn(tx) },
      getDriverConfigSnapshot:async () => ({ maxActiveTrips:3 }),
      lockDriverProfile:async () => {}, lockTrip:async () => {}, assertTripAcceptanceAllowed:() => {},
      canDriverSeeTrip:() => true, countDriverActiveTrips:async () => activeCount,
      calculateDriverFinanceSnapshot:() => ({ requiredWalletAmount:95000 }),
      console:{ log:() => {}, error:() => {} },
    };
    const accept = new Function(...Object.keys(dependencies), acceptBody+'; return acceptTrip;')(...Object.values(dependencies));
    const res = { status(code) { this.statusCode=code; return this; }, json(body) { this.body=body; return this; } };
    await accept({ body:{tripId:'trip1'}, user:{id:'driver1'} }, res);
    assert.equal(res.body.code,expectedCode);
    if (expectedCode === 'INSUFFICIENT_BALANCE') {
      assert.equal(res.body.data.missingAmount,45000);
      assert.match(res.body.message,/45\.000/);
    }
  }
});

test('contract reminder reason remains actionable in driver app',()=>{assert.equal(tripAcceptFeedback({code:'CONTRACT_ACCEPTANCE_REQUIRED',message:'Mở Hồ sơ → Hợp đồng để xác nhận.'}),'Mở Hồ sơ → Hợp đồng để xác nhận.');});

import test from "node:test";
import assert from "node:assert/strict";
import { tripAcceptFeedback } from "../src/shared/tripAcceptFeedback.js";
test("blocked acceptance remains silent", () => {
  assert.equal(tripAcceptFeedback({ code: "TRIP_ACCEPT_UNAVAILABLE", message: "blocked" }), null);
});
test("preserves confirmed reasons and variable wallet amounts", () => {
  for (const code of ["INSUFFICIENT_BALANCE", "ACTIVE_TRIP_LIMIT", "TRIP_CANCELLED", "TRIP_ALREADY_ACCEPTED", "TRIP_ALREADY_YOURS", "TRIP_NOT_OPEN"]) {
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
test('backend distinguishes cancelled trips, another driver, own trip, opening time, limits and wallet balance', async () => {
  const baseTrip = { id:'trip1', status:'PENDING', isVerified:true, verifiedAt:new Date(), totalPrice:1000000 };
  const cases = [
    [{ ...baseTrip, status:'CANCELLED' }, 0, 100000, 'TRIP_CANCELLED'],
    [{ ...baseTrip, status:'ACCEPTED', driverId:'other' }, 0, 100000, 'TRIP_ALREADY_ACCEPTED'],
    [{ ...baseTrip, status:'ACCEPTED', driverId:'driver1' }, 0, 100000, 'TRIP_ALREADY_YOURS'],
    [{ ...baseTrip, driverAcceptOpenAt:new Date(Date.now()+60000) }, 0, 100000, 'TRIP_NOT_OPEN'],
    [baseTrip, 3, 100000, 'ACTIVE_TRIP_LIMIT'],
    [baseTrip, 0, 50000, 'INSUFFICIENT_BALANCE'],
  ];
  for (const [trip, activeCount, balance, expectedCode] of cases) {
    const tx = { driverProfile:{ findUnique:async () => ({ id:'profile1', status:'VERIFIED', balance }) }, trip:{ findUnique:async () => trip } };
    const dependencies = {
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

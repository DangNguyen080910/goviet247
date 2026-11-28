import test from "node:test";
import assert from "node:assert/strict";
import { destinationQuoteSummary, destinationConfig, TWO_ONE_WAY_TRIPS_NOTICE } from "../src/shared/destinationService.js";
import { buildDestinationSnapshot } from "../src/services/destinationService.js";
test("one-way and disabled destination service still show both configured quote notices", () => {
  const config = { enabled:false, allInclusiveNotice:"Giá trọn gói đã cấu hình", paymentNotice:"Thanh toán đã cấu hình" };
  for (const snapshot of [null, {eligible:false}]) {
    assert.deepEqual(destinationQuoteSummary(snapshot,config), [config.allInclusiveNotice, config.paymentNotice]);
  }
});
test("quote snapshot preserves the notice text agreed for that quote", () => {
  assert.deepEqual(destinationQuoteSummary({ eligible:false, allInclusiveNotice:"Giá đã báo", paymentNotice:"Thanh toán đã báo" },{allInclusiveNotice:"Mới"}), ["Giá đã báo","Thanh toán đã báo"]);
});
test("destination package quotes keep descriptions and include each notice only once", () => {
  const config = destinationConfig();
  const snapshot = buildDestinationSnapshot(config, {direction:"ROUND_TRIP", pickupTime:"2026-11-01T07:00:00+07:00", returnTime:"2026-11-03T12:00:00+07:00", outboundDriveMinutes:240, destinationServiceDates:[], dropoffAddress:"Khách sạn"});
  const lines = destinationQuoteSummary(snapshot,config);
  assert(lines.includes(snapshot.standardDescription));
  assert.equal(lines.filter(line => line === config.allInclusiveNotice).length,1);
  assert.equal(lines.filter(line => line === config.paymentNotice).length,1);
});

test("customer quote introduces only applicable charges as included in the total", () => {
  const charter = "Phí Bao xe: 1.533.571đ";
  const overnight = "Phí Ăn nghỉ tài xế · 1 đêm: 200.000đ";
  const label = "Giá trên đã bao gồm";
  for (const [mode, nights, expected] of [
    ["CHARTER", 1, [charter, overnight]],
    ["CHARTER", 0, [charter]],
    ["STANDARD", 1, [overnight]],
    ["STANDARD", 0, []],
  ]) {
    const lines = destinationQuoteSummary({
      version: 5, eligible: true, selectionMode: mode, fee: 1533571,
      tourDisplay: { overnightCount: nights, overnightCost: nights * 200000 },
    });
    if (expected.length) assert.deepEqual(lines.slice(-(expected.length + 1)), [label, ...expected]);
    else assert.ok(!lines.includes(label));
  }
});

test("only round-trip quotes without Bao xe and with an overnight fee suggest two one-way trips", () => {
  const quote = { version: 5, eligible: true, selectionMode: "STANDARD", fee: 0,
    tourDisplay: { overnightCount: 1, overnightCost: 300000, returnTime: "2026-12-01T09:00:00Z" } };
  const lines = destinationQuoteSummary(quote);
  assert.deepEqual(lines.slice(-3), ["Giá trên đã bao gồm", "Phí Ăn nghỉ tài xế · 1 đêm: 300.000đ", TWO_ONE_WAY_TRIPS_NOTICE]);
  for (const snapshot of [
    { ...quote, selectionMode: "CHARTER", fee: 985714 },
    { ...quote, tourDisplay: { ...quote.tourDisplay, returnTime: null } },
    { ...quote, tourDisplay: { ...quote.tourDisplay, overnightCost: 0 } },
  ]) {
    assert.ok(!destinationQuoteSummary(snapshot).includes(TWO_ONE_WAY_TRIPS_NOTICE));
  }
});

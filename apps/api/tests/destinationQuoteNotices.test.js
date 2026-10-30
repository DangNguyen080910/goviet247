import test from "node:test";
import assert from "node:assert/strict";
import { destinationQuoteSummary, destinationConfig } from "../src/shared/destinationService.js";
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

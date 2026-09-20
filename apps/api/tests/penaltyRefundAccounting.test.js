import test from "node:test";
import assert from "node:assert/strict";
import { summarizeApprovedPenaltyRefunds } from "../src/services/penaltyRefundAccounting.js";

test("only same-driver approved penalties reduce penalty income", () => {
  const penalties = [
    { tripId: "trip-a", driverProfileId: "driver-one" },
    { tripId: "trip-b", driverProfileId: "driver-three" },
  ];
  const refunds = [
    { tripId: "trip-a", driverProfileId: "driver-one", amount: 100, note: "Hoàn tiền phạt huỷ chuyến" },
    { tripId: "trip-a", driverProfileId: "driver-two", amount: 75, note: "Hoàn tiền phạt huỷ chuyến" },
    { tripId: "trip-b", driverProfileId: "driver-three", amount: 50, note: "TripID: wrong-trip" },
    { tripId: "trip-c", driverProfileId: "driver-three", amount: 25, note: "Hoàn tiền phạt huỷ chuyến" },
  ];
  assert.deepEqual(summarizeApprovedPenaltyRefunds(refunds, penalties), {
    amount: 150, count: 2, otherHoldRefundAmount: 100, otherHoldRefundCount: 2,
  });
});

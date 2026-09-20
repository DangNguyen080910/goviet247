import assert from "node:assert/strict";
import test from "node:test";
import { refundCustomerCancellationHold } from "../src/services/customerCancellationRefund.js";

const trip = {
  id: "trip-1", driverId: "driver-1",
  driver: { driverProfile: { id: "wallet-1" } },
  commissionAmountSnapshot: 100, driverVatAmountSnapshot: 15,
  driverPitAmountSnapshot: 5, requiredWalletAmountSnapshot: 120,
};

function fixture({ holds = [
  { type: "COMMISSION_HOLD", amount: -100 },
  { type: "DRIVER_VAT_HOLD", amount: -15 },
  { type: "DRIVER_PIT_HOLD", amount: -5 },
], previousCredits = [] } = {}) {
  let balance = 880;
  const created = [];
  const tx = {
    driverWalletTransaction: {
      findMany: async ({ where }) => where.type.in.includes("ADJUST_ADD") ? previousCredits : holds,
      create: async ({ data }) => { created.push(data); return data; },
    },
    driverProfile: {
      update: async ({ data }) => {
        balance += data.balance.increment;
        return { balance };
      },
    },
  };
  return { tx, created, getBalance: () => balance };
}

test("customer cancellation refunds each held component once with a balanced wallet trail", async () => {
  const { tx, created, getBalance } = fixture();
  const result = await refundCustomerCancellationHold(tx, trip);
  assert.equal(result.amount, 120);
  assert.equal(getBalance(), 1000);
  assert.deepEqual(created.map(({ type, amount, balanceBefore, balanceAfter }) =>
    [type, amount, balanceBefore, balanceAfter]), [
    ["COMMISSION_REFUND", 100, 880, 980],
    ["DRIVER_VAT_REFUND", 15, 980, 995],
    ["DRIVER_PIT_REFUND", 5, 995, 1000],
  ]);
  assert.ok(created.every(({ tripId }) => tripId === trip.id));
});

test("customer cancellation stops if a prior manual credit exists for this trip", async () => {
  const { tx, created, getBalance } = fixture({ previousCredits: [{ amount: 120 }] });
  await assert.rejects(refundCustomerCancellationHold(tx, trip), { statusCode: 409 });
  assert.equal(getBalance(), 880);
  assert.equal(created.length, 0);
});

test("customer cancellation stops if a hold is missing or duplicated", async () => {
  for (const holds of [
    [{ type: "COMMISSION_HOLD", amount: -100 }, { type: "DRIVER_VAT_HOLD", amount: -15 }],
    [{ type: "COMMISSION_HOLD", amount: -100 }, { type: "COMMISSION_HOLD", amount: -100 },
      { type: "DRIVER_VAT_HOLD", amount: -15 }, { type: "DRIVER_PIT_HOLD", amount: -5 }],
  ]) {
    const { tx, created, getBalance } = fixture({ holds });
    await assert.rejects(refundCustomerCancellationHold(tx, trip), { statusCode: 409 });
    assert.equal(getBalance(), 880);
    assert.equal(created.length, 0);
  }
});

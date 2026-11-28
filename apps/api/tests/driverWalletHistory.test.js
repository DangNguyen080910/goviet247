import assert from "node:assert/strict";
import test from "node:test";
import { loadDriverWalletHistory } from "../src/services/driverWalletHistory.js";

function transaction(id, type, amount, balanceBefore, day, walletHoldId) {
  return {
    id, type, amount, balanceBefore, balanceAfter: balanceBefore + amount,
    walletHoldId, tripId: "trip", driverProfileId: "driver",
    createdAt: new Date(`2026-11-${day}T00:00:00Z`), note: "Sổ sách nội bộ",
  };
}

function walletDb(recent, related, inspectQuery = () => {}) {
  return { driverWalletTransaction: { async findMany(query) {
    assert.equal(query.where.driverProfileId, "driver");
    if (!query.where.OR) return recent.slice(0, query.take);
    inspectQuery(query);
    return related;
  } } };
}

test("driver wallet shows one charge per assignment and cancellation as an existing hold", async () => {
  const first = transaction("a", "COMMISSION_HOLD", -70, 500, 10, "trip:1");
  const firstVat = transaction("b", "DRIVER_VAT_HOLD", -20, 430, 10, "trip:1");
  const penalty = transaction("d", "TRIP_CANCEL_PENALTY", -90, 500, 11, "trip:1");
  const second = transaction("e", "COMMISSION_HOLD", -100, 410, 12, "trip:2");
  const secondPit = transaction("f", "DRIVER_PIT_HOLD", -30, 310, 12, "trip:2");
  const rows = [secondPit, second, penalty, firstVat, first];
  const history = await loadDriverWalletHistory(walletDb(rows, rows), "driver", 10);
  assert.deepEqual(history.map(({ type, amount, balanceBefore, balanceAfter }) =>
    [type, amount, balanceBefore, balanceAfter]), [
    ["COMMISSION_HOLD", -130, 410, 280],
    ["TRIP_CANCEL_PENALTY", 90, 410, 410],
    ["COMMISSION_HOLD", -90, 500, 410],
  ]);
  assert.equal(history[1].balanceUnchanged, true);
  assert.equal(history[0].note, null);
});

test("wallet completes a legacy refund group at the display limit", async () => {
  const refund = transaction("a", "COMMISSION_REFUND", 50, 200, 10, null);
  const refundVat = transaction("b", "DRIVER_VAT_REFUND", 10, 250, 10, null);
  const refundPit = transaction("c", "DRIVER_PIT_REFUND", 5, 260, 10, null);
  const db = walletDb([refundPit], [refund, refundVat, refundPit], ({ where }) => {
    assert.deepEqual(where.OR, [{ tripId: { in: ["trip"] } }]);
  });
  const history = await loadDriverWalletHistory(db, "driver", 1);
  assert.equal(history.length, 1);
  assert.deepEqual(
    [history[0].type, history[0].amount, history[0].balanceBefore, history[0].balanceAfter],
    ["COMMISSION_REFUND", 65, 200, 265],
  );
});

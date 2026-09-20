import test from "node:test";
import assert from "node:assert/strict";
import { getPenaltyRefundQuote, mutateAdminWallet } from "../src/services/adminWalletMutation.js";

function database() {
  let state = { balance: 0, transactions: [], penalties: [{ tripId: "trip-1", driverProfileId: "driver-A", status: "APPROVED", penaltyAmount: 100 }] };
  const db = {
    get state() { return state; },
    async $transaction(callback) {
      const draft = structuredClone(state);
      const tx = {
        driverProfile: {
          updateMany: async ({ where, data }) => {
            if (where.id !== "driver-A") return { count: 0 };
            draft.balance += data.balance.increment;
            return { count: 1 };
          },
          findUnique: async () => ({ id: "driver-A", balance: draft.balance, user: { id: "user-A" } }),
        },
        driverTripPenaltyLog: {
          findMany: async ({ where }) => draft.penalties.filter((item) => item.tripId === where.tripId && item.driverProfileId === where.driverProfileId && item.status === where.status),
        },
        driverWalletTransaction: {
          findMany: async ({ where }) => draft.transactions.filter((item) => item.driverProfileId === where.driverProfileId && item.type === where.type &&
            where.OR.some((condition) => condition.tripId === item.tripId || item.note.includes(condition.note?.contains || "\u0000"))),
          create: async ({ data }) => { const item = { id: `txn-${draft.transactions.length}`, ...data }; draft.transactions.push(item); return item; },
        },
      };
      const result = await callback(tx);
      state = draft;
      return result;
    },
  };
  return db;
}

const refund = (amount, tripId = "trip-1") => ({
  driverId: "driver-A", type: "ADJUST_ADD", amount,
  note: `Hoàn tiền phạt huỷ chuyến - TripID: ${tripId}`,
  actorId: 1, actorUsername: "admin", key: null,
});

test("refund increases balance once and cannot exceed the approved penalty", async () => {
  const db = database();
  await mutateAdminWallet(db, refund(60));
  const quote = await getPenaltyRefundQuote({
    driverTripPenaltyLog: { findMany: async () => db.state.penalties },
    driverWalletTransaction: { findMany: async () => db.state.transactions },
  }, "driver-A", "trip-1");
  assert.equal(quote.refundableAmount, 40);
  await assert.rejects(mutateAdminWallet(db, refund(41)), { statusCode: 400 });
  assert.equal(db.state.balance, 60);
  await mutateAdminWallet(db, refund(40));
  assert.equal(db.state.balance, 100);
  assert.equal(db.state.transactions.length, 2);
  assert.ok(db.state.transactions.every((item) => item.tripId === "trip-1"));
});

test("refund note must reference a penalty for the same driver and trip", async () => {
  const db = database();
  await assert.rejects(mutateAdminWallet(db, refund(20, "trip-other")), { statusCode: 404 });
  await assert.rejects(mutateAdminWallet(db, { ...refund(20), note: "Hoàn tiền phạt huỷ chuyến - TripID:" }), { statusCode: 400 });
  assert.equal(db.state.balance, 0);
});

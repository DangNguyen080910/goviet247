import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { refundCustomerCancellationHold } from "../src/services/customerCancellationRefund.js";

const source = readFileSync(new URL("../src/controllers/adminTripController.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replaceAll("export async function", "async function");

function fixture(status = "ACCEPTED") {
  let trip = {
    id: "trip-1", status, driverId: "driver-A", riderId: null,
    cancelledAt: null, requiredWalletAmountSnapshot: 120,
    commissionAmountSnapshot: 100, driverVatAmountSnapshot: 10,
    driverPitAmountSnapshot: 10, verifiedById: 1, verifiedAt: new Date(),
    driver: { displayName: "Tài xế A", phones: [{ e164: "+84123456789" }],
      driverProfile: { id: "profile-A", fullName: "Tài xế A", balance: 880 } },
  };
  const penalties = [], walletWrites = [], actionLogs = [];
  const holds = [
    { type: "COMMISSION_HOLD", amount: -100, tripId: "trip-1", driverProfileId: "profile-A" },
    { type: "DRIVER_VAT_HOLD", amount: -10, tripId: "trip-1", driverProfileId: "profile-A" },
    { type: "DRIVER_PIT_HOLD", amount: -10, tripId: "trip-1", driverProfileId: "profile-A" },
  ];
  const prisma = {
    trip: { findUnique: async () => structuredClone(trip) },
    async $transaction(callback) {
      const draft = structuredClone(trip);
      const tx = {
        trip: {
          findUnique: async () => structuredClone(draft),
          updateMany: async ({ data }) => { Object.assign(draft, data); return { count: 1 }; },
          update: async ({ data }) => { Object.assign(draft, data); return structuredClone(draft); },
        },
        driverTripPenaltyLog: {
          create: async ({ data }) => { const row = { id: `penalty-${penalties.length}`, ...data }; penalties.push(row); return row; },
        },
        driverWalletTransaction: {
          findMany: async ({ where }) => where.type.in.includes("ADJUST_ADD") ? [] : holds,
          create: async ({ data }) => { walletWrites.push(data); return { id: `wallet-${walletWrites.length}`, ...data }; },
        },
        driverProfile: {
          update: async ({ data }) => {
            draft.driver.driverProfile.balance += data.balance.increment;
            return { balance: draft.driver.driverProfile.balance };
          },
          updateMany: async () => { throw new Error("unexpected balance update"); },
        },
        adminTripActionLog: { create: async ({ data }) => { actionLogs.push(data); return data; } },
        systemNotification: { create: async ({ data }) => ({ id: "notice", ...data }) },
      };
      const result = await callback(tx);
      trip = draft;
      return result;
    },
  };
  const factory = new Function("prisma", "lockDriverProfile", "lockTrip", "sendAdminPushNotification",
    "sendSystemNotificationToDriver", "sendTripStatusChangedToRider", "refundCustomerCancellationHold",
    `${source}; return { adminDriverCancelToReview, adminHuyChuyen };`);
  const actions = factory(prisma, async () => {}, async () => {}, async () => {}, async () => {}, async () => {}, refundCustomerCancellationHold);
  const req = (body) => ({ params: { id: "trip-1" }, body,
    admin: { id: 1, username: "admin", role: "ADMIN" }, app: { get: () => null } });
  const res = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } });
  return { actions, req, res, get trip() { return trip; }, penalties, walletWrites, actionLogs };
}

test("return to review records one penalty from the held amount without a new debit", async () => {
  const f = fixture();
  const response = f.res();
  await f.actions.adminDriverCancelToReview(f.req({ reason: "Tài xế nhận nhầm" }), response);
  assert.equal(response.statusCode, 200);
  assert.equal(f.trip.status, "PENDING");
  assert.equal(f.trip.driverId, null);
  assert.equal(f.penalties.length, 1);
  assert.equal(f.penalties[0].penaltyAmount, 120);
  assert.equal(f.penalties[0].driverProfileId, "profile-A");
  assert.equal(f.trip.driver.driverProfile.balance, 880);
  assert.equal(f.walletWrites.length, 0);
});

test("driver cancellation returns a pre-pickup trip to review with one penalty", async () => {
  const f = fixture("CONTACTED");
  const first = f.res();
  await f.actions.adminHuyChuyen(f.req({ cancel_reason: "Tài xế nhận nhầm", cancel_origin: "DRIVER" }), first);
  assert.equal(first.statusCode, 200);
  assert.equal(f.trip.status, "PENDING");
  assert.equal(f.trip.driverId, null);
  assert.equal(f.penalties.length, 1);
  const retry = f.res();
  await f.actions.adminHuyChuyen(f.req({ cancel_reason: "Tài xế nhận nhầm", cancel_origin: "DRIVER" }), retry);
  assert.equal(retry.statusCode, 409);
  assert.equal(f.penalties.length, 1);
  assert.equal(f.trip.driver.driverProfile.balance, 880);
  assert.equal(f.walletWrites.length, 0);
});

test("driver cancellation does not reopen a trip already in progress", async () => {
  const f = fixture("IN_PROGRESS");
  const response = f.res();
  await f.actions.adminHuyChuyen(f.req({ cancel_reason: "Tài xế không đi tiếp", cancel_origin: "DRIVER" }), response);
  assert.equal(response.statusCode, 409);
  assert.equal(f.trip.status, "IN_PROGRESS");
  assert.equal(f.penalties.length, 0);
});

test("customer cancellation refunds the held amount once and creates no driver penalty", async () => {
  const f = fixture("CONTACTED");
  const response = f.res();
  await f.actions.adminHuyChuyen(f.req({ cancel_reason: "Khách đổi kế hoạch", cancel_origin: "CUSTOMER" }), response);
  assert.equal(response.statusCode, 200);
  assert.equal(f.trip.status, "CANCELLED");
  assert.equal(f.penalties.length, 0);
  assert.equal(f.trip.driver.driverProfile.balance, 1000);
  assert.equal(f.walletWrites.length, 3);
  assert.deepEqual(f.walletWrites.map((item) => item.type), ["COMMISSION_REFUND", "DRIVER_VAT_REFUND", "DRIVER_PIT_REFUND"]);
  assert.equal(response.body.refundAmount, 120);
  assert.match(f.actionLogs[0].note, /\[CUSTOMER\]/);
});

test("older admin client can cancel without silently creating a driver penalty", async () => {
  const f = fixture("ACCEPTED");
  const response = f.res();
  await f.actions.adminHuyChuyen(f.req({ cancel_reason: "Khách đổi kế hoạch" }), response);
  assert.equal(response.statusCode, 200);
  assert.equal(f.trip.status, "CANCELLED");
  assert.equal(f.penalties.length, 0);
  assert.match(f.actionLogs[0].note, /\[UNSPECIFIED\]/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
          create: async (args) => { walletWrites.push(args); throw new Error("unexpected wallet debit"); },
        },
        driverProfile: {
          update: async () => { throw new Error("unexpected balance update"); },
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
    "sendSystemNotificationToDriver", "sendTripStatusChangedToRider",
    `${source}; return { adminDriverCancelToReview, adminHuyChuyen };`);
  const actions = factory(prisma, async () => {}, async () => {}, async () => {}, async () => {}, async () => {});
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

test("admin cancel records the penalty once and retry cannot add another", async () => {
  const f = fixture("CONTACTED");
  const first = f.res();
  await f.actions.adminHuyChuyen(f.req({ cancel_reason: "Tài xế nhận nhầm" }), first);
  assert.equal(first.statusCode, 200);
  assert.equal(f.trip.status, "CANCELLED");
  assert.equal(f.penalties.length, 1);
  const retry = f.res();
  await f.actions.adminHuyChuyen(f.req({ cancel_reason: "Tài xế nhận nhầm" }), retry);
  assert.equal(retry.statusCode, 400);
  assert.equal(f.penalties.length, 1);
  assert.equal(f.trip.driver.driverProfile.balance, 880);
  assert.equal(f.walletWrites.length, 0);
});

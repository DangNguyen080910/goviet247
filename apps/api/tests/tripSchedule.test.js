import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTripTime } from "../src/utils/tripTime.js";

function fixture(initial = {}) {
  const pickupTime = new Date("2026-09-23T11:30:00.000Z");
  const returnTime = new Date("2026-09-24T00:30:00.000Z");
  const trip = { id: "schedule-test", status: "PENDING", direction: "ROUND_TRIP",
    driverId: null, riderId: null, acceptedAt: null, cancelledAt: null,
    isVerified: true, pickupTime, returnTime, stops: [], ...initial };
  const logs = [], writes = [];
  const tx = {
    trip: {
      findUnique: async () => ({ ...trip }),
      update: async ({ data }) => { writes.push(data); Object.assign(trip, data); return { ...trip }; },
      updateMany: async ({ data }) => { writes.push(data); Object.assign(trip, data); return { count: 1 }; },
    },
    tripStop: { deleteMany: async () => {}, createMany: async () => {} },
    adminTripActionLog: { create: async ({ data }) => { logs.push(data); return data; } },
    systemNotification: { create: async ({ data }) => ({ id: "notice", ...data }) },
  };
  const prisma = { ...tx, $transaction: async (fn) => fn(tx), driverConfig: { findFirst: async () => ({ newTripAcceptDelaySeconds: 0 }) } };
  const noop = async () => {};
  function controller(file, names) {
    const source = readFileSync(new URL(`../src/controllers/${file}.js`, import.meta.url), "utf8")
      .replace(/^import[\s\S]*?;\n/gm, "").replaceAll("export async function", "async function");
    return new Function("prisma", "parseTripTime", "lockTrip", "sendAdminPushNotification", "sendTripStatusChangedToRider", "sendSystemNotificationToDriver", "sendNewTripToDrivers", "console",
      `${source}; return {${names.join(",")}};`)(prisma, parseTripTime, noop, noop, noop, noop, noop, { log() {}, error() {} });
  }
  const actions = { ...controller("adminTripController", ["adminChuyenVeChoDuyet", "adminCapNhatThoiGianChuyen", "adminDieuChinhThongTinChuyen"]),
    ...controller("tripController", ["adminChangeTripStatus", "adminVerifyTrip", "adminResendPendingTrip"]) };
  async function run(name, body = {}) {
    const req = { params: { id: trip.id }, body, admin: { id: 1, role: "ADMIN", username: "test" }, app: { get: () => null } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await actions[name](req, res);
    return res;
  }
  return { trip, logs, writes, run, pickupTime, returnTime };
}

for (const [action, initial, body] of [
  ["adminChuyenVeChoDuyet", {}, {}],
  ["adminVerifyTrip", { isVerified: false }, {}],
  ["adminResendPendingTrip", {}, {}],
  ["adminChangeTripStatus", { status: "ACCEPTED" }, { toStatus: "CONTACTED" }],
  ["adminChangeTripStatus", { status: "CONTACTED" }, { toStatus: "IN_PROGRESS" }],
  ["adminChangeTripStatus", { status: "IN_PROGRESS" }, { toStatus: "COMPLETED" }],
]) test(`${action} ${body.toStatus || ""} preserves both schedule fields`, async () => {
  const f = fixture(initial);
  const res = await f.run(action, body);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(f.writes.length);
  for (const write of f.writes) {
    assert.equal("pickupTime" in write, false);
    assert.equal("returnTime" in write, false);
  }
  assert.equal(f.trip.pickupTime.toISOString(), f.pickupTime.toISOString());
  assert.equal(f.trip.returnTime.toISOString(), f.returnTime.toISOString());
});

test("assigned schedule writes Vietnam time and rejects a return before pickup", async () => {
  const f = fixture({ status: "CONTACTED" });
  let res = await f.run("adminCapNhatThoiGianChuyen", { pickupTime: "2026-09-23T18:30", returnTime: "2026-09-23T06:30" });
  assert.equal(res.statusCode, 400);
  assert.equal(f.writes.length, 0);
  res = await f.run("adminCapNhatThoiGianChuyen", { pickupTime: "2026-09-23T18:30", returnTime: "2026-09-24T06:30" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(f.trip.pickupTime.toISOString(), "2026-09-23T11:30:00.000Z");
  assert.equal(f.trip.returnTime.toISOString(), "2026-09-23T23:30:00.000Z");
});

test("manual adjustment retains schedule audit even with long addresses/notes", async () => {
  const f = fixture({ isVerified: false, pickupAddress: "x".repeat(400), note: "n".repeat(500) });
  const res = await f.run("adminDieuChinhThongTinChuyen", {
    pickupAddress: "a".repeat(400), dropoffAddress: "b".repeat(400), note: "c".repeat(500),
    stops: [{ address: "b".repeat(400) }], carType: "CAR_5", direction: "ROUND_TRIP",
    pickupTime: "2026-09-23T19:30+07:00", returnTime: "2026-09-24T08:30+07:00",
    distanceKm: 100, fareEstimate: 500000, totalPrice: 500000, estimatedDurationMinutes: 180,
    outboundDriveMinutes: 90, returnDriveMinutes: 90, totalDriveMinutes: 180, verifiedNote: "Confirmed",
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.match(f.logs[0].note, /2026-09-23T11:30:00.000Z -> 2026-09-23T12:30:00.000Z/);
  assert.match(f.logs[0].note, /2026-09-24T00:30:00.000Z -> 2026-09-24T01:30:00.000Z/);
});

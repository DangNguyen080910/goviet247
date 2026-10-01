import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseTripTime } from "../src/utils/tripTime.js";

test("OTP confirmation saves both pickup and return as Vietnam wall-clock time", async () => {
  let created;
  const payload = {
    riderName: "Khách", riderPhone: "0900000000", pickupAddress: "A", dropoffAddress: "B",
    pickupTime: "2026-09-23T18:30:00+07:00", returnTime: "2026-09-24T06:30:00+07:00",
    carType: "CAR_5", fuelPreference: "ANY", direction: "ROUND_TRIP", distanceKm: 100,
    note: "", basePricePerKm: 1, holidayFactor: 1, directionFactor: 1, totalPrice: 500000,
  };
  const prisma = { trip: { create: async ({ data }) => { created = data; return { id: "trip", createdAt: new Date(), ...data }; } } };
  const source = readFileSync(new URL("../src/controllers/tripPublicController.js", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\n/gm, "").replaceAll("export async function", "async function");
  const confirmTrip = new Function("Date", "prisma", "verifyTripOtp", "validateTripDistance", "parseTripTime", "sendAdminPushNotification", "console",
    `${source}; return confirmTrip;`)(class extends Date { static [Symbol.hasInstance](value) { return value instanceof Date; } constructor(...args) { super(...(args.length ? args : ["2026-09-22T00:00:00Z"])); } static now() { return new Date("2026-09-22T00:00:00Z").getTime(); } }, prisma, async () => ({ valid: true, payload }), async () => ({ ok: true }), parseTripTime, async () => {}, { log() {}, error() {} });
  const req = { body: { sessionId: "otp", otpCode: "123456" }, app: { get: () => null } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await confirmTrip(req, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(created.pickupTime.toISOString(), "2026-09-23T11:30:00.000Z");
  assert.equal(created.returnTime.toISOString(), "2026-09-23T23:30:00.000Z");
});

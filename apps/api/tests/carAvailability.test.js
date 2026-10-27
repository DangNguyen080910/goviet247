import { destinationConfig } from "../src/services/destinationService.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertCarTypeBookable, createBookableTrip } from "../src/services/carAvailability.js";
import { parseTripTime } from "../src/utils/tripTime.js";
import { quotePrice } from "../src/services/pricingService.js";
import { validateHolidayConfig, validateHolidayPeriods } from "../src/services/holidaySurcharge.js";

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function controller(file, name, dependencies) {
  const source = readFileSync(new URL(`../src/controllers/${file}`, import.meta.url), "utf8").replace(/^import[\s\S]*?;\n/gm, "").replaceAll("export async function", "async function");
  return new Function(...Object.keys(dependencies), `${source}; return ${name};`)(...Object.values(dependencies));
}
const quiet = { log() {}, error() {} };

test("disabled or missing car cannot be booked; enabled car can", async () => {
  for (const value of [null, { isActive: false }]) await assert.rejects(assertCarTypeBookable({ pricingConfig: { findUnique: async () => value } }, "CAR_16"), { status: 409 });
  await assertCarTypeBookable({ pricingConfig: { findUnique: async () => ({ isActive: true }) } }, "CAR_16");
  await assert.rejects(assertCarTypeBookable({}, "BAD"), { status: 400 });
});

test("old quote cannot create a trip after the type is disabled; lock and check occur before creation", async () => {
  let created = 0;
  const order = [];
  let enabled = false;
  const db = { $queryRawUnsafe: async (sql, type) => { assert.match(sql, /FOR SHARE/); assert.equal(type, "CAR_16"); order.push("lock"); }, pricingConfig: { findUnique: async () => { order.push("check"); return { isActive: enabled }; } }, trip: { create: async ({ data }) => { created++; order.push("create"); return data; } } };
  db.$transaction = async fn => fn(db);
  await assert.rejects(createBookableTrip(db, { carType: "CAR_16" }), { status: 409 });
  assert.equal(created, 0);
  enabled = true;
  await createBookableTrip(db, { carType: "CAR_16" });
  assert.equal(created, 1);
  assert.deepEqual(order, ["lock", "check", "lock", "check", "create"]);
});

test("public config respects empty and partial active-car lists", async () => {
  for (const types of [[], ["CAR_5", "CAR_7"]]) {
    const db = { tripConfig: { findFirst: async () => ({}) }, systemConfig: { findFirst: async () => ({}) }, pricingConfig: { findMany: async ({ where }) => { assert.equal(where.isActive, true); return types.map(carType => ({ carType })); } } };
    const handler = controller("tripPublicController.js", "getPublicTripConfig", { prisma: db, console: quiet, destinationConfig });
    const res = response(); await handler({}, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.carTypes.map(item => item.value), types);
  }
});

test("pricing refuses disabled types with a clear unavailable message", async () => {
  const result = await quotePrice({ carType: "CAR_16" }, { pricingConfig: { findFirst: async ({ where }) => { assert.equal(where.isActive, true); return null; } } });
  assert.equal(result.ok, false); assert.equal(result.status, 409); assert.match(result.message, /tạm ngừng nhận đặt/);
});

test("admin toggle changes only availability and rejects non-boolean input", async () => {
  let changed;
  const row = { carType: "CAR_16", baseFare: 50000, holidaySurchargePercent: 0, holidayPeriods: [] };
  const db = { pricingConfig: { findUnique: async () => row, update: async ({ data }) => { changed = data; return { ...row, ...data }; } } };
  const handler = controller("pricingController.js", "updatePricingConfig", { pkg: { PrismaClient: class { constructor() { return db; } } }, validateHolidayConfig, validateHolidayPeriods, console: quiet });
  const res = response(); await handler({ params: { carType: "CAR_16" }, body: { isActive: false } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body)); assert.deepEqual(changed, { isActive: false }); assert.equal(res.body.item.baseFare, 50000);
  const invalid = response(); await handler({ params: { carType: "CAR_16" }, body: { isActive: "false" } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("OTP confirmation refuses a vehicle disabled after the OTP was issued", async () => {
  let created = false;
  const db = { $queryRawUnsafe: async () => [], pricingConfig: { findUnique: async () => ({ isActive: false }) }, trip: { create: async () => { created = true; } } };
  db.$transaction = async fn => fn(db);
  const payload = { pickupTime: "2099-01-01T08:00:00+07:00", carType: "CAR_16", distanceKm: 100 };
  const handler = controller("tripPublicController.js", "confirmTrip", { prisma: db, createBookableTrip, parseTripTime, verifyTripOtp: async () => ({ valid: true, payload }), validateTripDistance: async () => ({ ok: true }), console: quiet });
  const res = response(); await handler({ body: { sessionId: "old", otpCode: "123456" } }, res);
  assert.equal(res.statusCode, 400); assert.match(res.body.message, /tạm ngừng nhận đặt/); assert.equal(created, false);
});

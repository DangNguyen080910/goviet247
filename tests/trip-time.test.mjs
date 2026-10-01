import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { parseTripTime } from "../apps/api/src/utils/tripTime.js";
import { toDateTimeLocalValue, fromDateTimeLocalValue, scheduleLocalToIso } from "../apps/web/src/utils/tripTime.js";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function loadTs(path) {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, Date });
  return exports;
}
const admin = loadTs("../apps/admin-mobile/utils/tripTime.ts");
const rider = loadTs("../apps/rider-mobile/utils/bookingTime.ts");

for (const zone of ["UTC", "Asia/Ho_Chi_Minh", "America/Los_Angeles", "Asia/Tokyo"]) {
  test(`Vietnam trip schedules are independent of device/server TZ=${zone}`, () => {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
      for (const [wall, utc, display] of [
        ["2026-09-23T18:30", "2026-09-23T11:30:00.000Z", "23/09/2026 18:30"],
        ["2026-09-23T06:30", "2026-09-22T23:30:00.000Z", "23/09/2026 06:30"],
        ["2027-01-01T00:00", "2026-12-31T17:00:00.000Z", "01/01/2027 00:00"],
        ["2026-03-08T02:30", "2026-03-07T19:30:00.000Z", "08/03/2026 02:30"],
      ]) {
        assert.equal(parseTripTime(wall).toISOString(), utc);
        assert.equal(parseTripTime(`${wall}:00+07:00`).toISOString(), utc);
        assert.equal(parseTripTime(utc).toISOString(), utc);
        assert.equal(fromDateTimeLocalValue(wall), utc);
        assert.equal(toDateTimeLocalValue(utc), wall);
        assert.equal(admin.formatScheduleInput(utc), display);
        assert.equal(admin.parseScheduleInput(display), utc);
        assert.equal(rider.bookingTimeToIso(wall), utc);
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
}

test("editing price/address preserves original seconds and milliseconds", () => {
  const original = "2026-09-23T11:30:45.123Z";
  assert.equal(admin.scheduleInputToIso(admin.formatScheduleInput(original), original), original);
  assert.equal(scheduleLocalToIso(toDateTimeLocalValue(original), original), original);
  assert.equal(admin.scheduleInputToIso("23/09/2026 19:30", original), "2026-09-23T12:30:00.000Z");
});

test("invalid dates cannot silently roll into a different pickup day", () => {
  for (const input of ["2026-02-30T18:30", "2026-09-23T24:00", "2026-09-23T18:60", "junk"]) {
    assert.ok(Number.isNaN(parseTripTime(input).getTime()));
    assert.equal(fromDateTimeLocalValue(input), "");
    assert.equal(rider.bookingTimeToIso(input), "");
  }
  assert.equal(admin.parseScheduleInput("30/02/2026 18:30"), null);
  assert.equal(admin.parseScheduleInput("23/09/2026 06:30 PM"), null);
});

test("AM/PM handles 6:30, noon and midnight without changing the date", () => {
  const day = "2026-09-23T06:30";
  assert.equal(rider.setBookingClock(day, 6, 30, "PM"), "2026-09-23T18:30");
  assert.equal(rider.setBookingClock(day, 6, 30, "AM"), day);
  assert.equal(rider.setBookingClock(day, 12, 0, "AM"), "2026-09-23T00:00");
  assert.equal(rider.setBookingClock(day, 12, 0, "PM"), "2026-09-23T12:00");
  assert.match(rider.formatBookingTime("2026-09-23T18:30"), /tối.*18:30/);
  assert.match(rider.formatBookingTime("2026-09-23T00:00"), /đêm/);
  assert.match(rider.formatBookingTime("2026-09-23T12:00"), /trưa/);
});

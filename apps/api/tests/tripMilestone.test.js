import { test } from "node:test";
import assert from "node:assert/strict";
import { upcomingTripMilestone, recordTripMilestone } from "../src/services/tripMilestoneService.js";
test("warn one completion before every hundred, not on the hundred", () => {
  for (const [count, target] of [[0,null],[93,null],[98,null],[99,100],[100,null],[199,200],[299,300],[999,1000],[999999,1000000]]) {
    assert.equal(upcomingTripMilestone(count), target);
  }
});
test("records a milestone linked to the triggering completed trip", async () => {
  let recorded;
  const tx = { trip: { count: async () => 99 }, adminAlertLog: {
    findFirst: async () => null, create: async value => { recorded=value.data; return value.data; },
  } };
  await recordTripMilestone(tx, "trip99");
  assert.equal(recorded.level,100); assert.equal(recorded.tripId,"trip99");
  assert.match(recorded.message,/99 chuyến/);
});
test("does not repeat a previously recorded milestone or emit for normal trips", async () => {
  const tx = { trip: { count: async () => 199 }, adminAlertLog: {
    findFirst: async () => ({ id:"existing" }), create: async () => assert.fail("duplicate"),
  } };
  assert.equal(await recordTripMilestone(tx,"trip199"),null);
  tx.trip.count = async () => 200;
  assert.equal(await recordTripMilestone(tx,"trip200"),null);
});

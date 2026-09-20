import test from "node:test";
import assert from "node:assert/strict";
import { getQuarterDateRange } from "../src/services/accountingQuarter.js";

test("Q3 export uses Vietnam boundaries independent of server timezone", () => {
  const range = getQuarterDateRange(2026, 3);
  assert.equal(range.start.toISOString(), "2026-06-30T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-30T16:59:59.999Z");
  assert.equal(new Date(range.end.getTime() + 1).toISOString(), "2026-09-30T17:00:00.000Z");
});

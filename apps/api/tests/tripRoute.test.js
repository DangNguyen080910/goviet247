import test from "node:test";
import assert from "node:assert/strict";
import { dropoffIsRepresented, tripRoutePoints, tripDirection } from "../src/shared/tripRoute.js";

test("driver route retains two distinct destinations masked to the same locality", () => {
  const trip = {
    pickupAddress: "Khánh Hội",
    stops: [{ address: "12 Đường A, Phú Giáo" }],
    dropoffAddress: "13 Đường B, Phú Giáo",
    direction: "ROUND_TRIP",
  };
  const points = tripRoutePoints({
    ...trip,
    stops: [{ address: "Phú Giáo" }],
    dropoffAddress: "Phú Giáo",
    dropoffAlreadyInRoute: dropoffIsRepresented(trip),
  }, { masked: true });
  assert.deepEqual(points.map(point => point.label), [
    "Điểm đón", "Điểm đến 1", "Điểm đến 2", "Quay về điểm đón",
  ]);
});

test("two stored stops are kept and the legacy final dropoff mirror appears once", () => {
  const points = tripRoutePoints({
    pickupAddress: "Khánh Hội",
    stops: [{ address: "Phú Giáo" }, { address: "Phú Giáo" }],
    dropoffAddress: "Phú Giáo",
    direction: "ROUND_TRIP",
  });
  assert.deepEqual(points.map(point => point.address), [
    "Khánh Hội", "Phú Giáo", "Phú Giáo", "Khánh Hội",
  ]);
});

test("round trip preserves a second visit to the first destination and then returns to pickup", () => {
  const points = tripRoutePoints({ pickupAddress: "Hồ Văn Huê", direction: "ROUND_TRIP",
    stops: [{ address: "Bạch Mai", seq: 1 }, { address: "Cam Bình", seq: 2 }, { address: "Bạch Mai", seq: 3 }],
    dropoffAddress: "Bạch Mai" });
  assert.deepEqual(points, [
    { label: "Điểm đón", address: "Hồ Văn Huê" },
    { label: "Điểm đến 1", address: "Bạch Mai" },
    { label: "Điểm đến 2", address: "Cam Bình" },
    { label: "Điểm đến 3", address: "Bạch Mai" },
    { label: "Quay về điểm đón", address: "Hồ Văn Huê" },
  ]);
});

test("only the final legacy mirror is omitted; an earlier matching destination is retained", () => {
  for (const direction of ["ONE_WAY", "ROUND_TRIP"]) {
    const points = tripRoutePoints({ pickupAddress: "A", direction,
      stops: [{ address: "B" }, { address: "C" }], dropoffAddress: "B" });
    assert.deepEqual(points.map(p => p.address), direction === "ROUND_TRIP" ? ["A", "B", "C", "B", "A"] : ["A", "B", "C", "B"]);
  }
});

test("stop sequence is respected without mutating stored stop arrays", () => {
  const trip = { pickupAddress: "A", direction: "ROUND_TRIP", dropoffAddress: "B",
    stops: [{ address: "B", seq: 3 }, { address: "B", seq: 1 }, { address: "C", seq: 2 }] };
  const before = JSON.stringify(trip);
  assert.deepEqual(tripRoutePoints(trip).map(p => p.address), ["A", "B", "C", "B", "A"]);
  assert.equal(JSON.stringify(trip), before);
  assert.deepEqual(tripRoutePoints({ pickupAddress: "A", stops: [{ address: "C", order: 2 }, { address: "B", order: 1 }], dropoffAddress: "C" }).map(p => p.address), ["A", "B", "C"]);
});

test("legacy Admin type/returnTime fallbacks cannot override an explicit one-way trip", () => {
  assert.equal(tripDirection({ tripType: "ROUND_TRIP" }), "ROUND_TRIP");
  assert.equal(tripDirection({ returnTime: "2026-11-21T12:00:00Z" }), "ROUND_TRIP");
  assert.equal(tripDirection({ direction: "ONE_WAY", returnTime: "2026-11-21T12:00:00Z" }), "ONE_WAY");
  for (const type of [{ direction: "ROUND_TRIP" }, { tripType: "ROUND_TRIP" }, { returnTime: "2026-11-21T12:00:00Z" }]) {
    assert.deepEqual(tripRoutePoints({ pickupAddress: "A", dropoffAddress: "B", ...type }).map(p => p.address), ["A", "B", "A"]);
  }
  assert.deepEqual(tripRoutePoints({ pickupAddress: "A", stops: [null, { address: "" }] }).map(p => p.address), ["A"]);
});

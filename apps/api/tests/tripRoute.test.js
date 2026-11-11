import test from "node:test";
import assert from "node:assert/strict";
import { dropoffIsRepresented, tripRoutePoints } from "../src/shared/tripRoute.js";

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

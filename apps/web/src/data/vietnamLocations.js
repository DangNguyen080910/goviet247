// apps/web/src/data/vietnamLocations.js

import { PROVINCES } from "./provinces";
import { SOUTH_LOCATIONS } from "./southLocations";
import { CENTRAL_LOCATIONS } from "./centralLocations";
import { MEKONG_LOCATIONS } from "./mekongLocations";
import { AIRPORT_LOCATIONS } from "./airportLocations";

const uniqueLocations = [
  ...PROVINCES,
  ...SOUTH_LOCATIONS,
  ...CENTRAL_LOCATIONS,
  ...MEKONG_LOCATIONS,
  ...AIRPORT_LOCATIONS,
].filter(
  (item, index, arr) =>
    arr.findIndex((x) => x.fullAddress === item.fullAddress) === index
);

export const VIETNAM_LOCATIONS = uniqueLocations;

export function isVietnamLocationOption(option) {
  return Boolean(option?.fullAddress && option?.shortAddress);
}

export function searchVietnamLocations(query = "") {
  const q = String(query).trim().toLowerCase();

  if (!q) return [];

  return VIETNAM_LOCATIONS.filter((item) => {
    const searchableText = [
      item.name,
      item.fullAddress,
      item.shortAddress,
      item.maskedAddress,
      ...(item.keywords || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(q);
  }).slice(0, 20);
}

export default VIETNAM_LOCATIONS;
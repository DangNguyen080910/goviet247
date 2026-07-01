import { GENERIC_SEO_ROUTES } from "./genericSeoRoutes.js";
import { SOUTH_SEO_ROUTES } from "./southSeoRoutes.js";
import { MEKONG_SEO_ROUTES } from "./mekongSeoRoutes.js";
import { CENTRAL_SEO_ROUTES } from "./centralSeoRoutes.js";
import { AIRPORT_SEO_ROUTES } from "./airportSeoRoutes.js";
import { INDUSTRIAL_SEO_ROUTES } from "./industrialSeoRoutes.js";
import { TOURIST_SEO_ROUTES } from "./touristSeoRoutes.js";
import { HOSPITAL_SEO_ROUTES } from "./hospitalSeoRoutes.js";
import { UNIVERSITY_SEO_ROUTES } from "./universitySeoRoutes.js";
import { AIRPORT_TRANSFER_SEO_ROUTES } from "./airportTransferSeoRoutes.js";
import { BUS_STATION_SEO_ROUTES } from "./busStationSeoRoutes.js";
import { RESORT_SEO_ROUTES } from "./resortSeoRoutes.js";
import { INDUSTRIAL_EXPANSION_SEO_ROUTES } from "./industrialExpansionSeoRoutes.js";
import { LANDMARK_SEO_ROUTES } from "./landmarkSeoRoutes.js";
import { PROVINCE_DISTRICT_SEO_ROUTES } from "./provinceDistrictSeoRoutes.js";
import { HOTEL_SEO_ROUTES } from "./hotelSeoRoutes.js";
import { PORT_SEO_ROUTES } from "./portSeoRoutes.js";
import { RIDE_SHARE_SEO_ROUTES } from "./rideShareSeoRoutes.js";
import { BUSINESS_SEO_ROUTES } from "./businessSeoRoutes.js";
import { VEHICLE_SEO_ROUTES } from "./vehicleSeoRoutes.js";
import { VUNGTAU_SEO_ROUTES } from "./vungTauSeoRoutes.js";
import { HOTRAM_SEO_ROUTES } from "./hoTramSeoRoutes.js";
import { PHANTHIET_SEO_ROUTES } from "./phanThietSeoRoutes.js";

const uniqueByPath = (items) => {
  const seen = new Set();

  return items.filter((item) => {
    if (!item?.path) return false;
    if (seen.has(item.path)) return false;

    seen.add(item.path);
    return true;
  });
};

export const SEO_ROUTES = uniqueByPath([
  ...GENERIC_SEO_ROUTES,
  ...SOUTH_SEO_ROUTES,
  ...MEKONG_SEO_ROUTES,
  ...CENTRAL_SEO_ROUTES,
  ...AIRPORT_SEO_ROUTES,
  ...INDUSTRIAL_SEO_ROUTES,
  ...TOURIST_SEO_ROUTES,
  ...HOSPITAL_SEO_ROUTES,
  ...UNIVERSITY_SEO_ROUTES,
  ...AIRPORT_TRANSFER_SEO_ROUTES,
  ...BUS_STATION_SEO_ROUTES,
  ...RESORT_SEO_ROUTES,
  ...INDUSTRIAL_EXPANSION_SEO_ROUTES,
  ...LANDMARK_SEO_ROUTES,
  ...PROVINCE_DISTRICT_SEO_ROUTES,
  ...HOTEL_SEO_ROUTES,
  ...PORT_SEO_ROUTES,
  ...RIDE_SHARE_SEO_ROUTES,
  ...BUSINESS_SEO_ROUTES,
  ...VEHICLE_SEO_ROUTES,
  ...VUNGTAU_SEO_ROUTES,
  ...HOTRAM_SEO_ROUTES,
  ...PHANTHIET_SEO_ROUTES,
]);
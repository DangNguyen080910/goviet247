import { GENERIC_SEO_ROUTES } from "./genericSeoRoutes";
import { SOUTH_SEO_ROUTES } from "./southSeoRoutes";
import { MEKONG_SEO_ROUTES } from "./mekongSeoRoutes";
import { CENTRAL_SEO_ROUTES } from "./centralSeoRoutes";
import { AIRPORT_SEO_ROUTES } from "./airportSeoRoutes";
import { INDUSTRIAL_SEO_ROUTES } from "./industrialSeoRoutes";
import { TOURIST_SEO_ROUTES } from "./touristSeoRoutes";
import { HOSPITAL_SEO_ROUTES } from "./hospitalSeoRoutes";
import { UNIVERSITY_SEO_ROUTES } from "./universitySeoRoutes";

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
]);
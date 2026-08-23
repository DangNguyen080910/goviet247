// apps/web/src/data/seoRoutes/index.js
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
import { BINHPHUOC_SEO_ROUTES } from "./binhPhuocSeoRoutes.js";
import { BENTRE_SEO_ROUTES } from "./benTreSeoRoutes.js";
import { CANTHO_SEO_ROUTES } from "./canThoSeoRoutes.js";
import { NHATRANG_SEO_ROUTES } from "./nhaTrangSeoRoutes.js";
import { DALAT_SEO_ROUTES } from "./daLatSeoRoutes.js";
import { TAYNINH_SEO_ROUTES } from "./tayNinhSeoRoutes.js";
import { LONGHAI_SEO_ROUTES } from "./longHaiSeoRoutes.js";
import { MUINE_SEO_ROUTES } from "./muiNeSeoRoutes.js";
import { BINHCHAU_SEO_ROUTES } from "./binhChauSeoRoutes.js";
import { LONGAN_SEO_ROUTES } from "./longAnSeoRoutes.js";
import { TIENGIANG_SEO_ROUTES } from "./tienGiangSeoRoutes.js";
import { VINH_LONG_SEO_ROUTES } from "./vinhLongSeoRoutes.js";
import { DONGTHAP_SEO_ROUTES } from "./dongThapSeoRoutes.js";
import { ANGIANG_SEO_ROUTES } from "./anGiangSeoRoutes.js";
import { KIENGIANG_SEO_ROUTES } from "./kienGiangSeoRoutes.js";
import { CAMAU_SEO_ROUTES } from "./caMauSeoRoutes.js";
import { BACLIEU_SEO_ROUTES } from "./bacLieuSeoRoutes.js";
import { HAUGIANG_SEO_ROUTES } from "./hauGiangSeoRoutes.js";
import { SOCTRANG_SEO_ROUTES } from "./socTrangSeoRoutes.js";
import { TRAVINH_SEO_ROUTES } from "./traVinhSeoRoutes.js";
import { DONGNAI_SEO_ROUTES } from "./dongNaiSeoRoutes.js";
import { BINHDUONG_SEO_ROUTES } from "./binhDuongSeoRoutes.js";
import { NINHTHUAN_SEO_ROUTES } from "./ninhThuanSeoRoutes.js";
import { BINHTHUAN_SEO_ROUTES } from "./binhThuanSeoRoutes.js";
import { V2HCM_SEO_ROUTES } from "./V2HCMSeoRoutes.js";
import { V2DONGNAI_SEO_ROUTES } from "./V2DongNaiSeoRoutes.js";
import { V2LAMDONG_SEO_ROUTES } from "./V2LamDongSeoRoutes.js";
import { V2KHANHHOA_SEO_ROUTES } from "./V2KhanhHoaSeoRoutes.js";
import { V2TAYNINH_SEO_ROUTES } from "./V2TayNinhSeoRoutes.js";
import { V2CANTHO_SEO_ROUTES } from "./V2CanThoSeoRoutes.js";
import { V2DONGTHAP_SEO_ROUTES } from "./V2DongThapSeoRoutes.js";
import { V2ANGIANG_SEO_ROUTES } from "./V2AnGiangSeoRoutes.js";
import { V2VINHLONG_SEO_ROUTES } from "./V2VinhLongSeoRoutes.js";
import { V2CAMAU_SEO_ROUTES } from "./V2CaMauSeoRoutes.js"; 
import { V2DAKLAK_SEO_ROUTES } from "./V2DakLakSeoRoutes.js";

const assertUniqueSeoRoutes = (items) => {
  const pathMap = new Map();
  const keyMap = new Map();
  const errors = [];

  for (const item of items) {
    if (!item?.path) {
      errors.push(`❌ SEO route thiếu path:\n${JSON.stringify(item, null, 2)}`);
      continue;
    }

    if (!item?.key) {
      errors.push(`❌ SEO route thiếu key, path="${item.path}"`);
      continue;
    }

    if (pathMap.has(item.path)) {
      const first = pathMap.get(item.path);

      errors.push(
        `❌ Duplicate SEO path: "${item.path}"\n` +
          `First: key=${first.key}, title=${first.title}\n` +
          `Second: key=${item.key}, title=${item.title}`
      );
    }

    if (keyMap.has(item.key)) {
      const first = keyMap.get(item.key);

      errors.push(
        `❌ Duplicate SEO key: "${item.key}"\n` +
          `First: path=${first.path}, title=${first.title}\n` +
          `Second: path=${item.path}, title=${item.title}`
      );
    }

    pathMap.set(item.path, item);
    keyMap.set(item.key, item);
  }

  if (errors.length) {
    throw new Error(`\n\n${errors.join("\n\n")}\n`);
  }

  return items;
};

export const SEO_ROUTES = assertUniqueSeoRoutes([
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
  ...BINHPHUOC_SEO_ROUTES,
  ...BENTRE_SEO_ROUTES,
  ...CANTHO_SEO_ROUTES,
  ...NHATRANG_SEO_ROUTES,
  ...DALAT_SEO_ROUTES,
  ...TAYNINH_SEO_ROUTES,
  ...LONGHAI_SEO_ROUTES,
  ...MUINE_SEO_ROUTES,
  ...BINHCHAU_SEO_ROUTES,
  ...LONGAN_SEO_ROUTES,
  ...TIENGIANG_SEO_ROUTES,
  ...VINH_LONG_SEO_ROUTES,
  ...DONGTHAP_SEO_ROUTES,
  ...ANGIANG_SEO_ROUTES,
  ...KIENGIANG_SEO_ROUTES,
  ...CAMAU_SEO_ROUTES,
  ...BACLIEU_SEO_ROUTES,
  ...HAUGIANG_SEO_ROUTES,
  ...SOCTRANG_SEO_ROUTES,
  ...TRAVINH_SEO_ROUTES,
  ...DONGNAI_SEO_ROUTES,
  ...BINHDUONG_SEO_ROUTES,
  ...NINHTHUAN_SEO_ROUTES,
  ...BINHTHUAN_SEO_ROUTES,
  ...V2HCM_SEO_ROUTES,
  ...V2DONGNAI_SEO_ROUTES,
  ...V2LAMDONG_SEO_ROUTES,
  ...V2KHANHHOA_SEO_ROUTES,
  ...V2TAYNINH_SEO_ROUTES,
  ...V2CANTHO_SEO_ROUTES,
  ...V2DONGTHAP_SEO_ROUTES,
  ...V2ANGIANG_SEO_ROUTES,
  ...V2VINHLONG_SEO_ROUTES,
  ...V2CAMAU_SEO_ROUTES,
  ...V2DAKLAK_SEO_ROUTES,
]);

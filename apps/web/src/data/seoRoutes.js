// Path: goviet247/apps/web/src/data/seoRoutes.js
export const SEO_ROUTES = [
  // ==== ĐI TỪ TP.HCM ====
  {
    key: "vung-tau",
    path: "xe-di-vung-tau",
    from: "TP.HCM",
    to: "Vũng Tàu",
    title: "Thuê xe đi Vũng Tàu giá tốt, xe riêng đưa đón tận nơi",
    description:
      "Dịch vụ xe riêng đi Vũng Tàu từ TP.HCM. Giá rõ ràng, tính trước khi đặt, không ghép khách.",
    routeText: "TP.HCM → Long Thành → Bà Rịa → Vũng Tàu",
    duration: "2 – 2.5 giờ",
  },

  {
    key: "da-lat",
    path: "xe-di-da-lat",
    from: "TP.HCM",
    to: "Đà Lạt",
    title: "Thuê xe đi Đà Lạt giá tốt, xe riêng đường dài",
    description:
      "Đặt xe riêng đi Đà Lạt từ TP.HCM. Phù hợp du lịch, gia đình, công tác.",
    routeText: "TP.HCM → Dầu Giây → Bảo Lộc → Đà Lạt",
    duration: "6 – 8 giờ",
  },

  {
    key: "can-tho",
    path: "xe-di-can-tho",
    from: "TP.HCM",
    to: "Cần Thơ",
    title: "Thuê xe đi Cần Thơ giá tốt, xe riêng miền Tây",
    description:
      "Dịch vụ xe riêng đi Cần Thơ từ TP.HCM, đặt nhanh, giá rõ ràng.",
    routeText: "TP.HCM → Trung Lương → Mỹ Thuận → Cần Thơ",
    duration: "3 – 4 giờ",
  },

  // ==== CHIỀU NGƯỢC (SEO RẤT NGON) ====
  {
    key: "vung-tau-hcm",
    path: "xe-vung-tau-di-tp-hcm",
    from: "Vũng Tàu",
    to: "TP.HCM",
    title: "Xe Vũng Tàu đi TP.HCM giá tốt, xe riêng đưa đón tận nơi",
    description:
      "Đặt xe riêng từ Vũng Tàu về TP.HCM, không ghép khách, tài xế chuyên tuyến.",
    routeText: "Vũng Tàu → Bà Rịa → Long Thành → TP.HCM",
    duration: "2 – 2.5 giờ",
  },

  {
    key: "da-lat-hcm",
    path: "xe-da-lat-di-tp-hcm",
    from: "Đà Lạt",
    to: "TP.HCM",
    title: "Xe Đà Lạt đi TP.HCM giá tốt, xe riêng đường dài",
    description:
      "Dịch vụ xe riêng từ Đà Lạt về TP.HCM, phù hợp gia đình, du lịch.",
    routeText: "Đà Lạt → Bảo Lộc → Dầu Giây → TP.HCM",
    duration: "6 – 8 giờ",
  },

  {
    key: "can-tho-hcm",
    path: "xe-can-tho-di-tp-hcm",
    from: "Cần Thơ",
    to: "TP.HCM",
    title: "Xe Cần Thơ đi TP.HCM giá tốt, xe riêng miền Tây",
    description:
      "Đặt xe riêng từ Cần Thơ về TP.HCM, đón tận nơi, giá rõ ràng.",
    routeText: "Cần Thơ → Mỹ Thuận → Trung Lương → TP.HCM",
    duration: "3 – 4 giờ",
  },

  // ==== GENERIC SEO ====
  {
    key: "di-tinh",
    path: "thue-xe-di-tinh",
    from: "TP.HCM",
    to: "các tỉnh",
    title: "Thuê xe đi tỉnh giá tốt, xe riêng 5 chỗ, 7 chỗ, 16 chỗ",
    description:
      "GoViet247 hỗ trợ đặt xe đi tỉnh, đi tỉnh về TP.HCM và liên tỉnh.",
    routeText: "TP.HCM ↔ các tỉnh",
    duration: "tùy tuyến",
  },
];
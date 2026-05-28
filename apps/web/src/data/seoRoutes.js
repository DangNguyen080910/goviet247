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
    description: "Đặt xe riêng từ Cần Thơ về TP.HCM, đón tận nơi, giá rõ ràng.",
    routeText: "Cần Thơ → Mỹ Thuận → Trung Lương → TP.HCM",
    duration: "3 – 4 giờ",
  },

  {
    key: "nha-trang",
    path: "xe-di-nha-trang",
    from: "TP.HCM",
    to: "Nha Trang",
    title: "Thuê xe đi Nha Trang giá tốt, xe riêng đưa đón tận nơi",
    description:
      "Dịch vụ xe riêng đi Nha Trang từ TP.HCM. Phù hợp du lịch biển, gia đình, công tác, hỗ trợ xe 5 chỗ, 7 chỗ và 16 chỗ.",
    routeText: "TP.HCM → Dầu Giây → Phan Thiết → Cam Ranh → Nha Trang",
    duration: "7 – 9 giờ",
  },

  {
    key: "nha-trang-hcm",
    path: "xe-nha-trang-di-tp-hcm",
    from: "Nha Trang",
    to: "TP.HCM",
    title: "Xe Nha Trang đi TP.HCM giá tốt, xe riêng đường dài",
    description:
      "Đặt xe riêng từ Nha Trang về TP.HCM, đón tận nơi, không ghép khách, phù hợp gia đình và nhóm du lịch.",
    routeText: "Nha Trang → Cam Ranh → Phan Thiết → Dầu Giây → TP.HCM",
    duration: "7 – 9 giờ",
  },

  {
    key: "phan-thiet",
    path: "xe-di-phan-thiet",
    from: "TP.HCM",
    to: "Phan Thiết",
    title: "Thuê xe đi Phan Thiết giá tốt, xe riêng đi Mũi Né",
    description:
      "Dịch vụ xe riêng đi Phan Thiết, Mũi Né từ TP.HCM. Giá rõ ràng, đưa đón tận nơi, hỗ trợ xe 5 chỗ, 7 chỗ, 16 chỗ.",
    routeText: "TP.HCM → Dầu Giây → Hàm Thuận Nam → Phan Thiết",
    duration: "3 – 4.5 giờ",
  },

  {
    key: "phan-thiet-hcm",
    path: "xe-phan-thiet-di-tp-hcm",
    from: "Phan Thiết",
    to: "TP.HCM",
    title: "Xe Phan Thiết đi TP.HCM giá tốt, xe riêng đưa đón tận nơi",
    description:
      "Đặt xe riêng từ Phan Thiết, Mũi Né về TP.HCM. Không ghép khách, tài xế hỗ trợ tuyến đường dài.",
    routeText: "Phan Thiết → Hàm Thuận Nam → Dầu Giây → TP.HCM",
    duration: "3 – 4.5 giờ",
  },

  {
    key: "ben-tre",
    path: "xe-di-ben-tre",
    from: "TP.HCM",
    to: "Bến Tre",
    title: "Thuê xe đi Bến Tre giá tốt, xe riêng miền Tây",
    description:
      "Dịch vụ xe riêng đi Bến Tre từ TP.HCM, phù hợp về quê, công tác, du lịch gia đình và đi tỉnh miền Tây.",
    routeText: "TP.HCM → Trung Lương → Mỹ Tho → Bến Tre",
    duration: "2 – 3 giờ",
  },

  {
    key: "ben-tre-hcm",
    path: "xe-ben-tre-di-tp-hcm",
    from: "Bến Tre",
    to: "TP.HCM",
    title: "Xe Bến Tre đi TP.HCM giá tốt, xe riêng đón tận nơi",
    description:
      "Đặt xe riêng từ Bến Tre về TP.HCM, hỗ trợ đón tận nơi, không ghép khách, giá tính trước khi đặt.",
    routeText: "Bến Tre → Mỹ Tho → Trung Lương → TP.HCM",
    duration: "2 – 3 giờ",
  },

  {
    key: "binh-phuoc",
    path: "xe-di-binh-phuoc",
    from: "TP.HCM",
    to: "Bình Phước",
    title: "Thuê xe đi Bình Phước giá tốt, xe riêng đưa đón tận nơi",
    description:
      "Dịch vụ xe riêng đi Bình Phước từ TP.HCM. Phù hợp công tác, về quê, gia đình và các chuyến đi tỉnh.",
    routeText: "TP.HCM → Bình Dương → Đồng Xoài → Bình Phước",
    duration: "3 – 4.5 giờ",
  },

  {
    key: "binh-phuoc-hcm",
    path: "xe-binh-phuoc-di-tp-hcm",
    from: "Bình Phước",
    to: "TP.HCM",
    title: "Xe Bình Phước đi TP.HCM giá tốt, xe riêng không ghép khách",
    description:
      "Đặt xe riêng từ Bình Phước về TP.HCM, hỗ trợ xe 5 chỗ, 7 chỗ, 16 chỗ, phù hợp công tác và gia đình.",
    routeText: "Bình Phước → Đồng Xoài → Bình Dương → TP.HCM",
    duration: "3 – 4.5 giờ",
  },

  {
    key: "bien-hoa",
    path: "xe-di-bien-hoa",
    from: "TP.HCM",
    to: "Biên Hoà",
    title: "Thuê xe đi Biên Hoà giá tốt, xe riêng từ TP.HCM",
    description:
      "Dịch vụ xe riêng đi Biên Hoà từ TP.HCM, phù hợp công việc, đưa đón gia đình, đi sân bay hoặc liên tỉnh.",
    routeText: "TP.HCM → Xa lộ Hà Nội → Biên Hoà",
    duration: "1 – 1.5 giờ",
  },

  {
    key: "bien-hoa-hcm",
    path: "xe-bien-hoa-di-tp-hcm",
    from: "Biên Hoà",
    to: "TP.HCM",
    title: "Xe Biên Hoà đi TP.HCM giá tốt, xe riêng đưa đón tận nơi",
    description:
      "Đặt xe riêng từ Biên Hoà về TP.HCM, không ghép khách, giá rõ ràng và hỗ trợ nhanh qua Zalo.",
    routeText: "Biên Hoà → Xa lộ Hà Nội → TP.HCM",
    duration: "1 – 1.5 giờ",
  },

  {
    key: "tay-ninh",
    path: "xe-di-tay-ninh",
    from: "TP.HCM",
    to: "Tây Ninh",
    title: "Thuê xe đi Tây Ninh giá tốt, xe riêng đưa đón tận nơi",
    description:
      "Dịch vụ xe riêng đi Tây Ninh từ TP.HCM, phù hợp đi Núi Bà Đen, công tác, gia đình và du lịch trong ngày.",
    routeText: "TP.HCM → Củ Chi → Trảng Bàng → Tây Ninh",
    duration: "2 – 3 giờ",
  },

  {
    key: "tay-ninh-hcm",
    path: "xe-tay-ninh-di-tp-hcm",
    from: "Tây Ninh",
    to: "TP.HCM",
    title: "Xe Tây Ninh đi TP.HCM giá tốt, xe riêng không ghép khách",
    description:
      "Đặt xe riêng từ Tây Ninh về TP.HCM, hỗ trợ đón tận nơi, giá tính trước và phù hợp nhiều nhu cầu di chuyển.",
    routeText: "Tây Ninh → Trảng Bàng → Củ Chi → TP.HCM",
    duration: "2 – 3 giờ",
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

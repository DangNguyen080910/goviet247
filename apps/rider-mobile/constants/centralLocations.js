// apps/rider-mobile/constants/centralLocations.js

const loc = ({
  provinceSlug,
  locationSlug,
  name,
  fullAddress,
  shortAddress,
  maskedAddress,
  lat,
  lng,
  keywords,
}) => ({
  placeId: `goviet247:central:${provinceSlug}:${locationSlug}`,
  name,
  fullAddress,
  shortAddress,
  maskedAddress,
  lat,
  lng,
  keywords,
});

export const CENTRAL_LOCATIONS = [
    // =========================
  // KHÁNH HÒA
  // =========================

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "nha-trang",
    name: "Nha Trang - Khánh Hòa",
    fullAddress: "Nha Trang, Khánh Hòa, Việt Nam",
    shortAddress: "Nha Trang",
    maskedAddress: "Khánh Hòa",
    lat: 12.2388,
    lng: 109.1967,
    keywords: ["nha trang", "khánh hòa", "khanh hoa", "xe đi nha trang"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "cam-ranh",
    name: "Cam Ranh - Khánh Hòa",
    fullAddress: "Cam Ranh, Khánh Hòa, Việt Nam",
    shortAddress: "Cam Ranh",
    maskedAddress: "Khánh Hòa",
    lat: 11.9214,
    lng: 109.1591,
    keywords: ["cam ranh", "khánh hòa", "xe đi cam ranh"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "ninh-hoa",
    name: "Ninh Hòa - Khánh Hòa",
    fullAddress: "Ninh Hòa, Khánh Hòa, Việt Nam",
    shortAddress: "Ninh Hòa",
    maskedAddress: "Khánh Hòa",
    lat: 12.4894,
    lng: 109.1258,
    keywords: ["ninh hoa", "ninh hòa", "khánh hòa", "xe đi ninh hòa"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "van-ninh",
    name: "Vạn Ninh - Khánh Hòa",
    fullAddress: "Vạn Ninh, Khánh Hòa, Việt Nam",
    shortAddress: "Vạn Ninh",
    maskedAddress: "Khánh Hòa",
    lat: 12.7247,
    lng: 109.2211,
    keywords: ["van ninh", "vạn ninh", "khánh hòa", "xe đi vạn ninh"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "dien-khanh",
    name: "Diên Khánh - Khánh Hòa",
    fullAddress: "Diên Khánh, Khánh Hòa, Việt Nam",
    shortAddress: "Diên Khánh",
    maskedAddress: "Khánh Hòa",
    lat: 12.2547,
    lng: 109.0939,
    keywords: ["dien khanh", "diên khánh", "khánh hòa", "xe đi diên khánh"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "khanh-vinh",
    name: "Khánh Vĩnh - Khánh Hòa",
    fullAddress: "Khánh Vĩnh, Khánh Hòa, Việt Nam",
    shortAddress: "Khánh Vĩnh",
    maskedAddress: "Khánh Hòa",
    lat: 12.3050,
    lng: 108.8300,
    keywords: ["khanh vinh", "khánh vĩnh", "khánh hòa", "xe đi khánh vĩnh"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "khanh-son",
    name: "Khánh Sơn - Khánh Hòa",
    fullAddress: "Khánh Sơn, Khánh Hòa, Việt Nam",
    shortAddress: "Khánh Sơn",
    maskedAddress: "Khánh Hòa",
    lat: 12.0300,
    lng: 108.9200,
    keywords: ["khanh son", "khánh sơn", "khánh hòa", "xe đi khánh sơn"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "san-bay-cam-ranh",
    name: "Sân bay Cam Ranh",
    fullAddress: "Sân bay quốc tế Cam Ranh, Khánh Hòa, Việt Nam",
    shortAddress: "Sân bay Cam Ranh",
    maskedAddress: "Cam Ranh, Khánh Hòa",
    lat: 11.9982,
    lng: 109.2194,
    keywords: ["san bay cam ranh", "sân bay cam ranh", "airport cam ranh", "xe đi sân bay cam ranh"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "vinpearl-nha-trang",
    name: "Vinpearl Nha Trang",
    fullAddress: "Vinpearl Nha Trang, Khánh Hòa, Việt Nam",
    shortAddress: "Vinpearl Nha Trang",
    maskedAddress: "Nha Trang, Khánh Hòa",
    lat: 12.2167,
    lng: 109.2400,
    keywords: ["vinpearl nha trang", "vinwonders nha trang", "xe đi vinpearl nha trang"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "hon-tre",
    name: "Hòn Tre - Nha Trang",
    fullAddress: "Hòn Tre, Nha Trang, Khánh Hòa, Việt Nam",
    shortAddress: "Hòn Tre",
    maskedAddress: "Nha Trang, Khánh Hòa",
    lat: 12.2150,
    lng: 109.2410,
    keywords: ["hon tre", "hòn tre", "nha trang", "xe đi hòn tre"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "bai-dai-cam-ranh",
    name: "Bãi Dài Cam Ranh",
    fullAddress: "Bãi Dài, Cam Ranh, Khánh Hòa, Việt Nam",
    shortAddress: "Bãi Dài Cam Ranh",
    maskedAddress: "Cam Ranh, Khánh Hòa",
    lat: 12.0500,
    lng: 109.2000,
    keywords: ["bai dai cam ranh", "bãi dài cam ranh", "resort cam ranh", "xe đi bãi dài cam ranh"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "doc-let",
    name: "Dốc Lết",
    fullAddress: "Dốc Lết, Ninh Hòa, Khánh Hòa, Việt Nam",
    shortAddress: "Dốc Lết",
    maskedAddress: "Ninh Hòa, Khánh Hòa",
    lat: 12.5420,
    lng: 109.2290,
    keywords: ["doc let", "dốc lết", "ninh hòa", "xe đi dốc lết"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "van-phong",
    name: "Vịnh Vân Phong",
    fullAddress: "Vịnh Vân Phong, Vạn Ninh, Khánh Hòa, Việt Nam",
    shortAddress: "Vân Phong",
    maskedAddress: "Vạn Ninh, Khánh Hòa",
    lat: 12.6500,
    lng: 109.3000,
    keywords: ["van phong", "vân phong", "vịnh vân phong", "xe đi vân phong"],
  }),

  loc({
    provinceSlug: "khanh-hoa",
    locationSlug: "ben-xe-phia-nam-nha-trang",
    name: "Bến xe phía Nam Nha Trang",
    fullAddress: "Bến xe phía Nam Nha Trang, Khánh Hòa, Việt Nam",
    shortAddress: "Bến xe phía Nam Nha Trang",
    maskedAddress: "Nha Trang, Khánh Hòa",
    lat: 12.2140,
    lng: 109.1910,
    keywords: ["ben xe phia nam nha trang", "bến xe phía nam nha trang", "xe đi bến xe nha trang"],
  }),
    // =========================
  // ĐÀ NẴNG
  // =========================

  loc({
    provinceSlug: "da-nang",
    locationSlug: "da-nang",
    name: "Đà Nẵng",
    fullAddress: "Đà Nẵng, Việt Nam",
    shortAddress: "Đà Nẵng",
    maskedAddress: "Đà Nẵng",
    lat: 16.0544,
    lng: 108.2022,
    keywords: ["da nang", "đà nẵng", "xe đi đà nẵng"],
  }),

  loc({
    provinceSlug: "da-nang",
    locationSlug: "san-bay-da-nang",
    name: "Sân bay Đà Nẵng",
    fullAddress: "Sân bay quốc tế Đà Nẵng, Việt Nam",
    shortAddress: "Sân bay Đà Nẵng",
    maskedAddress: "Đà Nẵng",
    lat: 16.0439,
    lng: 108.1990,
    keywords: [
      "san bay da nang",
      "sân bay đà nẵng",
      "airport da nang",
      "xe đi sân bay đà nẵng",
    ],
  }),

  loc({
    provinceSlug: "da-nang",
    locationSlug: "my-khe",
    name: "Biển Mỹ Khê",
    fullAddress: "Biển Mỹ Khê, Đà Nẵng, Việt Nam",
    shortAddress: "Mỹ Khê",
    maskedAddress: "Đà Nẵng",
    lat: 16.0678,
    lng: 108.2450,
    keywords: [
      "my khe",
      "mỹ khê",
      "bien my khe",
      "biển mỹ khê",
      "xe đi mỹ khê",
    ],
  }),

  loc({
    provinceSlug: "da-nang",
    locationSlug: "son-tra",
    name: "Bán đảo Sơn Trà",
    fullAddress: "Sơn Trà, Đà Nẵng, Việt Nam",
    shortAddress: "Sơn Trà",
    maskedAddress: "Đà Nẵng",
    lat: 16.1160,
    lng: 108.2770,
    keywords: [
      "son tra",
      "sơn trà",
      "ban dao son tra",
      "xe đi sơn trà",
    ],
  }),

  loc({
    provinceSlug: "da-nang",
    locationSlug: "ba-na-hills",
    name: "Bà Nà Hills",
    fullAddress: "Bà Nà Hills, Đà Nẵng, Việt Nam",
    shortAddress: "Bà Nà Hills",
    maskedAddress: "Đà Nẵng",
    lat: 15.9950,
    lng: 107.9960,
    keywords: [
      "ba na hills",
      "bà nà hills",
      "sun world ba na",
      "xe đi bà nà",
    ],
  }),

  loc({
    provinceSlug: "da-nang",
    locationSlug: "cau-rong",
    name: "Cầu Rồng",
    fullAddress: "Cầu Rồng, Đà Nẵng, Việt Nam",
    shortAddress: "Cầu Rồng",
    maskedAddress: "Đà Nẵng",
    lat: 16.0610,
    lng: 108.2270,
    keywords: [
      "cau rong",
      "cầu rồng",
      "dragon bridge",
      "xe đi cầu rồng",
    ],
  }),

  // =========================
  // QUẢNG NAM
  // =========================

  loc({
    provinceSlug: "quang-nam",
    locationSlug: "hoi-an",
    name: "Hội An - Quảng Nam",
    fullAddress: "Hội An, Quảng Nam, Việt Nam",
    shortAddress: "Hội An",
    maskedAddress: "Quảng Nam",
    lat: 15.8801,
    lng: 108.3380,
    keywords: [
      "hoi an",
      "hội an",
      "pho co hoi an",
      "phố cổ hội an",
      "xe đi hội an",
    ],
  }),

  loc({
    provinceSlug: "quang-nam",
    locationSlug: "tam-ky",
    name: "Tam Kỳ - Quảng Nam",
    fullAddress: "Tam Kỳ, Quảng Nam, Việt Nam",
    shortAddress: "Tam Kỳ",
    maskedAddress: "Quảng Nam",
    lat: 15.5736,
    lng: 108.4740,
    keywords: [
      "tam ky",
      "tam kỳ",
      "quảng nam",
      "xe đi tam kỳ",
    ],
  }),

  loc({
    provinceSlug: "quang-nam",
    locationSlug: "chu-lai",
    name: "Chu Lai - Quảng Nam",
    fullAddress: "Chu Lai, Quảng Nam, Việt Nam",
    shortAddress: "Chu Lai",
    maskedAddress: "Quảng Nam",
    lat: 15.4033,
    lng: 108.7060,
    keywords: [
      "chu lai",
      "sân bay chu lai",
      "san bay chu lai",
      "xe đi chu lai",
    ],
  }),

  loc({
    provinceSlug: "quang-nam",
    locationSlug: "san-bay-chu-lai",
    name: "Sân bay Chu Lai",
    fullAddress: "Sân bay Chu Lai, Quảng Nam, Việt Nam",
    shortAddress: "Sân bay Chu Lai",
    maskedAddress: "Quảng Nam",
    lat: 15.4033,
    lng: 108.7060,
    keywords: [
      "san bay chu lai",
      "sân bay chu lai",
      "airport chu lai",
      "xe đi sân bay chu lai",
    ],
  }),

  loc({
    provinceSlug: "quang-nam",
    locationSlug: "cu-lao-cham",
    name: "Cù Lao Chàm",
    fullAddress: "Cù Lao Chàm, Hội An, Quảng Nam, Việt Nam",
    shortAddress: "Cù Lao Chàm",
    maskedAddress: "Hội An, Quảng Nam",
    lat: 15.9500,
    lng: 108.5000,
    keywords: [
      "cu lao cham",
      "cù lao chàm",
      "xe đi cù lao chàm",
    ],
  }),

  loc({
    provinceSlug: "quang-nam",
    locationSlug: "dien-ban",
    name: "Điện Bàn - Quảng Nam",
    fullAddress: "Điện Bàn, Quảng Nam, Việt Nam",
    shortAddress: "Điện Bàn",
    maskedAddress: "Quảng Nam",
    lat: 15.8900,
    lng: 108.2500,
    keywords: [
      "dien ban",
      "điện bàn",
      "quảng nam",
      "xe đi điện bàn",
    ],
  }),

  loc({
    provinceSlug: "quang-nam",
    locationSlug: "vinwonders-nam-hoi-an",
    name: "VinWonders Nam Hội An",
    fullAddress: "VinWonders Nam Hội An, Quảng Nam, Việt Nam",
    shortAddress: "VinWonders Nam Hội An",
    maskedAddress: "Quảng Nam",
    lat: 15.8090,
    lng: 108.3980,
    keywords: [
      "vinwonders nam hoi an",
      "vinpearl nam hội an",
      "xe đi vinwonders nam hội an",
    ],
  }),
    // =========================
  // HUẾ
  // =========================

  loc({
    provinceSlug: "hue",
    locationSlug: "hue",
    name: "Huế",
    fullAddress: "Huế, Việt Nam",
    shortAddress: "Huế",
    maskedAddress: "Huế",
    lat: 16.4637,
    lng: 107.5909,
    keywords: ["hue", "huế", "cố đô", "co do", "xe đi huế"],
  }),

  loc({
    provinceSlug: "hue",
    locationSlug: "phu-bai",
    name: "Sân bay Phú Bài",
    fullAddress: "Sân bay Phú Bài, Huế, Việt Nam",
    shortAddress: "Sân bay Phú Bài",
    maskedAddress: "Huế",
    lat: 16.4015,
    lng: 107.7030,
    keywords: [
      "san bay phu bai",
      "sân bay phú bài",
      "airport hue",
      "xe đi sân bay phú bài",
    ],
  }),

  loc({
    provinceSlug: "hue",
    locationSlug: "lang-co",
    name: "Lăng Cô",
    fullAddress: "Lăng Cô, Huế, Việt Nam",
    shortAddress: "Lăng Cô",
    maskedAddress: "Huế",
    lat: 16.2670,
    lng: 107.8790,
    keywords: [
      "lang co",
      "lăng cô",
      "biển lăng cô",
      "xe đi lăng cô",
    ],
  }),

  loc({
    provinceSlug: "hue",
    locationSlug: "dai-noi",
    name: "Đại Nội Huế",
    fullAddress: "Đại Nội Huế, Việt Nam",
    shortAddress: "Đại Nội",
    maskedAddress: "Huế",
    lat: 16.4700,
    lng: 107.5780,
    keywords: [
      "dai noi hue",
      "đại nội huế",
      "kinh thanh hue",
      "xe đi đại nội",
    ],
  }),

  loc({
    provinceSlug: "hue",
    locationSlug: "thuan-an",
    name: "Biển Thuận An",
    fullAddress: "Biển Thuận An, Huế, Việt Nam",
    shortAddress: "Thuận An",
    maskedAddress: "Huế",
    lat: 16.5670,
    lng: 107.6500,
    keywords: [
      "thuan an hue",
      "thuận an huế",
      "biển thuận an",
      "xe đi thuận an huế",
    ],
  }),

  // =========================
  // QUẢNG TRỊ
  // =========================

  loc({
    provinceSlug: "quang-tri",
    locationSlug: "dong-ha",
    name: "Đông Hà - Quảng Trị",
    fullAddress: "Đông Hà, Quảng Trị, Việt Nam",
    shortAddress: "Đông Hà",
    maskedAddress: "Quảng Trị",
    lat: 16.8163,
    lng: 107.1003,
    keywords: [
      "dong ha",
      "đông hà",
      "quảng trị",
      "xe đi đông hà",
    ],
  }),

  loc({
    provinceSlug: "quang-tri",
    locationSlug: "lao-bao",
    name: "Lao Bảo",
    fullAddress: "Lao Bảo, Quảng Trị, Việt Nam",
    shortAddress: "Lao Bảo",
    maskedAddress: "Quảng Trị",
    lat: 16.6200,
    lng: 106.6000,
    keywords: [
      "lao bao",
      "lao bảo",
      "cửa khẩu lao bảo",
      "xe đi lao bảo",
    ],
  }),

  loc({
    provinceSlug: "quang-tri",
    locationSlug: "cua-viet",
    name: "Cửa Việt",
    fullAddress: "Cửa Việt, Quảng Trị, Việt Nam",
    shortAddress: "Cửa Việt",
    maskedAddress: "Quảng Trị",
    lat: 16.8750,
    lng: 107.1100,
    keywords: [
      "cua viet",
      "cửa việt",
      "biển cửa việt",
      "xe đi cửa việt",
    ],
  }),

  // =========================
  // QUẢNG BÌNH
  // =========================

  loc({
    provinceSlug: "quang-binh",
    locationSlug: "dong-hoi",
    name: "Đồng Hới - Quảng Bình",
    fullAddress: "Đồng Hới, Quảng Bình, Việt Nam",
    shortAddress: "Đồng Hới",
    maskedAddress: "Quảng Bình",
    lat: 17.4689,
    lng: 106.6223,
    keywords: [
      "dong hoi",
      "đồng hới",
      "quảng bình",
      "xe đi đồng hới",
    ],
  }),

  loc({
    provinceSlug: "quang-binh",
    locationSlug: "san-bay-dong-hoi",
    name: "Sân bay Đồng Hới",
    fullAddress: "Sân bay Đồng Hới, Quảng Bình, Việt Nam",
    shortAddress: "Sân bay Đồng Hới",
    maskedAddress: "Quảng Bình",
    lat: 17.5150,
    lng: 106.5900,
    keywords: [
      "san bay dong hoi",
      "sân bay đồng hới",
      "airport dong hoi",
      "xe đi sân bay đồng hới",
    ],
  }),

  loc({
    provinceSlug: "quang-binh",
    locationSlug: "phong-nha",
    name: "Phong Nha",
    fullAddress: "Phong Nha, Quảng Bình, Việt Nam",
    shortAddress: "Phong Nha",
    maskedAddress: "Quảng Bình",
    lat: 17.5480,
    lng: 106.2870,
    keywords: [
      "phong nha",
      "phong nha ke bang",
      "phong nha kẻ bàng",
      "xe đi phong nha",
    ],
  }),

  loc({
    provinceSlug: "quang-binh",
    locationSlug: "dong-thien-duong",
    name: "Động Thiên Đường",
    fullAddress: "Động Thiên Đường, Quảng Bình, Việt Nam",
    shortAddress: "Động Thiên Đường",
    maskedAddress: "Quảng Bình",
    lat: 17.5850,
    lng: 106.2780,
    keywords: [
      "dong thien duong",
      "động thiên đường",
      "xe đi động thiên đường",
    ],
  }),

  loc({
    provinceSlug: "quang-binh",
    locationSlug: "son-doong",
    name: "Hang Sơn Đoòng",
    fullAddress: "Hang Sơn Đoòng, Quảng Bình, Việt Nam",
    shortAddress: "Sơn Đoòng",
    maskedAddress: "Quảng Bình",
    lat: 17.4570,
    lng: 106.2870,
    keywords: [
      "son doong",
      "sơn đoòng",
      "hang son doong",
      "xe đi sơn đoòng",
    ],
  }),
    // =========================
  // GIA LAI
  // =========================

  loc({
    provinceSlug: "gia-lai",
    locationSlug: "pleiku",
    name: "Pleiku - Gia Lai",
    fullAddress: "Pleiku, Gia Lai, Việt Nam",
    shortAddress: "Pleiku",
    maskedAddress: "Gia Lai",
    lat: 13.9833,
    lng: 108.0000,
    keywords: ["pleiku", "gia lai", "xe đi pleiku"],
  }),

  loc({
    provinceSlug: "gia-lai",
    locationSlug: "san-bay-pleiku",
    name: "Sân bay Pleiku",
    fullAddress: "Sân bay Pleiku, Gia Lai, Việt Nam",
    shortAddress: "Sân bay Pleiku",
    maskedAddress: "Gia Lai",
    lat: 13.9550,
    lng: 108.0160,
    keywords: [
      "san bay pleiku",
      "sân bay pleiku",
      "airport pleiku",
      "xe đi sân bay pleiku",
    ],
  }),

  loc({
    provinceSlug: "gia-lai",
    locationSlug: "bien-ho",
    name: "Biển Hồ Pleiku",
    fullAddress: "Biển Hồ, Pleiku, Gia Lai, Việt Nam",
    shortAddress: "Biển Hồ",
    maskedAddress: "Pleiku, Gia Lai",
    lat: 13.9890,
    lng: 107.9950,
    keywords: [
      "bien ho",
      "biển hồ",
      "t'nung",
      "xe đi biển hồ",
    ],
  }),

  loc({
    provinceSlug: "gia-lai",
    locationSlug: "chu-se",
    name: "Chư Sê - Gia Lai",
    fullAddress: "Chư Sê, Gia Lai, Việt Nam",
    shortAddress: "Chư Sê",
    maskedAddress: "Gia Lai",
    lat: 13.7400,
    lng: 108.0800,
    keywords: ["chu se", "chư sê", "xe đi chư sê"],
  }),

  loc({
    provinceSlug: "gia-lai",
    locationSlug: "an-khe",
    name: "An Khê - Gia Lai",
    fullAddress: "An Khê, Gia Lai, Việt Nam",
    shortAddress: "An Khê",
    maskedAddress: "Gia Lai",
    lat: 14.0300,
    lng: 108.6500,
    keywords: ["an khe", "an khê", "xe đi an khê"],
  }),

  // =========================
  // ĐẮK LẮK
  // =========================

  loc({
    provinceSlug: "dak-lak",
    locationSlug: "buon-ma-thuot",
    name: "Buôn Ma Thuột - Đắk Lắk",
    fullAddress: "Buôn Ma Thuột, Đắk Lắk, Việt Nam",
    shortAddress: "Buôn Ma Thuột",
    maskedAddress: "Đắk Lắk",
    lat: 12.6667,
    lng: 108.0500,
    keywords: [
      "buon ma thuot",
      "buôn ma thuột",
      "dak lak",
      "đắk lắk",
      "xe đi buôn ma thuột",
    ],
  }),

  loc({
    provinceSlug: "dak-lak",
    locationSlug: "san-bay-buon-ma-thuot",
    name: "Sân bay Buôn Ma Thuột",
    fullAddress: "Sân bay Buôn Ma Thuột, Đắk Lắk, Việt Nam",
    shortAddress: "Sân bay Buôn Ma Thuột",
    maskedAddress: "Đắk Lắk",
    lat: 12.6683,
    lng: 108.1200,
    keywords: [
      "san bay buon ma thuot",
      "sân bay buôn ma thuột",
      "airport bmt",
      "xe đi sân bay buôn ma thuột",
    ],
  }),

  loc({
    provinceSlug: "dak-lak",
    locationSlug: "ho-lak",
    name: "Hồ Lắk",
    fullAddress: "Hồ Lắk, Đắk Lắk, Việt Nam",
    shortAddress: "Hồ Lắk",
    maskedAddress: "Đắk Lắk",
    lat: 12.3800,
    lng: 108.2800,
    keywords: [
      "ho lak",
      "hồ lắk",
      "xe đi hồ lắk",
    ],
  }),

  loc({
    provinceSlug: "dak-lak",
    locationSlug: "buon-don",
    name: "Buôn Đôn",
    fullAddress: "Buôn Đôn, Đắk Lắk, Việt Nam",
    shortAddress: "Buôn Đôn",
    maskedAddress: "Đắk Lắk",
    lat: 12.9000,
    lng: 107.7000,
    keywords: [
      "buon don",
      "buôn đôn",
      "xe đi buôn đôn",
    ],
  }),

  loc({
    provinceSlug: "dak-lak",
    locationSlug: "ea-kar",
    name: "Ea Kar",
    fullAddress: "Ea Kar, Đắk Lắk, Việt Nam",
    shortAddress: "Ea Kar",
    maskedAddress: "Đắk Lắk",
    lat: 12.8200,
    lng: 108.4500,
    keywords: [
      "ea kar",
      "xe đi ea kar",
    ],
  }),

  // =========================
  // ĐẮK NÔNG
  // =========================

  loc({
    provinceSlug: "dak-nong",
    locationSlug: "gia-nghia",
    name: "Gia Nghĩa - Đắk Nông",
    fullAddress: "Gia Nghĩa, Đắk Nông, Việt Nam",
    shortAddress: "Gia Nghĩa",
    maskedAddress: "Đắk Nông",
    lat: 12.0042,
    lng: 107.6900,
    keywords: [
      "gia nghia",
      "gia nghĩa",
      "dak nong",
      "đắk nông",
      "xe đi gia nghĩa",
    ],
  }),

  loc({
    provinceSlug: "dak-nong",
    locationSlug: "ta-dung",
    name: "Tà Đùng",
    fullAddress: "Tà Đùng, Đắk Nông, Việt Nam",
    shortAddress: "Tà Đùng",
    maskedAddress: "Đắk Nông",
    lat: 11.8500,
    lng: 107.9000,
    keywords: [
      "ta dung",
      "tà đùng",
      "vịnh hạ long tây nguyên",
      "xe đi tà đùng",
    ],
  }),

  loc({
    provinceSlug: "dak-nong",
    locationSlug: "dak-mil",
    name: "Đắk Mil",
    fullAddress: "Đắk Mil, Đắk Nông, Việt Nam",
    shortAddress: "Đắk Mil",
    maskedAddress: "Đắk Nông",
    lat: 12.4500,
    lng: 107.6300,
    keywords: [
      "dak mil",
      "đắk mil",
      "xe đi đắk mil",
    ],
  }),

  loc({
    provinceSlug: "dak-nong",
    locationSlug: "cu-jut",
    name: "Cư Jút",
    fullAddress: "Cư Jút, Đắk Nông, Việt Nam",
    shortAddress: "Cư Jút",
    maskedAddress: "Đắk Nông",
    lat: 12.7200,
    lng: 107.7800,
    keywords: [
      "cu jut",
      "cư jút",
      "xe đi cư jút",
    ],
  }),
    // =========================
  // THANH HÓA
  // =========================

  loc({
    provinceSlug: "thanh-hoa",
    locationSlug: "thanh-hoa",
    name: "Thanh Hóa",
    fullAddress: "Thanh Hóa, Việt Nam",
    shortAddress: "Thanh Hóa",
    maskedAddress: "Thanh Hóa",
    lat: 19.8077,
    lng: 105.7764,
    keywords: ["thanh hoa", "thanh hóa", "xe đi thanh hóa"],
  }),

  loc({
    provinceSlug: "thanh-hoa",
    locationSlug: "sam-son",
    name: "Sầm Sơn",
    fullAddress: "Sầm Sơn, Thanh Hóa, Việt Nam",
    shortAddress: "Sầm Sơn",
    maskedAddress: "Thanh Hóa",
    lat: 19.7400,
    lng: 105.9000,
    keywords: ["sam son", "sầm sơn", "biển sầm sơn", "xe đi sầm sơn"],
  }),

  loc({
    provinceSlug: "thanh-hoa",
    locationSlug: "tho-xuan",
    name: "Thọ Xuân - Thanh Hóa",
    fullAddress: "Thọ Xuân, Thanh Hóa, Việt Nam",
    shortAddress: "Thọ Xuân",
    maskedAddress: "Thanh Hóa",
    lat: 19.9020,
    lng: 105.4670,
    keywords: ["tho xuan", "thọ xuân", "sân bay thọ xuân", "xe đi thọ xuân"],
  }),

  loc({
    provinceSlug: "thanh-hoa",
    locationSlug: "san-bay-tho-xuan",
    name: "Sân bay Thọ Xuân",
    fullAddress: "Sân bay Thọ Xuân, Thanh Hóa, Việt Nam",
    shortAddress: "Sân bay Thọ Xuân",
    maskedAddress: "Thanh Hóa",
    lat: 19.9017,
    lng: 105.4670,
    keywords: ["san bay tho xuan", "sân bay thọ xuân", "airport thanh hóa", "xe đi sân bay thọ xuân"],
  }),

  loc({
    provinceSlug: "thanh-hoa",
    locationSlug: "nghi-son",
    name: "Nghi Sơn",
    fullAddress: "Nghi Sơn, Thanh Hóa, Việt Nam",
    shortAddress: "Nghi Sơn",
    maskedAddress: "Thanh Hóa",
    lat: 19.3060,
    lng: 105.7920,
    keywords: ["nghi son", "nghi sơn", "khu kinh tế nghi sơn", "xe đi nghi sơn"],
  }),

  // =========================
  // NGHỆ AN
  // =========================

  loc({
    provinceSlug: "nghe-an",
    locationSlug: "vinh",
    name: "Vinh - Nghệ An",
    fullAddress: "Vinh, Nghệ An, Việt Nam",
    shortAddress: "Vinh",
    maskedAddress: "Nghệ An",
    lat: 18.6796,
    lng: 105.6813,
    keywords: ["vinh", "nghe an", "nghệ an", "xe đi vinh", "xe đi nghệ an"],
  }),

  loc({
    provinceSlug: "nghe-an",
    locationSlug: "san-bay-vinh",
    name: "Sân bay Vinh",
    fullAddress: "Sân bay Vinh, Nghệ An, Việt Nam",
    shortAddress: "Sân bay Vinh",
    maskedAddress: "Nghệ An",
    lat: 18.7376,
    lng: 105.6710,
    keywords: ["san bay vinh", "sân bay vinh", "airport vinh", "xe đi sân bay vinh"],
  }),

  loc({
    provinceSlug: "nghe-an",
    locationSlug: "cua-lo",
    name: "Cửa Lò",
    fullAddress: "Cửa Lò, Nghệ An, Việt Nam",
    shortAddress: "Cửa Lò",
    maskedAddress: "Nghệ An",
    lat: 18.7920,
    lng: 105.7250,
    keywords: ["cua lo", "cửa lò", "biển cửa lò", "xe đi cửa lò"],
  }),

  loc({
    provinceSlug: "nghe-an",
    locationSlug: "nam-dan",
    name: "Nam Đàn - Nghệ An",
    fullAddress: "Nam Đàn, Nghệ An, Việt Nam",
    shortAddress: "Nam Đàn",
    maskedAddress: "Nghệ An",
    lat: 18.6700,
    lng: 105.5300,
    keywords: ["nam dan", "nam đàn", "quê bác", "xe đi nam đàn"],
  }),

  loc({
    provinceSlug: "nghe-an",
    locationSlug: "dien-chau",
    name: "Diễn Châu - Nghệ An",
    fullAddress: "Diễn Châu, Nghệ An, Việt Nam",
    shortAddress: "Diễn Châu",
    maskedAddress: "Nghệ An",
    lat: 18.9880,
    lng: 105.5760,
    keywords: ["dien chau", "diễn châu", "xe đi diễn châu"],
  }),

  // =========================
  // HÀ TĨNH
  // =========================

  loc({
    provinceSlug: "ha-tinh",
    locationSlug: "ha-tinh",
    name: "Hà Tĩnh",
    fullAddress: "Hà Tĩnh, Việt Nam",
    shortAddress: "Hà Tĩnh",
    maskedAddress: "Hà Tĩnh",
    lat: 18.3559,
    lng: 105.8877,
    keywords: ["ha tinh", "hà tĩnh", "xe đi hà tĩnh"],
  }),

  loc({
    provinceSlug: "ha-tinh",
    locationSlug: "ky-anh",
    name: "Kỳ Anh - Hà Tĩnh",
    fullAddress: "Kỳ Anh, Hà Tĩnh, Việt Nam",
    shortAddress: "Kỳ Anh",
    maskedAddress: "Hà Tĩnh",
    lat: 18.0580,
    lng: 106.2960,
    keywords: ["ky anh", "kỳ anh", "xe đi kỳ anh"],
  }),

  loc({
    provinceSlug: "ha-tinh",
    locationSlug: "formosa-ha-tinh",
    name: "Formosa Hà Tĩnh",
    fullAddress: "Formosa Hà Tĩnh, Kỳ Anh, Hà Tĩnh, Việt Nam",
    shortAddress: "Formosa Hà Tĩnh",
    maskedAddress: "Kỳ Anh, Hà Tĩnh",
    lat: 18.0970,
    lng: 106.3650,
    keywords: ["formosa ha tinh", "formosa hà tĩnh", "khu kinh tế vũng áng", "xe đi formosa hà tĩnh"],
  }),

  loc({
    provinceSlug: "ha-tinh",
    locationSlug: "thien-cam",
    name: "Thiên Cầm",
    fullAddress: "Thiên Cầm, Hà Tĩnh, Việt Nam",
    shortAddress: "Thiên Cầm",
    maskedAddress: "Hà Tĩnh",
    lat: 18.2700,
    lng: 106.0900,
    keywords: ["thien cam", "thiên cầm", "biển thiên cầm", "xe đi thiên cầm"],
  }),
];

export default CENTRAL_LOCATIONS;
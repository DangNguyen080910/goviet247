// apps/rider-mobile/constants/airportLocations.js

const airport = ({
  airportSlug,
  name,
  fullAddress,
  shortAddress,
  maskedAddress,
  lat,
  lng,
  keywords,
}) => ({
  placeId: `goviet247:airport:${airportSlug}`,
  name,
  fullAddress,
  shortAddress,
  maskedAddress,
  lat,
  lng,
  keywords,
});

export const AIRPORT_LOCATIONS = [
  airport({
    airportSlug: "tan-son-nhat",
    name: "Sân bay Tân Sơn Nhất",
    fullAddress: "Sân bay quốc tế Tân Sơn Nhất, TP.HCM, Việt Nam",
    shortAddress: "Tân Sơn Nhất",
    maskedAddress: "TP.HCM",
    lat: 10.8188,
    lng: 106.6519,
    keywords: ["san bay tan son nhat", "sân bay tân sơn nhất", "tsn", "airport tphcm", "xe đi sân bay"],
  }),

  airport({
    airportSlug: "long-thanh",
    name: "Sân bay Long Thành",
    fullAddress: "Sân bay quốc tế Long Thành, Long Thành, Đồng Nai, Việt Nam",
    shortAddress: "Long Thành",
    maskedAddress: "Đồng Nai",
    lat: 10.7696,
    lng: 107.0553,
    keywords: ["san bay long thanh", "sân bay long thành", "long thanh airport", "xe đi sân bay long thành"],
  }),

  airport({
    airportSlug: "can-tho",
    name: "Sân bay Cần Thơ",
    fullAddress: "Sân bay quốc tế Cần Thơ, Bình Thủy, Cần Thơ, Việt Nam",
    shortAddress: "Cần Thơ",
    maskedAddress: "Cần Thơ",
    lat: 10.0851,
    lng: 105.7119,
    keywords: ["san bay can tho", "sân bay cần thơ", "sân bay quốc tế cần thơ", "xe đi sân bay cần thơ"],
  }),

  airport({
    airportSlug: "phu-quoc",
    name: "Sân bay Phú Quốc",
    fullAddress: "Sân bay quốc tế Phú Quốc, Phú Quốc, Kiên Giang, Việt Nam",
    shortAddress: "Phú Quốc",
    maskedAddress: "Kiên Giang",
    lat: 10.1698,
    lng: 103.9931,
    keywords: ["san bay phu quoc", "sân bay phú quốc", "sân bay quốc tế phú quốc", "xe đi sân bay phú quốc"],
  }),

  airport({
    airportSlug: "rach-gia",
    name: "Sân bay Rạch Giá",
    fullAddress: "Sân bay Rạch Giá, Rạch Giá, Kiên Giang, Việt Nam",
    shortAddress: "Rạch Giá",
    maskedAddress: "Kiên Giang",
    lat: 9.9580,
    lng: 105.1324,
    keywords: ["san bay rach gia", "sân bay rạch giá", "xe đi sân bay rạch giá"],
  }),

  airport({
    airportSlug: "ca-mau",
    name: "Sân bay Cà Mau",
    fullAddress: "Sân bay Cà Mau, Cà Mau, Việt Nam",
    shortAddress: "Cà Mau",
    maskedAddress: "Cà Mau",
    lat: 9.1777,
    lng: 105.1778,
    keywords: ["san bay ca mau", "sân bay cà mau", "xe đi sân bay cà mau"],
  }),

  airport({
    airportSlug: "con-dao",
    name: "Sân bay Côn Đảo",
    fullAddress: "Sân bay Côn Đảo, Bà Rịa - Vũng Tàu, Việt Nam",
    shortAddress: "Côn Đảo",
    maskedAddress: "Bà Rịa - Vũng Tàu",
    lat: 8.7318,
    lng: 106.6335,
    keywords: ["san bay con dao", "sân bay côn đảo", "xe đi sân bay côn đảo"],
  }),

  airport({
    airportSlug: "da-nang",
    name: "Sân bay Đà Nẵng",
    fullAddress: "Sân bay quốc tế Đà Nẵng, Đà Nẵng, Việt Nam",
    shortAddress: "Đà Nẵng",
    maskedAddress: "Đà Nẵng",
    lat: 16.0439,
    lng: 108.1990,
    keywords: ["san bay da nang", "sân bay đà nẵng", "sân bay quốc tế đà nẵng", "xe đi sân bay đà nẵng"],
  }),

  airport({
    airportSlug: "cam-ranh",
    name: "Sân bay Cam Ranh",
    fullAddress: "Sân bay quốc tế Cam Ranh, Khánh Hòa, Việt Nam",
    shortAddress: "Cam Ranh",
    maskedAddress: "Khánh Hòa",
    lat: 11.9982,
    lng: 109.2194,
    keywords: ["san bay cam ranh", "sân bay cam ranh", "sân bay quốc tế cam ranh", "xe đi sân bay cam ranh"],
  }),

  airport({
    airportSlug: "lien-khuong",
    name: "Sân bay Liên Khương",
    fullAddress: "Sân bay Liên Khương, Đức Trọng, Lâm Đồng, Việt Nam",
    shortAddress: "Liên Khương",
    maskedAddress: "Lâm Đồng",
    lat: 11.7506,
    lng: 108.3730,
    keywords: ["san bay lien khuong", "sân bay liên khương", "sân bay đà lạt", "xe đi sân bay liên khương"],
  }),

  airport({
    airportSlug: "phu-bai",
    name: "Sân bay Phú Bài",
    fullAddress: "Sân bay quốc tế Phú Bài, Huế, Việt Nam",
    shortAddress: "Phú Bài",
    maskedAddress: "Huế",
    lat: 16.4015,
    lng: 107.7030,
    keywords: ["san bay phu bai", "sân bay phú bài", "sân bay huế", "xe đi sân bay phú bài"],
  }),

  airport({
    airportSlug: "chu-lai",
    name: "Sân bay Chu Lai",
    fullAddress: "Sân bay Chu Lai, Quảng Nam, Việt Nam",
    shortAddress: "Chu Lai",
    maskedAddress: "Quảng Nam",
    lat: 15.4033,
    lng: 108.7060,
    keywords: ["san bay chu lai", "sân bay chu lai", "xe đi sân bay chu lai"],
  }),

  airport({
    airportSlug: "tuy-hoa",
    name: "Sân bay Tuy Hòa",
    fullAddress: "Sân bay Tuy Hòa, Phú Yên, Việt Nam",
    shortAddress: "Tuy Hòa",
    maskedAddress: "Phú Yên",
    lat: 13.0496,
    lng: 109.3340,
    keywords: ["san bay tuy hoa", "sân bay tuy hòa", "sân bay phú yên", "xe đi sân bay tuy hòa"],
  }),

  airport({
    airportSlug: "vinh",
    name: "Sân bay Vinh",
    fullAddress: "Sân bay quốc tế Vinh, Nghệ An, Việt Nam",
    shortAddress: "Vinh",
    maskedAddress: "Nghệ An",
    lat: 18.7376,
    lng: 105.6710,
    keywords: ["san bay vinh", "sân bay vinh", "sân bay nghệ an", "xe đi sân bay vinh"],
  }),

  airport({
    airportSlug: "dong-hoi",
    name: "Sân bay Đồng Hới",
    fullAddress: "Sân bay Đồng Hới, Quảng Bình, Việt Nam",
    shortAddress: "Đồng Hới",
    maskedAddress: "Quảng Bình",
    lat: 17.5150,
    lng: 106.5900,
    keywords: ["san bay dong hoi", "sân bay đồng hới", "sân bay quảng bình", "xe đi sân bay đồng hới"],
  }),

  airport({
    airportSlug: "pleiku",
    name: "Sân bay Pleiku",
    fullAddress: "Sân bay Pleiku, Gia Lai, Việt Nam",
    shortAddress: "Pleiku",
    maskedAddress: "Gia Lai",
    lat: 13.9550,
    lng: 108.0160,
    keywords: ["san bay pleiku", "sân bay pleiku", "sân bay gia lai", "xe đi sân bay pleiku"],
  }),

  airport({
    airportSlug: "buon-ma-thuot",
    name: "Sân bay Buôn Ma Thuột",
    fullAddress: "Sân bay Buôn Ma Thuột, Đắk Lắk, Việt Nam",
    shortAddress: "Buôn Ma Thuột",
    maskedAddress: "Đắk Lắk",
    lat: 12.6683,
    lng: 108.1200,
    keywords: ["san bay buon ma thuot", "sân bay buôn ma thuột", "sân bay đắk lắk", "xe đi sân bay buôn ma thuột"],
  }),

  airport({
    airportSlug: "phu-cat",
    name: "Sân bay Phù Cát",
    fullAddress: "Sân bay Phù Cát, Bình Định, Việt Nam",
    shortAddress: "Phù Cát",
    maskedAddress: "Bình Định",
    lat: 13.9549,
    lng: 109.0422,
    keywords: ["san bay phu cat", "sân bay phù cát", "sân bay quy nhơn", "xe đi sân bay phù cát"],
  }),

  airport({
    airportSlug: "noi-bai",
    name: "Sân bay Nội Bài",
    fullAddress: "Sân bay quốc tế Nội Bài, Hà Nội, Việt Nam",
    shortAddress: "Nội Bài",
    maskedAddress: "Hà Nội",
    lat: 21.2187,
    lng: 105.8040,
    keywords: ["san bay noi bai", "sân bay nội bài", "sân bay hà nội", "xe đi sân bay nội bài"],
  }),

  airport({
    airportSlug: "cat-bi",
    name: "Sân bay Cát Bi",
    fullAddress: "Sân bay quốc tế Cát Bi, Hải Phòng, Việt Nam",
    shortAddress: "Cát Bi",
    maskedAddress: "Hải Phòng",
    lat: 20.8194,
    lng: 106.7240,
    keywords: ["san bay cat bi", "sân bay cát bi", "sân bay hải phòng", "xe đi sân bay cát bi"],
  }),

  airport({
    airportSlug: "van-don",
    name: "Sân bay Vân Đồn",
    fullAddress: "Sân bay quốc tế Vân Đồn, Quảng Ninh, Việt Nam",
    shortAddress: "Vân Đồn",
    maskedAddress: "Quảng Ninh",
    lat: 21.1210,
    lng: 107.4150,
    keywords: ["san bay van don", "sân bay vân đồn", "sân bay quảng ninh", "xe đi sân bay vân đồn"],
  }),

  airport({
    airportSlug: "tho-xuan",
    name: "Sân bay Thọ Xuân",
    fullAddress: "Sân bay Thọ Xuân, Thanh Hóa, Việt Nam",
    shortAddress: "Thọ Xuân",
    maskedAddress: "Thanh Hóa",
    lat: 19.9017,
    lng: 105.4670,
    keywords: ["san bay tho xuan", "sân bay thọ xuân", "sân bay thanh hóa", "xe đi sân bay thọ xuân"],
  }),

  airport({
    airportSlug: "dien-bien",
    name: "Sân bay Điện Biên",
    fullAddress: "Sân bay Điện Biên, Điện Biên, Việt Nam",
    shortAddress: "Điện Biên",
    maskedAddress: "Điện Biên",
    lat: 21.3975,
    lng: 103.0080,
    keywords: ["san bay dien bien", "sân bay điện biên", "xe đi sân bay điện biên"],
  }),
];

export default AIRPORT_LOCATIONS;
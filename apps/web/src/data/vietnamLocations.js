const VIETNAM_LOCATIONS = [
  {
    name: "Hà Nội",
    fullAddress: "Hà Nội, Việt Nam",
    shortAddress: "Hà Nội",
    maskedAddress: "Thủ đô",
    lat: 21.0278,
    lng: 105.8342,
    keywords: ["ha noi", "hà nội", "hoan kiem", "hoàn kiếm", "noi bai", "nội bài"],
  },
  {
    name: "TP. Hồ Chí Minh",
    fullAddress: "TP. Hồ Chí Minh, Việt Nam",
    shortAddress: "TP. Hồ Chí Minh",
    maskedAddress: "Sài Gòn",
    lat: 10.8231,
    lng: 106.6297,
    keywords: ["hcm", "tphcm", "tp hcm", "sai gon", "sài gòn", "ho chi minh", "tan son nhat", "tân sơn nhất"],
  },
  {
    name: "Huế",
    fullAddress: "Huế, Việt Nam",
    shortAddress: "Huế",
    maskedAddress: "Cố đô Huế",
    lat: 16.4637,
    lng: 107.5909,
    keywords: ["hue", "huế", "co do hue", "cố đô huế"],
  },
  {
    name: "Đà Nẵng",
    fullAddress: "Đà Nẵng, Việt Nam",
    shortAddress: "Đà Nẵng",
    maskedAddress: "Hội An, Tam Kỳ",
    lat: 16.0544,
    lng: 108.2022,
    keywords: ["da nang", "đà nẵng", "hoi an", "hội an", "tam ky", "tam kỳ", "quang nam", "quảng nam"],
  },
  {
    name: "Hải Phòng",
    fullAddress: "Hải Phòng, Việt Nam",
    shortAddress: "Hải Phòng",
    maskedAddress: "Hải Dương, Cát Bà",
    lat: 20.8449,
    lng: 106.6881,
    keywords: ["hai phong", "hải phòng", "hai duong", "hải dương", "cat ba", "cát bà", "do son", "đồ sơn"],
  },
  {
    name: "Cần Thơ",
    fullAddress: "Cần Thơ, Việt Nam",
    shortAddress: "Cần Thơ",
    maskedAddress: "Hậu Giang, Sóc Trăng",
    lat: 10.0452,
    lng: 105.7469,
    keywords: ["can tho", "cần thơ", "hau giang", "hậu giang", "soc trang", "sóc trăng", "ninh kieu", "ninh kiều", "cai rang", "cái răng"],
  },

  {
    name: "Lai Châu",
    fullAddress: "Lai Châu, Việt Nam",
    shortAddress: "Lai Châu",
    maskedAddress: "Tây Bắc",
    lat: 22.3862,
    lng: 103.4707,
    keywords: ["lai chau", "lai châu", "tam duong", "tam đường"],
  },
  {
    name: "Điện Biên",
    fullAddress: "Điện Biên, Việt Nam",
    shortAddress: "Điện Biên",
    maskedAddress: "Điện Biên Phủ",
    lat: 21.386,
    lng: 103.023,
    keywords: ["dien bien", "điện biên", "dien bien phu", "điện biên phủ"],
  },
  {
    name: "Sơn La",
    fullAddress: "Sơn La, Việt Nam",
    shortAddress: "Sơn La",
    maskedAddress: "Mộc Châu",
    lat: 21.327,
    lng: 103.914,
    keywords: ["son la", "sơn la", "moc chau", "mộc châu", "mai son", "mai sơn"],
  },
  {
    name: "Lạng Sơn",
    fullAddress: "Lạng Sơn, Việt Nam",
    shortAddress: "Lạng Sơn",
    maskedAddress: "Cửa khẩu Hữu Nghị",
    lat: 21.8537,
    lng: 106.7615,
    keywords: ["lang son", "lạng sơn", "huu nghi", "hữu nghị", "dong dang", "đồng đăng"],
  },
  {
    name: "Quảng Ninh",
    fullAddress: "Quảng Ninh, Việt Nam",
    shortAddress: "Quảng Ninh",
    maskedAddress: "Hạ Long, Móng Cái",
    lat: 20.9712,
    lng: 107.0448,
    keywords: ["quang ninh", "quảng ninh", "ha long", "hạ long", "mong cai", "móng cái", "cam pha", "cẩm phả", "van don", "vân đồn"],
  },
  {
    name: "Cao Bằng",
    fullAddress: "Cao Bằng, Việt Nam",
    shortAddress: "Cao Bằng",
    maskedAddress: "Thác Bản Giốc",
    lat: 22.6666,
    lng: 106.2639,
    keywords: ["cao bang", "cao bằng", "ban gioc", "bản giốc"],
  },
  {
    name: "Tuyên Quang",
    fullAddress: "Tuyên Quang, Việt Nam",
    shortAddress: "Tuyên Quang",
    maskedAddress: "Hà Giang",
    lat: 21.7767,
    lng: 105.228,
    keywords: ["tuyen quang", "tuyên quang", "ha giang", "hà giang", "dong van", "đồng văn", "meo vac", "mèo vạc", "hoang su phi", "hoàng su phì"],
  },
  {
    name: "Lào Cai",
    fullAddress: "Lào Cai, Việt Nam",
    shortAddress: "Lào Cai",
    maskedAddress: "Yên Bái, Sa Pa",
    lat: 22.4809,
    lng: 103.9755,
    keywords: ["lao cai", "lào cai", "yen bai", "yên bái", "sa pa", "sapa", "fansipan", "mu cang chai", "mù cang chải"],
  },
  {
    name: "Thái Nguyên",
    fullAddress: "Thái Nguyên, Việt Nam",
    shortAddress: "Thái Nguyên",
    maskedAddress: "Bắc Kạn",
    lat: 21.5672,
    lng: 105.8252,
    keywords: ["thai nguyen", "thái nguyên", "bac kan", "bắc kạn", "ba be", "ba bể"],
  },
  {
    name: "Phú Thọ",
    fullAddress: "Phú Thọ, Việt Nam",
    shortAddress: "Phú Thọ",
    maskedAddress: "Vĩnh Phúc, Hòa Bình",
    lat: 21.3019,
    lng: 105.4307,
    keywords: ["phu tho", "phú thọ", "viet tri", "việt trì", "vinh phuc", "vĩnh phúc", "hoa binh", "hòa bình", "tam dao", "tam đảo"],
  },
  {
    name: "Bắc Ninh",
    fullAddress: "Bắc Ninh, Việt Nam",
    shortAddress: "Bắc Ninh",
    maskedAddress: "Bắc Giang",
    lat: 21.1861,
    lng: 106.0763,
    keywords: ["bac ninh", "bắc ninh", "bac giang", "bắc giang", "tu son", "từ sơn", "yen phong", "yên phong"],
  },
  {
    name: "Hưng Yên",
    fullAddress: "Hưng Yên, Việt Nam",
    shortAddress: "Hưng Yên",
    maskedAddress: "Thái Bình",
    lat: 20.8526,
    lng: 106.016,
    keywords: ["hung yen", "hưng yên", "thai binh", "thái bình", "pho hien", "phố hiến"],
  },
  {
    name: "Ninh Bình",
    fullAddress: "Ninh Bình, Việt Nam",
    shortAddress: "Ninh Bình",
    maskedAddress: "Nam Định, Hà Nam",
    lat: 20.2506,
    lng: 105.9745,
    keywords: ["ninh binh", "ninh bình", "nam dinh", "nam định", "ha nam", "hà nam", "trang an", "tràng an", "tam coc", "tam cốc", "bai dinh", "bái đính"],
  },
  {
    name: "Thanh Hóa",
    fullAddress: "Thanh Hóa, Việt Nam",
    shortAddress: "Thanh Hóa",
    maskedAddress: "Sầm Sơn",
    lat: 19.8067,
    lng: 105.7852,
    keywords: ["thanh hoa", "thanh hóa", "sam son", "sầm sơn"],
  },
  {
    name: "Nghệ An",
    fullAddress: "Nghệ An, Việt Nam",
    shortAddress: "Nghệ An",
    maskedAddress: "Vinh, Cửa Lò",
    lat: 18.6796,
    lng: 105.6813,
    keywords: ["nghe an", "nghệ an", "vinh", "cua lo", "cửa lò"],
  },
  {
    name: "Hà Tĩnh",
    fullAddress: "Hà Tĩnh, Việt Nam",
    shortAddress: "Hà Tĩnh",
    maskedAddress: "Miền Trung",
    lat: 18.3559,
    lng: 105.8877,
    keywords: ["ha tinh", "hà tĩnh", "ky anh", "kỳ anh"],
  },
  {
    name: "Quảng Trị",
    fullAddress: "Quảng Trị, Việt Nam",
    shortAddress: "Quảng Trị",
    maskedAddress: "Quảng Bình",
    lat: 16.7943,
    lng: 106.9634,
    keywords: ["quang tri", "quảng trị", "quang binh", "quảng bình", "dong hoi", "đồng hới", "phong nha", "khe sanh"],
  },
  {
    name: "Quảng Ngãi",
    fullAddress: "Quảng Ngãi, Việt Nam",
    shortAddress: "Quảng Ngãi",
    maskedAddress: "Bình Định, Quy Nhơn",
    lat: 15.1214,
    lng: 108.8044,
    keywords: ["quang ngai", "quảng ngãi", "binh dinh", "bình định", "quy nhon", "quy nhơn", "ly son", "lý sơn"],
  },
  {
    name: "Gia Lai",
    fullAddress: "Gia Lai, Việt Nam",
    shortAddress: "Gia Lai",
    maskedAddress: "Pleiku, Kon Tum",
    lat: 13.9833,
    lng: 108.0,
    keywords: ["gia lai", "pleiku", "kon tum", "mang den", "măng đen"],
  },
  {
    name: "Khánh Hòa",
    fullAddress: "Khánh Hòa, Việt Nam",
    shortAddress: "Khánh Hòa",
    maskedAddress: "Nha Trang, Cam Ranh, Ninh Thuận",
    lat: 12.2388,
    lng: 109.1967,
    keywords: ["khanh hoa", "khánh hòa", "nha trang", "cam ranh", "ninh thuan", "ninh thuận", "phan rang", "thap cham", "tháp chàm", "vinh hy", "vĩnh hy"],
  },
  {
    name: "Đắk Lắk",
    fullAddress: "Đắk Lắk, Việt Nam",
    shortAddress: "Đắk Lắk",
    maskedAddress: "Phú Yên, Buôn Ma Thuột",
    lat: 12.7100,
    lng: 108.2378,
    keywords: ["dak lak", "đắk lắk", "daklak", "buon ma thuot", "buôn ma thuột", "phu yen", "phú yên", "tuy hoa", "tuy hòa"],
  },
  {
    name: "Lâm Đồng",
    fullAddress: "Lâm Đồng, Việt Nam",
    shortAddress: "Lâm Đồng",
    maskedAddress: "Đà Lạt, Bình Thuận, Đắk Nông",
    lat: 11.9404,
    lng: 108.4583,
    keywords: ["lam dong", "lâm đồng", "da lat", "đà lạt", "dalat", "bao loc", "bảo lộc", "binh thuan", "bình thuận", "phan thiet", "phan thiết", "mui ne", "mũi né", "dak nong", "đắk nông", "gia nghia", "gia nghĩa"],
  },
  {
    name: "Đồng Nai",
    fullAddress: "Đồng Nai, Việt Nam",
    shortAddress: "Đồng Nai",
    maskedAddress: "Biên Hòa, Bình Phước",
    lat: 10.9574,
    lng: 106.8427,
    keywords: ["dong nai", "đồng nai", "bien hoa", "biên hòa", "long thanh", "long thành", "nhon trach", "nhơn trạch", "binh phuoc", "bình phước", "dong xoai", "đồng xoài", "phuoc long", "phước long", "binh long", "bình long"],
  },
  {
    name: "Tây Ninh",
    fullAddress: "Tây Ninh, Việt Nam",
    shortAddress: "Tây Ninh",
    maskedAddress: "Long An, Núi Bà Đen",
    lat: 11.3352,
    lng: 106.1099,
    keywords: ["tay ninh", "tây ninh", "long an", "tan an", "tân an", "can duoc", "cần đước", "ben luc", "bến lức", "duc hoa", "đức hòa", "nui ba den", "núi bà đen", "trang bang", "trảng bàng"],
  },
  {
    name: "Đồng Tháp",
    fullAddress: "Đồng Tháp, Việt Nam",
    shortAddress: "Đồng Tháp",
    maskedAddress: "Tiền Giang, Cao Lãnh, Mỹ Tho",
    lat: 10.4938,
    lng: 105.6882,
    keywords: ["dong thap", "đồng tháp", "tien giang", "tiền giang", "cao lanh", "cao lãnh", "sa dec", "sa đéc", "my tho", "mỹ tho", "cai lay", "cái lậy"],
  },
  {
    name: "Vĩnh Long",
    fullAddress: "Vĩnh Long, Việt Nam",
    shortAddress: "Vĩnh Long",
    maskedAddress: "Bến Tre, Trà Vinh",
    lat: 10.2537,
    lng: 105.9722,
    keywords: ["vinh long", "vĩnh long", "ben tre", "bến tre", "tra vinh", "trà vinh", "mo cay", "mỏ cày"],
  },
  {
    name: "An Giang",
    fullAddress: "An Giang, Việt Nam",
    shortAddress: "An Giang",
    maskedAddress: "Kiên Giang, Châu Đốc, Phú Quốc",
    lat: 10.5216,
    lng: 105.1259,
    keywords: ["an giang", "kien giang", "kiên giang", "long xuyen", "long xuyên", "chau doc", "châu đốc", "rach gia", "rạch giá", "phu quoc", "phú quốc", "ha tien", "hà tiên"],
  },
  {
    name: "Cà Mau",
    fullAddress: "Cà Mau, Việt Nam",
    shortAddress: "Cà Mau",
    maskedAddress: "Bạc Liêu, Đất Mũi",
    lat: 9.1768,
    lng: 105.1524,
    keywords: ["ca mau", "cà mau", "bac lieu", "bạc liêu", "dat mui", "đất mũi"],
  },

  {
    name: "Vũng Tàu",
    fullAddress: "Vũng Tàu, Bà Rịa - Vũng Tàu, Việt Nam",
    shortAddress: "Vũng Tàu",
    maskedAddress: "Bà Rịa - Vũng Tàu",
    lat: 10.4114,
    lng: 107.1362,
    keywords: ["vung tau", "vũng tàu", "ba ria", "bà rịa", "brvt", "long hai", "long hải", "ho tram", "hồ tràm", "ho coc", "hồ cốc"],
  },
  {
    name: "Phan Thiết",
    fullAddress: "Phan Thiết, Bình Thuận, Việt Nam",
    shortAddress: "Phan Thiết",
    maskedAddress: "Bình Thuận, Mũi Né",
    lat: 10.9333,
    lng: 108.1,
    keywords: ["phan thiet", "phan thiết", "binh thuan", "bình thuận", "mui ne", "mũi né", "la gi", "lagi"],
  },
  {
    name: "Đà Lạt",
    fullAddress: "Đà Lạt, Lâm Đồng, Việt Nam",
    shortAddress: "Đà Lạt",
    maskedAddress: "Lâm Đồng",
    lat: 11.9404,
    lng: 108.4583,
    keywords: ["da lat", "đà lạt", "dalat", "lam dong", "lâm đồng", "langbiang"],
  },
  {
    name: "Nha Trang",
    fullAddress: "Nha Trang, Khánh Hòa, Việt Nam",
    shortAddress: "Nha Trang",
    maskedAddress: "Khánh Hòa",
    lat: 12.2388,
    lng: 109.1967,
    keywords: ["nha trang", "khanh hoa", "khánh hòa", "hon tre", "hòn tre", "vinpearl"],
  },
];

function removeVietnameseTones(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeSearchText(value = "") {
  return removeVietnameseTones(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

export function searchVietnamLocations(query, limit = 8) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [];
  }

  return VIETNAM_LOCATIONS.map((item) => {
    const searchableText = normalizeSearchText(
      [
        item.name,
        item.fullAddress,
        item.shortAddress,
        item.maskedAddress,
        ...(item.keywords || []),
      ].join(" "),
    );

    if (!searchableText.includes(normalizedQuery)) {
      return null;
    }

    return {
      ...item,
      source: "VIETNAM_LOCATION",
      placeId: `vn_location_${normalizeSearchText(item.fullAddress).replace(/\s+/g, "_")}`,
      isVietnamLocation: true,
    };
  })
    .filter(Boolean)
    .slice(0, limit);
}

export function isVietnamLocationOption(option) {
  return (
    option?.source === "VIETNAM_LOCATION" ||
    option?.isVietnamLocation === true
  );
}
// Path: goviet247/apps/api/src/services/mapService.js
import axios from "axios";

const GOONG_API_KEY = process.env.GOONG_API_KEY;
const GOONG_BASE_URL = "https://rsapi.goong.io";

function buildMaskedAddress({ ward, district, province }) {
  if (ward && district && province) {
    return `${ward}, ${district}, ${province}`;
  }
  if (district && province) {
    return `${district}, ${province}`;
  }
  return province || "";
}

// 🔥 AUTOCOMPLETE
export async function autocomplete(input) {
  const url = `${GOONG_BASE_URL}/Place/AutoComplete`;

  const { data } = await axios.get(url, {
    params: {
      api_key: GOONG_API_KEY,
      input,
      location: "10.7769,106.7009",
      radius: 50000,
    },
  });

  const predictions = data?.predictions || [];

  const items = predictions.map((p) => {
    const compound = p.compound || {};

    const ward = compound.commune || "";
    const district = compound.district || "";
    const province = compound.province || "";

    return {
      placeId: p.place_id,
      name: p.structured_formatting?.main_text || "",
      shortAddress: p.structured_formatting?.main_text || "",
      fullAddress: p.description || "",
      maskedAddress: buildMaskedAddress({ ward, district, province }),
      district,
      ward,
      province,
    };
  });

  return items;
}

// 🔥 PLACE DETAIL
export async function getPlaceDetail(placeId) {
  const url = `${GOONG_BASE_URL}/Place/Detail`;

  const { data } = await axios.get(url, {
    params: {
      api_key: GOONG_API_KEY,
      place_id: placeId,
    },
  });

  const result = data?.result;

  if (!result) return null;

  const compound = result.compound || {};

  const ward = compound.commune || "";
  const district = compound.district || "";
  const province = compound.province || "";

  return {
    placeId,
    name: result.name || "",
    shortAddress: result.name || "",
    fullAddress: result.formatted_address || "",
    maskedAddress: buildMaskedAddress({ ward, district, province }),
    district,
    ward,
    province,
    lat: result.geometry?.location?.lat,
    lng: result.geometry?.location?.lng,
  };
}

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

// 🔥 ROUTE / DISTANCE / DURATION
export async function getRoute(points = []) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("ROUTE_POINTS_INVALID");
  }

  const normalizedPoints = points.map((point) => {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("ROUTE_POINT_COORDINATES_INVALID");
    }

    return { lat, lng };
  });

  const origin = `${normalizedPoints[0].lat},${normalizedPoints[0].lng}`;

  const destination = normalizedPoints
    .slice(1)
    .map((point) => `${point.lat},${point.lng}`)
    .join(";");

  const url = `${GOONG_BASE_URL}/Direction`;

  const { data } = await axios.get(url, {
    params: {
      api_key: GOONG_API_KEY,
      origin,
      destination,
      vehicle: "car",
    },
  });

  console.log("GOONG_ROUTE_DEBUG", {
    url,
    origin,
    destination,
    legCount: Array.isArray(data?.routes?.[0]?.legs)
      ? data.routes[0].legs.length
      : 0,
  });

  const route = data?.routes?.[0];

  if (!route) {
    return null;
  }

  const legs = Array.isArray(route.legs) ? route.legs : [];

  const distanceMeters = legs.reduce(
    (sum, leg) => sum + (Number(leg?.distance?.value) || 0),
    0,
  );

  const durationSeconds = legs.reduce(
    (sum, leg) => sum + (Number(leg?.duration?.value) || 0),
    0,
  );

  const firstPoint = normalizedPoints[0];
  const lastPoint = normalizedPoints[normalizedPoints.length - 1];

  const isRoundTripDetected =
    normalizedPoints.length >= 3 &&
    firstPoint &&
    lastPoint &&
    firstPoint.lat === lastPoint.lat &&
    firstPoint.lng === lastPoint.lng;

  let outboundDurationSeconds = durationSeconds;
  let returnDurationSeconds = 0;

  if (isRoundTripDetected && legs.length >= 2) {
    const lastLegSeconds = Number(legs[legs.length - 1]?.duration?.value) || 0;
    returnDurationSeconds = lastLegSeconds;
    outboundDurationSeconds = Math.max(0, durationSeconds - lastLegSeconds);
  }

  return {
    distanceMeters,
    durationSeconds,
    distanceKm: Number((distanceMeters / 1000).toFixed(1)),
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    outboundDurationMinutes: Math.max(
      1,
      Math.round(outboundDurationSeconds / 60),
    ),
    returnDurationMinutes: Math.max(0, Math.round(returnDurationSeconds / 60)),
    isRoundTripDetected,
    polyline: route.overview_polyline?.points || "",
    points: normalizedPoints,
    debug: {
      url,
      origin,
      destination,
      legCount: legs.length,
    },
  };
}

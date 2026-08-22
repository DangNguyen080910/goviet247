import axios from "axios";

const GOONG_API_KEY = process.env.GOONG_API_KEY;
const GOONG_BASE_URL = "https://rsapi.goong.io";
const VIETMAP_API_KEY = process.env.VIETMAP_API_KEY || process.env.VIETMAP_SERVICE_KEY;
const VIETMAP_BASE_URL = "https://maps.vietmap.vn";
const MAP_PROVIDER = String(
  process.env.MAP_PROVIDER || (VIETMAP_API_KEY ? "vietmap" : "goong"),
).toLowerCase();

const PREFIX = { goong: "goong|", vietmap: "vietmap|" };

function buildMaskedAddress({ ward, district, province }) {
  // Dữ liệu hành chính mới ưu tiên phường/xã + tỉnh/thành.
  // Giữ quận/huyện làm fallback để tương thích kết quả bản đồ cũ.
  return [ward || district, province].filter(Boolean).join(", ");
}

function requireApiKey(provider) {
  const key = provider === "vietmap" ? VIETMAP_API_KEY : GOONG_API_KEY;
  if (!key) throw new Error(`${provider.toUpperCase()}_API_KEY_MISSING`);
  return key;
}

function tagPlaceId(provider, id) {
  return `${PREFIX[provider]}${String(id || "")}`;
}

function parsePlaceId(value) {
  const id = String(value || "").trim();
  if (id.startsWith(PREFIX.vietmap)) {
    return { provider: "vietmap", id: id.slice(PREFIX.vietmap.length) };
  }
  if (id.startsWith(PREFIX.goong)) {
    return { provider: "goong", id: id.slice(PREFIX.goong.length) };
  }
  if (/^(auto|geocode|vm):/i.test(id)) return { provider: "vietmap", id };
  return { provider: "goong", id };
}

function getBoundaryParts(boundaries = []) {
  const items = Array.isArray(boundaries) ? boundaries : [];
  const getName = (type) =>
    items.find((item) => Number(item?.type) === type)?.full_name || "";
  return { ward: getName(2), district: getName(1), province: getName(0) };
}

function normalizePoints(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("ROUTE_POINTS_INVALID");
  }
  return points.map((point) => {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("ROUTE_POINT_COORDINATES_INVALID");
    }
    return { lat, lng };
  });
}

function normalizeRoute({ provider, points, distanceMeters, durationSeconds, polyline, debug }) {
  const first = points[0];
  const last = points[points.length - 1];
  const roundTrip =
    points.length >= 3 && first.lat === last.lat && first.lng === last.lng;
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const outboundDurationMinutes = roundTrip
    ? Math.max(1, Math.round(durationMinutes / 2))
    : durationMinutes;
  const returnDurationMinutes = roundTrip
    ? Math.max(1, durationMinutes - outboundDurationMinutes)
    : 0;
  return {
    distanceMeters,
    durationSeconds,
    distanceKm: Number((distanceMeters / 1000).toFixed(1)),
    durationMinutes,
    outboundDurationMinutes,
    returnDurationMinutes,
    isRoundTripDetected: roundTrip,
    polyline: polyline || "",
    points,
    debug: { provider, ...debug },
  };
}

async function autocompleteVietmap(input, options = {}) {
  const params = {
    apikey: requireApiKey("vietmap"),
    text: input,
    // Địa chỉ hành chính mới là kết quả chính, dữ liệu cũ nằm trong data_old.
    display_type: 5,
  };
  const lat = Number(options?.lat);
  const lng = Number(options?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.focus = `${lat},${lng}`;
  }
  const { data } = await axios.get(`${VIETMAP_BASE_URL}/api/autocomplete/v4`, {
    params,
  });
  return (Array.isArray(data) ? data : []).map((item) => {
    const current = getBoundaryParts(item?.boundaries);
    const legacy = getBoundaryParts(item?.data_old?.boundaries);
    return {
      placeId: tagPlaceId("vietmap", item?.ref_id),
      name: item?.name || "",
      shortAddress: item?.name || "",
      fullAddress: item?.display || item?.address || "",
      maskedAddress: buildMaskedAddress(current) || item?.address || "",
      district: current.district || legacy.district,
      ward: current.ward || legacy.ward,
      province: current.province || legacy.province,
      oldAddress: item?.data_old?.display || "",
      newAddress: item?.display || "",
    };
  });
}

async function getPlaceDetailVietmap(id) {
  const { data } = await axios.get(`${VIETMAP_BASE_URL}/api/place/v4`, {
    params: { apikey: requireApiKey("vietmap"), refid: id },
  });
  if (!data || !Number.isFinite(Number(data?.lat)) || !Number.isFinite(Number(data?.lng))) {
    return null;
  }
  const ward = data?.ward || "";
  const district = data?.district || "";
  const province = data?.city || "";
  const fullAddress = data?.display || data?.address || "";
  return {
    placeId: tagPlaceId("vietmap", id),
    name: data?.name || data?.address || "",
    shortAddress: data?.name || data?.address || "",
    fullAddress,
    maskedAddress: buildMaskedAddress({ ward, district, province }) || fullAddress,
    district,
    ward,
    province,
    lat: Number(data.lat),
    lng: Number(data.lng),
  };
}

async function getRouteVietmap(points) {
  const params = new URLSearchParams();
  params.set("apikey", requireApiKey("vietmap"));
  params.set("vehicle", "car");
  params.set("points_encoded", "true");
  points.forEach((point) => params.append("point", `${point.lat},${point.lng}`));
  const { data } = await axios.get(`${VIETMAP_BASE_URL}/api/route/v4`, { params });
  if (data?.code !== "OK") return null;
  const route = data?.paths?.[0];
  if (!route) return null;
  return normalizeRoute({
    provider: "vietmap",
    points,
    distanceMeters: Number(route?.distance) || 0,
    // Route v4 trả thời gian theo mili-giây.
    durationSeconds: Math.max(0, Math.round((Number(route?.time) || 0) / 1000)),
    polyline: route?.points,
    debug: { pointCount: points.length, routeCode: data?.code },
  });
}

async function autocompleteGoong(input, options = {}) {
  const params = {
    api_key: requireApiKey("goong"),
    input,
    radius: 50,
    more_compound: true,
  };
  const lat = Number(options?.lat);
  const lng = Number(options?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.location = `${lat},${lng}`;
  }
  const { data } = await axios.get(`${GOONG_BASE_URL}/Place/AutoComplete`, { params });
  return (data?.predictions || []).map((item) => {
    const compound = item?.compound || {};
    const ward = compound?.commune || "";
    const district = compound?.district || "";
    const province = compound?.province || "";
    return {
      placeId: tagPlaceId("goong", item?.place_id),
      name: item?.structured_formatting?.main_text || "",
      shortAddress: item?.structured_formatting?.main_text || "",
      fullAddress: item?.description || "",
      maskedAddress: buildMaskedAddress({ ward, district, province }),
      district,
      ward,
      province,
    };
  });
}

async function getPlaceDetailGoong(id) {
  const { data } = await axios.get(`${GOONG_BASE_URL}/Place/Detail`, {
    params: { api_key: requireApiKey("goong"), place_id: id },
  });
  const result = data?.result;
  if (!result) return null;
  const compound = result?.compound || {};
  const ward = compound?.commune || "";
  const district = compound?.district || "";
  const province = compound?.province || "";
  return {
    placeId: tagPlaceId("goong", id),
    name: result?.name || "",
    shortAddress: result?.name || "",
    fullAddress: result?.formatted_address || "",
    maskedAddress: buildMaskedAddress({ ward, district, province }),
    district,
    ward,
    province,
    lat: result?.geometry?.location?.lat,
    lng: result?.geometry?.location?.lng,
  };
}

async function getRouteGoong(points) {
  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = points.slice(1).map((point) => `${point.lat},${point.lng}`).join(";");
  const { data } = await axios.get(`${GOONG_BASE_URL}/Direction`, {
    params: { api_key: requireApiKey("goong"), origin, destination, vehicle: "car" },
  });
  const route = data?.routes?.[0];
  if (!route) return null;
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  const result = normalizeRoute({
    provider: "goong",
    points,
    distanceMeters: legs.reduce((sum, leg) => sum + (Number(leg?.distance?.value) || 0), 0),
    durationSeconds: legs.reduce((sum, leg) => sum + (Number(leg?.duration?.value) || 0), 0),
    polyline: route?.overview_polyline?.points,
    debug: { origin, destination, legCount: legs.length },
  });
  if (result.isRoundTripDetected && legs.length >= 2) {
    const returnSeconds = Number(legs[legs.length - 1]?.duration?.value) || 0;
    result.returnDurationMinutes = Math.max(1, Math.round(returnSeconds / 60));
    result.outboundDurationMinutes = Math.max(1, result.durationMinutes - result.returnDurationMinutes);
  }
  return result;
}

export async function autocomplete(input, options = {}) {
  if (MAP_PROVIDER === "goong") return autocompleteGoong(input, options);
  try {
    const items = await autocompleteVietmap(input, options);
    if (items.length > 0 || !GOONG_API_KEY) return items;

    console.warn("VietMap autocomplete returned no results; using Goong fallback.");
    return autocompleteGoong(input, options);
  } catch (error) {
    if (!GOONG_API_KEY) throw error;
    console.warn("VietMap autocomplete failed; using Goong fallback.");
    return autocompleteGoong(input, options);
  }
}

export async function getPlaceDetail(placeId) {
  const parsed = parsePlaceId(placeId);
  return parsed.provider === "vietmap"
    ? getPlaceDetailVietmap(parsed.id)
    : getPlaceDetailGoong(parsed.id);
}

export async function getRoute(points = []) {
  const normalized = normalizePoints(points);
  if (MAP_PROVIDER === "goong") return getRouteGoong(normalized);
  try {
    const route = await getRouteVietmap(normalized);
    if (route || !GOONG_API_KEY) return route;

    console.warn("VietMap route returned no results; using Goong fallback.");
    return getRouteGoong(normalized);
  } catch (error) {
    if (!GOONG_API_KEY) throw error;
    console.warn("VietMap route failed; using Goong fallback.");
    return getRouteGoong(normalized);
  }
}

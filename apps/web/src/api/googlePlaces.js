// Path: goviet247/apps/web/src/api/googlePlaces.js
const GOOGLE_PLACES_API_BASE = "https://places.googleapis.com/v1";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

function ensureApiKey() {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Thiếu VITE_GOOGLE_MAPS_API_KEY trong web .env");
  }
}

function buildHeaders(fieldMask) {
  ensureApiKey();

  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
    "X-Goog-FieldMask": fieldMask,
  };
}

export function createPlacesSessionToken() {
  return crypto.randomUUID();
}

export async function autocompletePlaces(input, sessionToken) {
  const keyword = String(input || "").trim();

  if (!keyword) return [];

  const res = await fetch(`${GOOGLE_PLACES_API_BASE}/places:autocomplete`, {
    method: "POST",
    headers: buildHeaders(
      "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    ),
    body: JSON.stringify({
      input: keyword,
      languageCode: "vi",
      regionCode: "VN",
      sessionToken,
      includedPrimaryTypes: [
        "street_address",
        "route",
        "premise",
        "subpremise",
        "point_of_interest",
        "establishment",
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "Không tìm được gợi ý địa chỉ.");
  }

  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

  return suggestions
    .map((item) => {
      const p = item?.placePrediction;
      if (!p?.placeId) return null;

      return {
        placeId: p.placeId,
        mainText: p?.structuredFormat?.mainText?.text || p?.text?.text || "",
        secondaryText: p?.structuredFormat?.secondaryText?.text || "",
        fullText: p?.text?.text || "",
      };
    })
    .filter(Boolean);
}

export async function getPlaceDetails(placeId) {
  const id = String(placeId || "").trim();

  if (!id) {
    throw new Error("Thiếu placeId để lấy chi tiết địa điểm.");
  }

  const res = await fetch(`${GOOGLE_PLACES_API_BASE}/places/${id}`, {
    method: "GET",
    headers: buildHeaders(
      "id,displayName,formattedAddress,location,shortFormattedAddress",
    ),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "Không lấy được chi tiết địa điểm.");
  }

  return {
    placeId: data.id,
    label: data.formattedAddress || data.shortFormattedAddress || "",
    name: data.displayName?.text || "",
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
  };
}
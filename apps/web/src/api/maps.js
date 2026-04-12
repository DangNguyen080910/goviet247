// Path: goviet247/apps/web/src/api/maps.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export async function searchPlaces(q) {
  const keyword = String(q || "").trim();

  if (!keyword) return [];

  const res = await fetch(
    `${API_BASE}/api/maps/autocomplete?q=${encodeURIComponent(keyword)}`,
  );

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tìm được địa chỉ.");
  }

  return data.items || [];
}

export async function getPlaceDetail(placeId) {
  const id = String(placeId || "").trim();

  if (!id) {
    throw new Error("Thiếu placeId.");
  }

  const res = await fetch(
    `${API_BASE}/api/maps/place-detail?placeId=${encodeURIComponent(id)}`,
  );

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không lấy được chi tiết địa chỉ.");
  }

  return data.item || null;
}
// Path: goviet247/apps/web/src/api/maps.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

let autocompleteCooldownUntil = 0;
const AUTOCOMPLETE_COOLDOWN_MS = 8000;

export async function searchPlaces(q, options = {}) {
  const keyword = String(q || "").trim();

  if (keyword.length < 3) return [];

  const now = Date.now();
  if (autocompleteCooldownUntil > now) {
    const waitSeconds = Math.ceil((autocompleteCooldownUntil - now) / 1000);
    throw new Error(
      `Gợi ý địa chỉ đang tạm nghỉ để tránh vượt giới hạn. Vui lòng thử lại sau ${waitSeconds}s.`,
    );
  }

  const lat = Number(options?.lat);
  const lng = Number(options?.lng);

  const params = new URLSearchParams({
    q: keyword,
  });

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    params.set("lat", String(lat));
    params.set("lng", String(lng));
  }

  const res = await fetch(
    `${API_BASE}/api/maps/autocomplete?${params.toString()}`,
  );

  const data = await res.json().catch(() => ({}));

  if (res.status === 429) {
    autocompleteCooldownUntil = Date.now() + AUTOCOMPLETE_COOLDOWN_MS;

    throw new Error(
      data?.message ||
        "Dịch vụ gợi ý địa chỉ đang tạm quá tải. Vui lòng thử lại sau vài giây.",
    );
  }

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tìm được địa chỉ.");
  }

  autocompleteCooldownUntil = 0;
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

export async function getRoute(points) {
  const res = await fetch(`${API_BASE}/api/maps/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không tính được lộ trình.");
  }

  return data.item;
}

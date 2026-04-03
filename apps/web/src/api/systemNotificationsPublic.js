// Path: goviet247/apps/web/src/api/systemNotificationsPublic.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const API = `${API_BASE}/api/public/system-notifications`;

export async function getPublicSystemNotifications(params = {}) {
  const query = new URLSearchParams();

  if (params.audience) {
    query.set("audience", String(params.audience).trim().toUpperCase());
  }

  const url = query.toString() ? `${API}?${query.toString()}` : API;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Không lấy được thông báo hệ thống.");
  }

  return Array.isArray(data.items) ? data.items : [];
}